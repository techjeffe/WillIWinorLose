import { Card, Rank, Rules } from "./types";
import { RNG } from "./rng";

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export class Shoe {
  private cards: Card[] = [];
  private index = 0;
  private readonly rng: RNG;
  private readonly rules: Rules;
  private penetrationCount: number;
  private onShuffle?: () => void;

  constructor(rules: Rules, rng: RNG, onShuffle?: () => void) {
    this.rules = rules;
    this.rng = rng;
    this.onShuffle = onShuffle;
    this.penetrationCount = 0;
    this.shuffle();
  }

  setShuffleCallback(cb: (() => void) | undefined) {
    this.onShuffle = cb;
  }

  private shuffle() {
    this.cards = [];
    for (let d = 0; d < this.rules.decks; d += 1) {
      for (const rank of RANKS) {
        for (let i = 0; i < 4; i += 1) {
          this.cards.push({ rank });
        }
      }
    }
    for (let i = this.cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.index = 0;
    this.penetrationCount = Math.min(
      this.cards.length,
      Math.max(1, Math.floor(this.cards.length * this.rules.penetration))
    );
    if (this.onShuffle) {
      this.onShuffle();
    }
  }

  draw(): Card {
    if (this.index >= this.cards.length || this.index >= this.penetrationCount) {
      this.shuffle();
    }
    return this.cards[this.index++];
  }

  remaining(): number {
    return this.cards.length - this.index;
  }
}
