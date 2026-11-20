import {
  classifyArtwork,
  compareArtwork,
  type ArtworkKind,
} from "./artworkMatch.ts";
import { saveArtwork } from "./artworkDb.ts";

const maxImageBytes = 16 * 1024 * 1024;
type Source = {
  path: string;
  size: number;
  read: (mime: string) => Promise<Blob>;
};
export type ImportSummary = {
  images: number;
  unmatched: number;
  unsupported: number;
  failed: number;
  saved: number;
  existing: number;
  duplicates: number;
  processed: number;
  total: number;
  matched: Record<ArtworkKind, number>;
  examples: string[];
};
export async function importArtwork(
  files: File[],
  zip: boolean,
  replace: boolean,
  report: (summary: ImportSummary) => void,
) {
  const summary: ImportSummary = {
    images: 0,
    unmatched: 0,
    unsupported: 0,
    failed: 0,
    saved: 0,
    existing: 0,
    duplicates: 0,
    processed: 0,
    total: 0,
    matched: {
      operator: 0,
      operatorArt: 0,
      item: 0,
      module: 0,
      outfit: 0,
      illustration: 0,
    },
    examples: [],
  };
  const publish = () =>
    report({
      ...summary,
      matched: { ...summary.matched },
      examples: [...summary.examples],
    });
  const matchGroups = new Map<
    string,
    Array<Source & { rank: number; kind: ArtworkKind; mime: string }>
  >();
  async function run(sources: AsyncIterable<Source> | Source[]) {
    for await (const source of sources) {
      const result = classifyArtwork(source.path);
      if (result.status === "ignored") continue;
      summary.images++;
      if (result.status === "matched") {
        const group = matchGroups.get(result.match.key) ?? [];
        group.push({
          ...source,
          rank: result.match.rank,
          kind: result.match.kind,
          mime: result.mime,
        });
        matchGroups.set(result.match.key, group);
      } else {
        summary[result.status]++;
        if (summary.examples.length < 8) summary.examples.push(source.path);
      }
    }
    for (const group of matchGroups.values()) {
      summary.matched[group[0].kind]++;
      summary.duplicates += group.length - 1;
    }
    summary.total = matchGroups.size;
    publish();
    for (const [key, group] of matchGroups) {
      for (const source of group.sort(compareArtwork)) {
        let blob: Blob;
        try {
          if (source.size > maxImageBytes) throw Error("Image exceeds 16 MiB.");
          blob = await source.read(source.mime);
          const decoded = await createImageBitmap(blob);
          decoded.close();
        } catch {
          summary.failed++;
          if (summary.examples.length < 8)
            summary.examples.push(source.path + " (could not read image)");
          continue;
        }
        if (
          await saveArtwork(
            { key, kind: source.kind, blob, path: source.path },
            replace,
          )
        )
          summary.saved++;
        else summary.existing++;
        break;
      }
      summary.processed++;
      if (summary.processed % 10 === 0 || summary.processed === summary.total) {
        publish();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }
  if (!zip) {
    await run(
      files.map((file) => ({
        path: file.webkitRelativePath || file.name,
        size: file.size,
        read: async (mime) => file.slice(0, file.size, mime),
      })),
    );
    return;
  }
  const { ZipReader, BlobReader } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(files[0]));
  async function* entries() {
    for await (const entry of reader.getEntriesGenerator()) {
      if (entry.directory) continue;
      yield {
        path: entry.filename,
        size: entry.uncompressedSize,
        read: async (mime: string) => {
          const chunks: Uint8Array<ArrayBuffer>[] = [];
          let size = 0;
          const output = new WritableStream<Uint8Array>({
            write(chunk) {
              size += chunk.length;
              if (size > maxImageBytes)
                throw Error("Expanded image exceeds 16 MiB.");
              chunks.push(new Uint8Array(chunk));
            },
          });
          await entry.getData(output, {
            checkSignature: true,
            useWebWorkers: false,
            useCompressionStream: true,
          });
          return new Blob(chunks, { type: mime });
        },
      };
    }
  }
  try {
    await run(entries());
  } finally {
    await reader.close();
  }
}
