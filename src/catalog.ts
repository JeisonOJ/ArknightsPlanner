import data from "./catalog.json" with { type: "json" };

export type Region = "EN" | "CN";
export interface Cost {
  id: string;
  count: number;
}
export interface Step {
  phase: number;
  level: number;
  cost: Cost[];
}
export interface Module {
  designation: string | null;
  iconId: string | null;
  id: string;
  name: string;
  region: Region;
  phase: number;
  level: number;
  trust: number[];
  costs: Cost[][];
  missions: string[];
}
export interface Operator {
  artwork: {
    phase: number | null;
    portraitId: string;
    illustrationId: string | null;
  }[];
  appellation: string | null;
  portraitId: string | null;
  id: string;
  baseId: string;
  name: string;
  cnName: string;
  profession: string;
  region: Region;
  confirmedGlobal: boolean;
  rarity: number;
  standardProgression: boolean;
  phases: { maxLevel: number; cost: Cost[] }[];
  ranks: Step[];
  skills: { id: string; name: string; mastery: Step[] }[];
  modules: Module[];
}
export interface Item {
  iconId: string | null;
  id: string;
  name: string;
  category: string;
  exp: number;
}
export interface Outfit {
  id: string;
  operatorId: string;
  name: string;
  cnName: string;
  region: Region;
  portraitId: string | null;
  illustrationId: string | null;
  price: number | null;
}
export interface Catalog {
  outfits: Outfit[];
  version: number;
  revision: string;
  repository: string;
  globalNotice: string;
  operators: Operator[];
  items: Item[];
  exp: number[][];
  levelLmd: number[][];
  promotionLmd: number[][];
}
export const catalog = data as Catalog;
