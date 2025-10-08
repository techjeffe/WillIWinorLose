import { Card, Hand } from "./types";

export function createHand(bet: number): Hand {
  return {
    cards: [],
    bet,
    isSplit: false,
    isSplitAces: false,
    doubled: false,
    surrendered: false,
    completed: false,
  };
}

export function cloneHand(hand: Hand): Hand {
  return {
    cards: [...hand.cards],
    bet: hand.bet,
    isSplit: hand.isSplit,
    isSplitAces: hand.isSplitAces,
    doubled: hand.doubled,
    surrendered: hand.surrendered,
    completed: hand.completed,
  };
}

export function addCard(hand: Hand, card: Card): void {
  hand.cards.push(card);
}

export function cardValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (card.rank === "K" || card.rank === "Q" || card.rank === "J" || card.rank === "10") {
    return 10;
  }
  return Number(card.rank);
}

export function handTotals(hand: Hand): number[] {
  let total = 0;
  let aces = 0;
  for (const card of hand.cards) {
    total += cardValue(card);
    if (card.rank === "A") aces += 1;
  }
  const totals = [total];
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
    totals.push(total);
  }
  if (aces > 0) {
    // Add remaining soft totals (if any) less than 21
    let softTotal = totals[0];
    for (let i = 0; i < aces; i += 1) {
      softTotal -= 10;
      if (!totals.includes(softTotal)) totals.push(softTotal);
    }
  }
  return [...new Set(totals)].sort((a, b) => a - b);
}

export function bestTotal(hand: Hand): number {
  const totals = handTotals(hand);
  const valid = totals.filter((t) => t <= 21);
  return valid.length > 0 ? Math.max(...valid) : Math.min(...totals);
}

export function isSoft(hand: Hand): boolean {
  const totals = handTotals(hand);
  return totals.some((t) => t <= 21 && t !== totals[totals.length - 1]);
}

export function isBlackjack(hand: Hand): boolean {
  return hand.cards.length === 2 && bestTotal(hand) === 21;
}

export function isBust(hand: Hand): boolean {
  return bestTotal(hand) > 21;
}

export function canSplit(hand: Hand, rules: { resplitAces: boolean }, handsCount: number): boolean {
  if (hand.cards.length !== 2) return false;
  if (handsCount >= 4) return false;
  const [a, b] = hand.cards;
  if (a.rank === "A" && !rules.resplitAces && hand.isSplitAces) {
    return false;
  }
  const valueA = cardValue(a);
  const valueB = cardValue(b);
  return valueA === valueB || a.rank === b.rank;
}

export function isPair(hand: Hand): boolean {
  return hand.cards.length === 2 && cardValue(hand.cards[0]) === cardValue(hand.cards[1]);
}

export function isSoftTotal(hand: Hand, total: number): boolean {
  if (!isSoft(hand)) return false;
  return handTotals(hand).includes(total);
}
