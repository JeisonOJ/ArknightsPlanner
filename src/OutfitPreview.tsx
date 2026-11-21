import { useEffect, useId, useRef, useState } from "react";
import { Art } from "./CatalogVisuals";

type Point = { x: number; y: number };
type View = Point & { scale: number };
const fit: View = { x: 0, y: 0, scale: 1 };
const midpoint = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function OutfitPreview({
  name,
  operator,
  localKey,
  onClose,
}: {
  name: string;
  operator: string;
  localKey: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const natural = useRef({ width: 0, height: 0 });
  const heading = useId();
  const [view, setView] = useState(fit);

  function constrain(next: View) {
    const area = viewport.current;
    const { width, height } = natural.current;
    if (!area || !width || !height || next.scale === 1) return fit;
    const ratio = Math.min(
      area.clientWidth / width,
      area.clientHeight / height,
    );
    const x = Math.max(0, (ratio * width * next.scale - area.clientWidth) / 2);
    const y = Math.max(
      0,
      (ratio * height * next.scale - area.clientHeight) / 2,
    );
    return { ...next, x: clamp(next.x, -x, x), y: clamp(next.y, -y, y) };
  }

  function move(factor: number, from: Point, to = from) {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return;
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setView((previous) => {
      const scale = clamp(previous.scale * factor, 1, 5);
      const ratio = scale / previous.scale;
      return constrain({
        scale,
        x: to.x - center.x - (from.x - center.x - previous.x) * ratio,
        y: to.y - center.y - (from.y - center.y - previous.y) * ratio,
      });
    });
  }

  useEffect(() => {
    const element = dialog.current!;
    const area = viewport.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? area.clientHeight
            : 1);
      move(Math.exp(-clamp(delta, -300, 300) * 0.002), {
        x: event.clientX,
        y: event.clientY,
      });
    };
    area.addEventListener("wheel", wheel, { passive: false });
    const observer = new ResizeObserver(() => setView(constrain));
    observer.observe(area);
    return () => {
      observer.disconnect();
      area.removeEventListener("wheel", wheel);
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function zoom(factor: number) {
    const rect = viewport.current!.getBoundingClientRect();
    move(factor, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  return (
    <dialog
      ref={dialog}
      className="outfit-dialog"
      aria-labelledby={heading}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="outfit-dialog-content">
        <header className="outfit-dialog-header">
          <div>
            <h2 id={heading}>{name}</h2>
            <small>{operator}</small>
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            Close preview
          </button>
        </header>
        <div
          className="outfit-stage"
          ref={viewport}
          data-zoomed={view.scale > 1}
          onPointerDown={(event) => {
            if (event.button !== 0 || pointers.current.size >= 2) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onPointerMove={(event) => {
            const previous = pointers.current.get(event.pointerId);
            if (!previous) return;
            const next = { x: event.clientX, y: event.clientY };
            const other = [...pointers.current].find(
              ([id]) => id !== event.pointerId,
            )?.[1];
            pointers.current.set(event.pointerId, next);
            if (other) {
              const span = distance(previous, other);
              if (span > 0)
                move(
                  distance(next, other) / span,
                  midpoint(previous, other),
                  midpoint(next, other),
                );
            } else move(1, previous, next);
          }}
          onLostPointerCapture={(event) => {
            pointers.current.delete(event.pointerId);
          }}
        >
          <div
            className="outfit-stage-image"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          >
            <Art
              localKey={localKey}
              alt={name}
              onImageLoad={(image) => {
                natural.current = {
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                };
                setView(fit);
              }}
              fallback={<span className="muted">Preview unavailable.</span>}
            />
          </div>
        </div>
        <footer className="outfit-zoom" role="group" aria-label="Zoom controls">
          <button
            type="button"
            onClick={() => zoom(1 / 1.25)}
            disabled={view.scale <= 1}
          >
            Zoom out
          </button>
          <button type="button" onClick={() => setView(fit)}>
            Fit to window
          </button>
          <button
            type="button"
            onClick={() => zoom(1.25)}
            disabled={view.scale >= 5}
          >
            Zoom in
          </button>
          <output aria-label="Zoom level">
            {Math.round(view.scale * 100)}%
          </output>
        </footer>
      </div>
    </dialog>
  );
}
