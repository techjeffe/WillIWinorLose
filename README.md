# Perfect Blackjack Bankroll Simulator

A Vite + React + TypeScript single-page app that plays basic-strategy blackjack against a multi-deck shoe, tracks bankroll decisions hand-by-hand, and performs fast Monte-Carlo simulations in a Web Worker. The simulation core is implemented in pure TypeScript under `core/` so it can be reused outside the UI.

## Getting started

```bash
npm install
npm run dev
```

The development server runs on [http://localhost:5173](http://localhost:5173) by default.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite in development mode. |
| `npm run build` | Type-check and create a production build. |
| `npm run preview` | Preview the production build locally. |
| `npm run test` | Execute the Vitest unit test suite. |

## Features

- **Deterministic shoe** with configurable decks, blackjack payouts, surrender, DAS, resplitting aces, and penetration.
- **Basic-strategy engine** (S17/H17 aware) covering hard, soft, and pair decisions with surrender support.
- **Play mode** animates each card and action, tracks bankroll, and shows the full decision log.
- **Simulate mode** offloads Monte-Carlo trials to a Web Worker and reports EV, variance, 95% confidence interval, risk of ruin, and histogram/time-series charts.
- **Responsive histogram** renders on a high-DPI canvas that stretches with the layout and includes a vertical scale control for zooming into distribution tails.
- **Unified hand history** logs every animated round and the first trial of each simulation, making it easy to review outcomes alongside bankroll changes.
- **Seeded RNG** (Mulberry32) for reproducible runs shared between play and simulate modes.
- **CSV export** of trial-level simulation results.
- **Unit tests** for strategy edges, payouts (blackjack, doubles, splits, surrender), dealer rule differences, and shoe penetration reshuffles.

## Notes

- The fast simulation can comfortably handle 100k+ hands × many trials thanks to the worker and pure TypeScript core.
- A seed value ensures that the animated play mode consumes the same shoe order as the worker simulation.
- The simulation core can be consumed programmatically via the exports in `core/index.ts` (see `simulateRun`, `playRound`, and related types).

## Project structure

```
core/        # Pure simulation engine (shoe, strategy, payouts, stats)
src/ui/      # React UI components and worker wrapper
src/ui/workers/  # Dedicated Monte-Carlo worker entry
tests/       # Vitest unit tests for strategy, payouts, and shoe behavior
```
