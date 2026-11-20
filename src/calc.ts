import type { Catalog, Operator, Cost, Module } from "./catalog.ts";
import { pair, type State, type Pair, type Progress } from "./model.ts";
export type Costs = Record<string, number>;
export const add = (bag: Costs, id: string, n: number) => {
  if (n > 0) bag[id] = (bag[id] || 0) + n;
};
function charge(bag: Costs, costs: Cost[]) {
  for (const c of costs) add(bag, c.id, c.count);
}
export function moduleCost(stages: Cost[][], p: Pair) {
  const bag: Costs = {};
  for (const stage of stages.slice(p.current, p.target)) charge(bag, stage);
  return bag;
}
export function meetsModuleLevel(module: Module, progress: Progress) {
  return (
    progress.modules[module.id]?.current > 0 ||
    progress.phase.current > module.phase ||
    (progress.phase.current === module.phase &&
      progress.level.current >= module.level)
  );
}

function hasOperatorGoal(progress: Progress, forms: Operator[]) {
  return (
    progress.phase.target > progress.phase.current ||
    (progress.phase.target === progress.phase.current &&
      progress.level.target > progress.level.current) ||
    progress.rank.target > progress.rank.current ||
    forms.some((form) =>
      form.skills.some((skill) => {
        const plan = progress.skills[skill.id];
        return plan && plan.current < Math.min(plan.target, skill.mastery.length);
      }),
    )
  );
}

export function calculate(cat: Catalog, s: State) {
  const total: Costs = {},
    perBase: Record<string, Costs> = {};
  const activeOperatorIds = new Set<string>();
  let moduleCount = 0,
    levelLmd = 0,
    promotionLmd = 0;
  const groups = new Map<string, Operator[]>();
  for (const op of cat.operators) {
    const list = groups.get(op.baseId) ?? [];
    list.push(op);
    groups.set(op.baseId, list);
  }
  for (const [id, p] of Object.entries(s.operators)) {
    const forms = groups.get(id);
    if (!forms) continue;
    const op = forms.find((x) => x.id === id) ?? forms[0],
      bag: Costs = {};
    for (const form of forms) {
      for (const mod of form.modules) {
        const plan = p.modules[mod.id];
        if (!plan || plan.target <= plan.current) continue;
        moduleCount++;
        for (const [item, amount] of Object.entries(moduleCost(mod.costs, plan)))
          add(total, item, amount);
      }
    }
    if (!op.standardProgression || !hasOperatorGoal(p, forms)) continue;
    activeOperatorIds.add(id);
    let currentPhase = p.phase.current,
      currentLevel = p.level.current,
      currentRank = p.rank.current;
    function reached(q: number, l: number) {
      if (q > currentPhase) {
        currentPhase = q;
        currentLevel = l;
      } else if (q === currentPhase) currentLevel = Math.max(currentLevel, l);
    }
    for (const form of forms) {
      for (const skill of form.skills)
        if (p.skills[skill.id]?.current > 0) {
          currentRank = 7;
          for (const step of skill.mastery.slice(0, p.skills[skill.id].current))
            reached(step.phase, step.level);
        }
    }
    for (const step of op.ranks.slice(0, currentRank - 1))
      reached(step.phase, step.level);
    let phase = p.phase.target,
      level = p.level.target,
      rank = p.rank.target;
    function requireLevel(q: number, l: number) {
      if (q > phase) {
        phase = q;
        level = l;
      } else if (q === phase) level = Math.max(level, l);
    }
    for (const form of forms) {
      for (const skill of form.skills) {
        const m = p.skills[skill.id] ?? pair();
        for (const step of skill.mastery.slice(m.current, m.target)) {
          charge(bag, step.cost);
          rank = Math.max(rank, 7);
          requireLevel(step.phase, step.level);
        }
      }
    }
    for (const step of op.ranks.slice(currentRank - 1, rank - 1)) {
      charge(bag, step.cost);
      requireLevel(step.phase, step.level);
    }
    for (let q = currentPhase; q <= phase && q < op.phases.length; q++) {
      if (q > currentPhase) {
        charge(bag, op.phases[q].cost);
        const gold = cat.promotionLmd[op.rarity - 1][q - 1];
        add(bag, "4001", gold);
        promotionLmd += gold;
      }
      const from = q === currentPhase ? currentLevel : 1;
      const to =
        q === phase
          ? Math.min(level, op.phases[q].maxLevel)
          : op.phases[q].maxLevel;
      for (let l = from; l < to; l++) {
        add(bag, "EXP", cat.exp[q][l - 1]);
        const gold = cat.levelLmd[q][l - 1];
        add(bag, "4001", gold);
        levelLmd += gold;
      }
    }
    perBase[id] = bag;
    for (const [key, n] of Object.entries(bag)) add(total, key, n);
  }
  const exp = cat.items.reduce(
    (n, x) => n + x.exp * (s.inventory[x.id] || 0),
    0,
  );
  const owned: Costs = { ...s.inventory, EXP: exp };
  const missing = Object.entries(total).filter(
    ([id, n]) => n > (owned[id] || 0),
  );
  return {
    total,
    perBase,
    active: activeOperatorIds.size,
    activeOperatorIds,
    moduleCount,
    exp,
    owned,
    missing,
    levelLmd,
    promotionLmd,
  };
}
