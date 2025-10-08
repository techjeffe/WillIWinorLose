import { MAX_SPLITS } from "./config";
import { addCard, bestTotal, canSplit, createHand, isBlackjack, isBust, isSoft } from "./hand";
import { Shoe } from "./shoe";
import {
  Action,
  Hand,
  HandResult,
  RoundEvent,
  RoundResult,
  Rules,
} from "./types";
import { basicStrategyDecision } from "./strategy";

function dealerShouldHit(hand: Hand, rules: Rules): boolean {
  const total = bestTotal(hand);
  if (total < 17) return true;
  if (total === 17 && !rules.s17 && isSoft(hand)) {
    return true;
  }
  return false;
}

function computeOutcome(
  hand: Hand,
  dealerHand: Hand,
  dealerBlackjack: boolean,
  rules: Rules,
  playerBlackjack: boolean
): HandResult {
  if (hand.surrendered) {
    return { hand, outcome: "surrender", payout: -hand.bet / 2 };
  }
  if (playerBlackjack) {
    if (dealerBlackjack) {
      return { hand, outcome: "push", payout: 0 };
    }
    const multiplier = rules.bjPays === "3:2" ? 1.5 : 1.2;
    return { hand, outcome: "blackjack", payout: hand.bet * multiplier };
  }
  if (isBust(hand)) {
    return { hand, outcome: "loss", payout: -hand.bet };
  }
  if (dealerBlackjack) {
    return { hand, outcome: "loss", payout: -hand.bet };
  }
  const playerTotal = bestTotal(hand);
  const dealerTotal = bestTotal(dealerHand);
  if (isBust(dealerHand)) {
    return { hand, outcome: "win", payout: hand.bet };
  }
  if (playerTotal > dealerTotal) {
    return { hand, outcome: "win", payout: hand.bet };
  }
  if (playerTotal < dealerTotal) {
    return { hand, outcome: "loss", payout: -hand.bet };
  }
  return { hand, outcome: "push", payout: 0 };
}

function normalizedRank(rank: string): string {
  return rank === "J" || rank === "Q" || rank === "K" ? "10" : rank;
}

export function playRound(
  shoe: Shoe,
  rules: Rules,
  bet: number,
  bankroll: number
): RoundResult {
  const events: RoundEvent[] = [];
  shoe.setShuffleCallback(() => {
    events.push({ type: "shuffle" });
  });
  const playerHands: Hand[] = [createHand(bet)];
  const dealerHand = createHand(0);

  const dealTo = (hand: Hand, target: "player" | "dealer", revealed: boolean, handIndex: number) => {
    const card = shoe.draw();
    addCard(hand, card);
    events.push({ type: "deal", target, card, handIndex, revealed });
    return card;
  };

  // initial deal
  dealTo(playerHands[0], "player", true, 0);
  dealTo(dealerHand, "dealer", true, 0);
  dealTo(playerHands[0], "player", true, 0);
  dealTo(dealerHand, "dealer", false, 0);

  const dealerUpCard = dealerHand.cards[0];
  const playerBlackjack = isBlackjack(playerHands[0]);
  let dealerBlackjack = false;

  if (rules.peek && (normalizedRank(dealerUpCard.rank) === "10" || dealerUpCard.rank === "A")) {
    if (isBlackjack(dealerHand)) {
      dealerBlackjack = true;
      events.push({ type: "dealerReveal", card: dealerHand.cards[1] });
    }
  }

  if (!dealerBlackjack && playerBlackjack) {
    // skip player actions, settle at end
  }

  let totalWagered = bet;

  for (let i = 0; i < playerHands.length; i += 1) {
    let hand = playerHands[i];
    if (playerBlackjack) {
      hand.completed = true;
      continue;
    }
    while (!hand.completed) {
      if (isBust(hand)) {
        hand.completed = true;
        break;
      }
      const allowDouble =
        hand.cards.length === 2 &&
        (!hand.isSplit || rules.das) &&
        !hand.isSplitAces &&
        totalWagered + hand.bet <= bankroll;
      const allowSplit =
        hand.cards.length === 2 &&
        playerHands.length < MAX_SPLITS &&
        canSplit(hand, rules, playerHands.length) &&
        totalWagered + hand.bet <= bankroll;
      let action: Action = basicStrategyDecision(hand, dealerUpCard, rules, {
        allowSplit,
        allowDouble,
      });
      if (action === "P" && !allowSplit) {
        action = basicStrategyDecision(hand, dealerUpCard, rules, {
          allowSplit: false,
          allowDouble,
        });
      }
      if (action === "D" && !allowDouble) {
        action = basicStrategyDecision(hand, dealerUpCard, rules, {
          allowSplit,
          allowDouble: false,
        });
      }

      events.push({ type: "action", handIndex: i, action });

      if (action === "S") {
        hand.completed = true;
        break;
      }
      if (action === "R") {
        hand.surrendered = true;
        hand.completed = true;
        break;
      }
      if (action === "H") {
        dealTo(hand, "player", true, i);
        if (isBust(hand)) {
          hand.completed = true;
        }
        continue;
      }
      if (action === "D") {
        totalWagered += hand.bet;
        hand.bet *= 2;
        hand.doubled = true;
        dealTo(hand, "player", true, i);
        hand.completed = true;
        break;
      }
      if (action === "P") {
        const [first, second] = hand.cards;
        const newHandA = createHand(hand.bet);
        const newHandB = createHand(hand.bet);
        newHandA.cards = [first];
        newHandB.cards = [second];
        newHandA.isSplit = true;
        newHandB.isSplit = true;
        if (first.rank === "A") {
          newHandA.isSplitAces = true;
          newHandB.isSplitAces = true;
        }
        totalWagered += hand.bet;
        playerHands.splice(i, 1, newHandA, newHandB);
        // Deal next card to the current hand
        hand = playerHands[i];
        dealTo(hand, "player", true, i);
        if (hand.isSplitAces) {
          hand.completed = true;
        }
        // ensure the other split hand has a card ready when its turn comes
        const nextHand = playerHands[i + 1];
        dealTo(nextHand, "player", true, i + 1);
        if (nextHand.isSplitAces) {
          nextHand.completed = true;
        }
        // restart loop for current hand after split
        continue;
      }
    }
  }

  if (!dealerBlackjack) {
    events.push({ type: "dealerReveal", card: dealerHand.cards[1] });
    if (isBlackjack(dealerHand)) {
      dealerBlackjack = true;
    }
  }

  const activeHands = playerHands.filter((hand) => !hand.surrendered && !isBust(hand));
  let dealerNeeded = activeHands.length > 0 && !playerBlackjack;
  if (dealerBlackjack) {
    dealerNeeded = false;
  }

  if (dealerNeeded) {
    while (dealerShouldHit(dealerHand, rules)) {
      dealTo(dealerHand, "dealer", true, 0);
    }
  }

  const hands: HandResult[] = [];
  for (let i = 0; i < playerHands.length; i += 1) {
    const hand = playerHands[i];
    const result = computeOutcome(hand, dealerHand, dealerBlackjack, rules, playerBlackjack && i === 0 && !hand.isSplit);
    hands.push(result);
    events.push({ type: "result", handIndex: i, outcome: result.outcome, payout: result.payout });
  }

  const net = hands.reduce((acc, h) => acc + h.payout, 0);

  return {
    hands,
    dealerHand,
    net,
    events,
    dealerBlackjack,
  };
}
