import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, Shoe, createRng } from "../core";

describe("shoe penetration", () => {
  it("reshuffles once cut card reached", () => {
    const rules = { ...DEFAULT_RULES, decks: 1, penetration: 0.5 };
    const events: string[] = [];
    const shoe = new Shoe(rules, createRng(1));
    shoe.setShuffleCallback(() => events.push("shuffle"));
    const threshold = Math.floor(52 * rules.penetration);
    for (let i = 0; i < threshold; i += 1) {
      shoe.draw();
    }
    shoe.draw();
    expect(events.length).toBeGreaterThan(0);
  });
});
