import { createRng } from "./rng";
import { Shoe } from "./shoe";
import { playRound } from "./game";
import { Histogram, SimConfig, Stats, TrialResult } from "./types";
import { confidenceInterval, createRunningStats, push, riskOfRuinApprox, stdev } from "./stats";

function buildHistogram(values: number[], binCount = 21): Histogram {
  if (values.length === 0) {
    return { bins: [], counts: [] };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const bins = Array.from({ length: binCount }, (_, i) => min + (range / binCount) * (i + 0.5));
  const counts = Array(binCount).fill(0);
  for (const value of values) {
    const idx = Math.min(
      binCount - 1,
      Math.max(0, Math.floor(((value - min) / range) * binCount))
    );
    counts[idx] += 1;
  }
  return { bins, counts };
}

export function simulateRun(cfg: SimConfig, bankroll: number): {
  results: TrialResult[];
  stats: Stats;
  histogram: Histogram;
} {
  const trials = cfg.trials ?? 1;
  const rng = createRng(cfg.seed);
  const results: TrialResult[] = [];

  const handStats = createRunningStats();
  const runStats = createRunningStats();

  for (let t = 0; t < trials; t += 1) {
    const shoe = new Shoe(cfg.rules, rng);
    let currentBankroll = bankroll;
    let handsPlayed = 0;
    const history = [currentBankroll];
    while (handsPlayed < cfg.hands && currentBankroll >= cfg.bet) {
      const round = playRound(shoe, cfg.rules, cfg.bet, currentBankroll);
      currentBankroll += round.net;
      history.push(currentBankroll);
      handsPlayed += 1;
      push(handStats, round.net);
    }
    const profit = currentBankroll - bankroll;
    push(runStats, profit);
    results.push({
      profit,
      endingBankroll: currentBankroll,
      handsPlayed,
      bankrollHistory: history,
    });
  }

  const evPerHand = handStats.count > 0 ? handStats.mean : 0;
  const stdevPerHand = stdev(handStats);
  const evRun = runStats.count > 0 ? runStats.mean : 0;
  const stdevRun = stdev(runStats);
  const ci95 = confidenceInterval(evRun, stdevRun, runStats.count);
  const variancePerHand = stdevPerHand * stdevPerHand;
  const riskOfRuin = riskOfRuinApprox(evPerHand, variancePerHand, bankroll, cfg.bet);
  const histogram = buildHistogram(results.map((r) => r.profit), Math.min(41, Math.max(11, trials)));

  const stats: Stats = {
    evPerHand,
    stdevPerHand,
    evRun,
    stdevRun,
    ci95,
    riskOfRuin,
  };

  return { results, stats, histogram };
}
