export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed?: number): RNG {
  if (seed === undefined) {
    return Math.random;
  }
  return mulberry32(seed);
}
