# Agent Guidelines

## Scope
These rules apply to the entire repository unless a more specific `AGENTS.md` is added deeper in the tree.

## General expectations
- Preserve the split between the pure simulation engine under `core/` and the React UI under `src/ui/`. Do not introduce DOM-specific logic into `core/` files.
- Keep TypeScript strict and type-safe. Prefer explicit return types on exported functions and avoid `any`.
- Use named exports for modules; only create default exports for React components that must be consumed via default import patterns (e.g., `App`).
- When adding configuration or feature toggles, thread them through the existing types in `core/types.ts` and ensure both `simulateRun` and the UI stay in sync.
- Document non-trivial strategy decisions or mathematical formulas with comments referencing the source when possible.

## React/UI conventions (`src/ui/`)
- Implement components as functional components with React hooks.
- Co-locate UI-specific helpers within `src/ui/` and keep them pure unless they intentionally interact with the DOM or browser APIs.
- Prefer Tailwind utility classes that already exist in the project; define new CSS only when the utility approach is insufficient.

## Core engine conventions (`core/`)
- Maintain deterministic behavior by routing all randomness through the PRNG utilities in `core/rng.ts`.
- Keep public functions pure: avoid mutating inputs or relying on external state.
- Update or extend the Vitest suites in `tests/` whenever you change game rules, payouts, or strategy tables.

## Testing and build
- Run `npm run test` for unit coverage and `npm run build` to ensure the TypeScript build passes when dependencies are available.
- If either command cannot be executed (e.g., missing system dependencies), note that in your final message.

## Documentation
- Update `README.md` whenever you introduce new commands, configuration options, or notable features.
