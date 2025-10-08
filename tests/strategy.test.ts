import { describe, expect, it } from "vitest";
import { basicStrategyDecision, createHand, addCard, DEFAULT_RULES, Rules, Card, Rank } from "../core";

const card = (rank: Rank | string): Card => ({ rank: rank as Rank });

const defaultRules: Rules = { ...DEFAULT_RULES };

describe("basic strategy edge cases", () => {
  it("plays hard 12 correctly vs dealer small cards", () => {
    const hand = createHand(10);
    addCard(hand, card("10"));
    addCard(hand, card("2"));
    expect(basicStrategyDecision(hand, card("2"), defaultRules)).toBe("H");
    expect(basicStrategyDecision(hand, card("4"), defaultRules)).toBe("S");
  });

  it("handles soft 18 decisions", () => {
    const hand = createHand(10);
    addCard(hand, card("A"));
    addCard(hand, card("7"));
    expect(basicStrategyDecision(hand, card("2"), defaultRules)).toBe("S");
    expect(basicStrategyDecision(hand, card("9"), defaultRules)).toBe("H");
  });

  it("splits 9s against weak dealers and stands vs 7", () => {
    const hand = createHand(10);
    addCard(hand, card("9"));
    addCard(hand, card("9"));
    expect(basicStrategyDecision(hand, card("6"), defaultRules)).toBe("P");
    expect(basicStrategyDecision(hand, card("7"), defaultRules)).toBe("S");
  });
});
