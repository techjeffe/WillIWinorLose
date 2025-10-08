import { Action, Card, Hand, Rules } from "./types";
import { bestTotal, handTotals, isPair, isSoft } from "./hand";

const DEALER_ORDER: Card["rank"][] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

function dealerIndex(card: Card): number {
  const normalized = card.rank === "J" || card.rank === "Q" || card.rank === "K" ? "10" : card.rank;
  const idx = DEALER_ORDER.indexOf(normalized);
  return idx === -1 ? 8 : idx;
}

const hardS17: Record<number, Action[]> = {
  17: Array(10).fill("S") as Action[],
  18: Array(10).fill("S") as Action[],
  19: Array(10).fill("S") as Action[],
  20: Array(10).fill("S") as Action[],
  21: Array(10).fill("S") as Action[],
  16: ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  15: ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  14: ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  13: ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  12: ["H", "H", "S", "S", "S", "H", "H", "H", "H", "H"],
  11: ["D", "D", "D", "D", "D", "D", "D", "D", "D", "H"],
  10: ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"],
  9: ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"],
  8: ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"],
  7: Array(10).fill("H") as Action[],
  6: Array(10).fill("H") as Action[],
};

const hardH17: Record<number, Action[]> = {
  ...hardS17,
};

const softS17: Record<number, Action[]> = {
  20: Array(10).fill("S") as Action[],
  19: ["S", "S", "S", "S", "D", "S", "S", "S", "S", "S"],
  18: ["S", "D", "D", "D", "D", "S", "S", "H", "H", "H"],
  17: ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"],
  16: ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"],
  15: ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"],
  14: ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"],
  13: ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"],
};

const softH17: Record<number, Action[]> = {
  20: Array(10).fill("S") as Action[],
  19: ["S", "S", "S", "S", "D", "S", "S", "S", "S", "S"],
  18: ["D", "D", "D", "D", "D", "S", "S", "S", "H", "H"],
  17: ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"],
  16: ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"],
  15: ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"],
  14: ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"],
  13: ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"],
};

const pairTableS17: Record<string, Action[]> = {
  AA: Array(10).fill("P") as Action[],
  1010: Array(10).fill("S") as Action[],
  99: ["P", "P", "P", "P", "P", "S", "P", "P", "S", "S"],
  88: ["P", "P", "P", "P", "P", "P", "P", "P", "P", "P"],
  77: ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"],
  66: ["P", "P", "P", "P", "P", "H", "H", "H", "H", "H"],
  55: ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"],
  44: ["H", "H", "H", "P", "P", "H", "H", "H", "H", "H"],
  33: ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"],
  22: ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"],
};

const pairTableH17 = pairTableS17;

const surrenderMap: Array<{ total: number; dealers: Card["rank"][] }> = [
  { total: 16, dealers: ["9", "10", "A"] },
  { total: 15, dealers: ["10"] },
];

function actionFromTable(table: Record<number, Action[]>, total: number, dealerIdx: number): Action {
  const row = table[total];
  if (!row) {
    return total >= 17 ? "S" : "H";
  }
  return row[dealerIdx] ?? (total >= 17 ? "S" : "H");
}

function pairAction(table: Record<string, Action[]>, rankKey: string, dealerIdx: number): Action | undefined {
  const row = table[rankKey];
  return row ? row[dealerIdx] : undefined;
}

export function basicStrategyDecision(
  hand: Hand,
  dealerUp: Card,
  rules: Rules,
  options?: { allowSplit?: boolean; allowDouble?: boolean }
): Action {
  const dealerIdx = dealerIndex(dealerUp);
  const total = bestTotal(hand);

  if (rules.surrender && hand.cards.length === 2 && !hand.isSplit) {
    const normalized = dealerUp.rank === "J" || dealerUp.rank === "Q" || dealerUp.rank === "K" ? "10" : dealerUp.rank;
    for (const entry of surrenderMap) {
      if (entry.total === total && entry.dealers.includes(normalized)) {
        return "R";
      }
    }
  }

  const allowSplit = options?.allowSplit ?? true;
  if (allowSplit && isPair(hand)) {
    const rankA = hand.cards[0].rank;
    const rankB = hand.cards[1].rank;
    const normalizedA = rankA === "J" || rankA === "Q" || rankA === "K" ? "10" : rankA;
    const normalizedB = rankB === "J" || rankB === "Q" || rankB === "K" ? "10" : rankB;
    const pairKey = `${normalizedA}${normalizedB}`;
    const pairTable = rules.s17 ? pairTableS17 : pairTableH17;
    let action = pairAction(pairTable, pairKey, dealerIdx);
    if (action === "P" && normalizedA === "4" && !rules.das) {
      action = "H";
    }
    if (action) {
      if (action === "D" && options?.allowDouble === false) {
        action = "H";
      }
      return action;
    }
  }

  if (isSoft(hand)) {
    const totals = handTotals(hand);
    const softTotals = totals.filter((t) => t <= 21);
    const maxSoft = softTotals.length > 0 ? softTotals[softTotals.length - 1] : totals[totals.length - 1];
    const table = rules.s17 ? softS17 : softH17;
    let decision = actionFromTable(table, maxSoft, dealerIdx);
    if (decision === "D" && options?.allowDouble === false) {
      decision = maxSoft >= 18 ? "S" : "H";
    }
    return decision;
  }

  const table = rules.s17 ? hardS17 : hardH17;
  let decision = actionFromTable(table, total, dealerIdx);
  if (decision === "D" && options?.allowDouble === false) {
    decision = total >= 17 ? "S" : "H";
  }
  return decision;
}
