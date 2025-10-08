export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  rank: Rank;
}

export interface Hand {
  cards: Card[];
  bet: number;
  isSplit: boolean;
  isSplitAces: boolean;
  doubled: boolean;
  surrendered: boolean;
  completed: boolean;
}

export type Action = "H" | "S" | "D" | "P" | "R";

export interface Rules {
  decks: number;
  s17: boolean;
  bjPays: "3:2" | "6:5";
  das: boolean;
  surrender: boolean;
  resplitAces: boolean;
  peek: boolean;
  penetration: number; // 0-1
}

export interface SimConfig {
  rules: Rules;
  bet: number;
  hands: number;
  seed?: number;
  trials?: number;
  betSpread?: number[];
  captureFirstTrial?: boolean;
}

export interface TrialResult {
  profit: number;
  endingBankroll: number;
  handsPlayed: number;
  bankrollHistory: number[];
  rounds?: RoundResult[];
}

export interface Stats {
  evPerHand: number;
  stdevPerHand: number;
  evRun: number;
  stdevRun: number;
  ci95: [number, number];
  riskOfRuin: number;
}

export interface Histogram {
  bins: number[];
  counts: number[];
}

export type HandOutcome = "win" | "loss" | "push" | "blackjack" | "surrender";

export interface HandResult {
  hand: Hand;
  outcome: HandOutcome;
  payout: number;
};

export type RoundEvent =
  | { type: "deal"; target: "player" | "dealer"; card: Card; handIndex: number; revealed: boolean }
  | { type: "action"; handIndex: number; action: Action }
  | { type: "result"; handIndex: number; outcome: HandOutcome; payout: number; bankroll?: number }
  | { type: "dealerReveal"; card: Card }
  | { type: "shuffle" };

export interface RoundResult {
  hands: HandResult[];
  dealerHand: Hand;
  net: number;
  events: RoundEvent[];
  dealerBlackjack: boolean;
};
