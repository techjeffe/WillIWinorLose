import { Rules } from "./types";

export const DEFAULT_RULES: Rules = {
  decks: 6,
  s17: true,
  bjPays: "3:2",
  das: true,
  surrender: false,
  resplitAces: false,
  peek: true,
  penetration: 0.75,
};

export const MAX_SPLITS = 4;
