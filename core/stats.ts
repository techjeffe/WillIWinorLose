export interface RunningStats {
  count: number;
  mean: number;
  m2: number;
}

export function createRunningStats(): RunningStats {
  return { count: 0, mean: 0, m2: 0 };
}

export function push(stats: RunningStats, value: number) {
  stats.count += 1;
  const delta = value - stats.mean;
  stats.mean += delta / stats.count;
  const delta2 = value - stats.mean;
  stats.m2 += delta * delta2;
}

export function variance(stats: RunningStats): number {
  if (stats.count < 2) return 0;
  return stats.m2 / (stats.count - 1);
}

export function stdev(stats: RunningStats): number {
  return Math.sqrt(variance(stats));
}

export function confidenceInterval(mean: number, stdev: number, samples: number, z = 1.96): [number, number] {
  if (samples === 0) return [mean, mean];
  const margin = (stdev / Math.sqrt(samples)) * z;
  return [mean - margin, mean + margin];
}

export function riskOfRuinApprox(evPerHand: number, variancePerHand: number, bankroll: number, bet: number): number {
  if (evPerHand >= 0) return 0;
  if (variancePerHand <= 0) return 1;
  const edgePerUnit = evPerHand / bet;
  const varianceUnits = variancePerHand / (bet * bet);
  const exponent = (2 * edgePerUnit * bankroll) / varianceUnits;
  const risk = Math.exp(exponent);
  return Math.min(1, Math.max(0, risk));
}
