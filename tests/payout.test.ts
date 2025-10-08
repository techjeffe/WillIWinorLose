import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  Rules,
  playRound,
  Card,
  Shoe,
} from "../core";

const makeCard = (rank: Card["rank"]): Card => ({ rank });

class MockShoe {
  private index = 0;
  private cb: (() => void) | undefined;
  constructor(private cards: Card[]) {}
  draw(): Card {
    if (this.index >= this.cards.length) {
      if (this.cb) this.cb();
      throw new Error("Out of cards");
    }
    return this.cards[this.index++];
  }
  setShuffleCallback(cb?: () => void) {
    this.cb = cb;
  }
}

const makeShoe = (ranks: Card["rank"][]): Shoe => {
  const cards = ranks.map((rank) => makeCard(rank));
  return new MockShoe(cards) as unknown as Shoe;
};

describe("round payouts", () => {
  const bet = 10;

  it("pays blackjack at 3:2", () => {
    const rules: Rules = { ...DEFAULT_RULES };
    const shoe = makeShoe(["A", "9", "K", "5"]);
    const round = playRound(shoe, rules, bet, 1000);
    expect(round.hands[0].outcome).toBe("blackjack");
    expect(round.net).toBeCloseTo(15);
  });

  it("doubles down and wins", () => {
    const rules: Rules = { ...DEFAULT_RULES };
    const shoe = makeShoe(["6", "6", "5", "10", "10", "9"]);
    const round = playRound(shoe, rules, bet, 1000);
    expect(round.hands[0].doubled).toBe(true);
    expect(round.net).toBe(20);
  });

  it("splits pairs into two hands", () => {
    const rules: Rules = { ...DEFAULT_RULES };
    const shoe = makeShoe(["8", "6", "8", "10", "10", "9", "7"]);
    const round = playRound(shoe, rules, bet, 1000);
    expect(round.hands).toHaveLength(2);
    expect(round.hands[0].hand.isSplit).toBe(true);
    expect(round.hands[1].hand.isSplit).toBe(true);
    expect(round.net).toBe(20);
  });

  it("allows late surrender", () => {
    const rules: Rules = { ...DEFAULT_RULES, surrender: true };
    const shoe = makeShoe(["10", "10", "6", "9"]);
    const round = playRound(shoe, rules, bet, 1000);
    expect(round.hands[0].hand.surrendered).toBe(true);
    expect(round.net).toBe(-bet / 2);
  });
});

describe("dealer rules", () => {
  const bet = 10;
  const baseSequence: Card["rank"][] = ["10", "A", "7", "6", "5"];

  it("stands on soft 17 with S17", () => {
    const rules: Rules = { ...DEFAULT_RULES, s17: true };
    const shoe = makeShoe(baseSequence);
    const round = playRound(shoe, rules, bet, 1000);
    expect(round.dealerHand.cards).toHaveLength(2);
  });

  it("hits soft 17 with H17", () => {
    const rules: Rules = { ...DEFAULT_RULES, s17: false };
    const shoe = makeShoe(baseSequence);
    const round = playRound(shoe, rules, bet, 1000);
    expect(round.dealerHand.cards.length).toBeGreaterThan(2);
  });
});
