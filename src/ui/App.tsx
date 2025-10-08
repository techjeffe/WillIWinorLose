import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_RULES,
  Hand,
  HandResult,
  Histogram,
  RoundEvent,
  RoundResult,
  Rules,
  SimConfig,
  Stats,
  TrialResult,
  createRng,
  playRound,
  Shoe,
} from "../../core";

const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
});

function cardsToString(hand: Hand): string {
  return hand.cards.map((card) => card.rank).join(" ");
}

function formatHandResultLine(hand: HandResult, index: number): string {
  const prefix = hand.hand.doubled ? "Double" : hand.hand.isSplit ? "Split" : "Hand";
  const cards = cardsToString(hand.hand);
  const payout = `${hand.payout >= 0 ? "+" : ""}${hand.payout.toFixed(2)}`;
  return `${prefix} ${index + 1}: ${hand.outcome} (${payout}) [${cards}]`;
}

const dealerActionLabel: Record<RoundEvent["type"], string> = {
  deal: "Deal",
  action: "Action",
  result: "Result",
  dealerReveal: "Dealer Reveal",
  shuffle: "Shuffle",
};

type Mode = "play" | "simulate";

const PLAY_DELAY_MS = 350;
const MAX_LOG_ENTRIES = 500;

type LogSource = "play" | "simulate";

interface RoundLogEntry {
  kind: "round";
  id: number;
  source: LogSource;
  trial?: number;
  handNumber: number;
  net: number;
  hands: HandResult[];
  dealerHand: Hand;
  bankrollAfter?: number;
}

interface SimulationSummaryLogEntry {
  kind: "summary";
  id: number;
  source: "simulate";
  trial: number;
  profit: number;
  endingBankroll: number;
  handsPlayed: number;
}

type LogEntry = RoundLogEntry | SimulationSummaryLogEntry;
type LogEntryDraft =
  | Omit<RoundLogEntry, "id">
  | Omit<SimulationSummaryLogEntry, "id">;

function formatEvent(event: RoundEvent): string {
  switch (event.type) {
    case "deal":
      return `${event.target === "player" ? "Player" : "Dealer"} ${event.revealed ? "receives" : "takes"} ${event.card.rank}`;
    case "action":
      return `Hand ${event.handIndex + 1}: ${
        event.action === "H"
          ? "Hit"
          : event.action === "S"
          ? "Stand"
          : event.action === "D"
          ? "Double"
          : event.action === "P"
          ? "Split"
          : "Surrender"
      }`;
    case "result":
      return `Hand ${event.handIndex + 1}: ${event.outcome} (${event.payout >= 0 ? "+" : ""}${event.payout.toFixed(2)})`;
    case "dealerReveal":
      return `Dealer reveals ${event.card.rank}`;
    case "shuffle":
      return "Shuffle";
  }
}

function HouseEdge({ evPerHand, bet }: { evPerHand: number; bet: number }) {
  if (bet === 0) return <span>0%</span>;
  const edge = -(evPerHand / bet);
  return <span>{percentFormatter.format(edge)}</span>;
}

function HistogramChart({ histogram }: { histogram: Histogram }) {
  if (histogram.counts.length === 0) {
    return <p className="text-sm text-slate-400">Run a simulation to see the distribution.</p>;
  }
  const width = 420;
  const height = 160;
  const maxCount = Math.max(...histogram.counts);
  const barWidth = width / histogram.counts.length;
  return (
    <svg width={width} height={height} className="bg-slate-900 rounded-md">
      {histogram.counts.map((count, idx) => {
        const barHeight = maxCount === 0 ? 0 : (count / maxCount) * (height - 20);
        const x = idx * barWidth;
        const y = height - barHeight - 10;
        return (
          <g key={idx}>
            <rect
              x={x + 4}
              y={y}
              width={barWidth - 8}
              height={barHeight}
              className="fill-emerald-400/80"
            />
            <text x={x + barWidth / 2} y={height - 2} textAnchor="middle" className="fill-slate-400 text-[10px]">
              {Math.round(histogram.bins[idx])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BankrollChart({ history }: { history: number[] }) {
  if (history.length <= 1) {
    return <p className="text-sm text-slate-400">First trial bankroll path will appear here.</p>;
  }
  const width = 420;
  const height = 160;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const stepX = width / (history.length - 1);
  const points = history
    .map((value, idx) => {
      const x = idx * stepX;
      const y = height - ((value - min) / range) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="bg-slate-900 rounded-md">
      <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth={2} />
    </svg>
  );
}

function StatsPanel({ stats, bet }: { stats: Stats; bet: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="bg-slate-900/70 rounded-lg p-4">
        <h3 className="text-slate-200 font-semibold mb-2">Expected Value</h3>
        <p className="text-emerald-400 text-lg">{numberFormatter.format(stats.evRun)}</p>
        <p className="text-slate-400">Per hand: {numberFormatter.format(stats.evPerHand)}</p>
        <p className="text-slate-400">House edge: <HouseEdge evPerHand={stats.evPerHand} bet={bet} /></p>
      </div>
      <div className="bg-slate-900/70 rounded-lg p-4">
        <h3 className="text-slate-200 font-semibold mb-2">Volatility</h3>
        <p className="text-slate-400">σ / hand: {numberFormatter.format(stats.stdevPerHand)}</p>
        <p className="text-slate-400">σ / run: {numberFormatter.format(stats.stdevRun)}</p>
        <p className="text-slate-400">
          95% CI: {numberFormatter.format(stats.ci95[0])} … {numberFormatter.format(stats.ci95[1])}
        </p>
      </div>
      <div className="bg-slate-900/70 rounded-lg p-4">
        <h3 className="text-slate-200 font-semibold mb-2">Risk</h3>
        <p className="text-slate-400">Risk of ruin: {percentFormatter.format(stats.riskOfRuin)}</p>
      </div>
    </div>
  );
}

interface SimulationOutput {
  stats: Stats;
  histogram: Histogram;
  results: TrialResult[];
}

export default function App() {
  const [mode, setMode] = useState<Mode>("play");
  const [initialBankroll, setInitialBankroll] = useState(1000);
  const [currentBankroll, setCurrentBankroll] = useState(1000);
  const [bet, setBet] = useState(10);
  const [handsToPlay, setHandsToPlay] = useState(10);
  const [trials, setTrials] = useState(1000);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [seed, setSeed] = useState<number | undefined>(1);
  const [seedInput, setSeedInput] = useState("1");
  const [displayedEvents, setDisplayedEvents] = useState<RoundEvent[]>([]);
  const [lastRound, setLastRound] = useState<RoundResult | null>(null);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulation, setSimulation] = useState<SimulationOutput | null>(null);
  const [handLog, setHandLog] = useState<LogEntry[]>([]);
  const [logTrimmed, setLogTrimmed] = useState(false);

  const rngRef = useRef(createRng(seed));
  const shoeRef = useRef<Shoe | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const bankrollRef = useRef(currentBankroll);
  const logCounterRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const handsPlayedRef = useRef(handsPlayed);

  useEffect(() => {
    bankrollRef.current = currentBankroll;
  }, [currentBankroll]);

  useEffect(() => {
    handsPlayedRef.current = handsPlayed;
  }, [handsPlayed]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [handLog]);

  const appendLogEntries = useCallback((entries: LogEntryDraft[]) => {
    if (entries.length === 0) return;
    let nextId = logCounterRef.current;
    const withIds = entries.map((entry) => {
      const item = { ...entry, id: nextId } as LogEntry;
      nextId += 1;
      return item;
    });
    logCounterRef.current = nextId;
    let trimmed = false;
    setHandLog((prev) => {
      const combined = [...prev, ...withIds];
      if (combined.length > MAX_LOG_ENTRIES) {
        trimmed = true;
        return combined.slice(combined.length - MAX_LOG_ENTRIES);
      }
      return combined;
    });
    if (trimmed) {
      setLogTrimmed(true);
    }
  }, []);

  const clearLog = useCallback(() => {
    setHandLog([]);
    setLogTrimmed(false);
    logCounterRef.current = 0;
  }, []);

  const initializeEngine = useCallback(() => {
    rngRef.current = createRng(seed);
    shoeRef.current = new Shoe(rules, rngRef.current);
    setCurrentBankroll(initialBankroll);
    bankrollRef.current = initialBankroll;
    setHandsPlayed(0);
    setDisplayedEvents([]);
    setLastRound(null);
  }, [initialBankroll, rules, seed]);

  useEffect(() => {
    initializeEngine();
  }, [initializeEngine]);

  const ensureWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("./workers/simulatorWorker.ts", import.meta.url), {
        type: "module",
      });
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const animateEvents = useCallback(async (events: RoundEvent[]) => {
    setDisplayedEvents([]);
    for (const event of events) {
      setDisplayedEvents((prev) => [...prev, event]);
      await new Promise((resolve) => setTimeout(resolve, PLAY_DELAY_MS));
    }
  }, []);

  const handleReset = useCallback(() => {
    initializeEngine();
    setSimulation(null);
    setIsSimulating(false);
    setMode("play");
    clearLog();
  }, [clearLog, initializeEngine]);

  const playHands = useCallback(
    async (count: number) => {
      if (isPlaying) return;
      if (!shoeRef.current) {
        initializeEngine();
      }
      if (!shoeRef.current) return;
      setMode("play");
      setIsPlaying(true);
      const startIndex = handsPlayedRef.current;
      try {
        for (let i = 0; i < count; i += 1) {
          if (bankrollRef.current < bet) {
            break;
          }
          const round = playRound(shoeRef.current, rules, bet, bankrollRef.current);
          await animateEvents(round.events);
          setLastRound(round);
          bankrollRef.current += round.net;
          const newBankroll = bankrollRef.current;
          setCurrentBankroll(newBankroll);
          setHandsPlayed((prev) => prev + 1);
          appendLogEntries([
            {
              kind: "round",
              source: "play",
              handNumber: startIndex + i + 1,
              net: round.net,
              hands: round.hands,
              dealerHand: round.dealerHand,
              bankrollAfter: newBankroll,
            },
          ]);
        }
      } finally {
        setIsPlaying(false);
      }
    },
    [animateEvents, appendLogEntries, bet, initializeEngine, isPlaying, rules]
  );

  const handleSimulate = useCallback(() => {
    const worker = ensureWorker();
    setMode("simulate");
    setIsSimulating(true);
    setSimulation(null);
    const config: SimConfig = {
      rules,
      bet,
      hands: handsToPlay,
      seed,
      trials,
      captureFirstTrial: true,
    };
    worker.onmessage = (event: MessageEvent<SimulationOutput>) => {
      const payload = event.data;
      setSimulation(payload);
      setIsSimulating(false);
      const entries: LogEntryDraft[] = [];
      const firstTrial = payload.results[0];
      if (firstTrial?.rounds) {
        let runningBankroll = initialBankroll;
        firstTrial.rounds.forEach((round, idx) => {
          runningBankroll += round.net;
          entries.push({
            kind: "round",
            source: "simulate",
            trial: 1,
            handNumber: idx + 1,
            net: round.net,
            hands: round.hands,
            dealerHand: round.dealerHand,
            bankrollAfter: runningBankroll,
          });
        });
      }
      payload.results.forEach((trial, idx) => {
        entries.push({
          kind: "summary",
          source: "simulate",
          trial: idx + 1,
          profit: trial.profit,
          endingBankroll: trial.endingBankroll,
          handsPlayed: trial.handsPlayed,
        });
      });
      appendLogEntries(entries);
    };
    worker.postMessage({ config, bankroll: initialBankroll });
  }, [appendLogEntries, ensureWorker, rules, bet, handsToPlay, seed, trials, initialBankroll]);

  const handleExport = useCallback(() => {
    if (!simulation) return;
    const rows = ["trial,profit,endingBankroll,handsPlayed"].concat(
      simulation.results.map((trial, idx) => `${idx + 1},${trial.profit.toFixed(2)},${trial.endingBankroll.toFixed(2)},${trial.handsPlayed}`)
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "blackjack-simulation.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [simulation]);

  const firstHistory = simulation?.results[0]?.bankrollHistory ?? [];

  const canPlay = bet > 0 && currentBankroll >= bet;

  const updateRule = useCallback(
    <K extends keyof Rules>(key: K, value: Rules[K]) => {
      setRules((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const seedValid = useMemo(() => {
    if (seedInput.trim() === "") return true;
    return !Number.isNaN(Number(seedInput));
  }, [seedInput]);

  return (
    <div className="min-h-screen pb-12">
      <header className="py-10 text-center">
        <h1 className="text-3xl font-bold text-emerald-400">Perfect Blackjack Bankroll Simulator</h1>
        <p className="text-slate-300 mt-2">Basic-strategy, multi-deck blackjack with seeded Monte-Carlo simulation.</p>
      </header>
      <main className="max-w-6xl mx-auto px-4 space-y-10">
        <section className="bg-slate-900/60 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold text-slate-100">Game & Bankroll Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col text-sm font-medium text-slate-200">
              Bankroll
              <input
                type="number"
                min={1}
                className="mt-1 rounded-md bg-slate-100 px-3 py-2"
                value={initialBankroll}
                onChange={(e) => setInitialBankroll(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-200">
              Flat bet / hand
              <input
                type="number"
                min={1}
                className="mt-1 rounded-md bg-slate-100 px-3 py-2"
                value={bet}
                onChange={(e) => setBet(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-200">
              Hands per run
              <input
                type="number"
                min={1}
                className="mt-1 rounded-md bg-slate-100 px-3 py-2"
                value={handsToPlay}
                onChange={(e) => setHandsToPlay(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-200">
              Trials (simulate)
              <input
                type="number"
                min={1}
                className="mt-1 rounded-md bg-slate-100 px-3 py-2"
                value={trials}
                onChange={(e) => setTrials(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-200">
              Seed (optional)
              <input
                type="text"
                className={`mt-1 rounded-md px-3 py-2 ${seedValid ? "bg-slate-100" : "bg-rose-200"}`}
                value={seedInput}
                onChange={(e) => {
                  setSeedInput(e.target.value);
                  if (e.target.value.trim() === "") {
                    setSeed(undefined);
                  } else if (!Number.isNaN(Number(e.target.value))) {
                    setSeed(Number(e.target.value));
                  }
                }}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-100">
            <label className="flex flex-col gap-1">
              Decks
              <select
                className="rounded-md bg-slate-100 px-3 py-2 text-slate-900"
                value={rules.decks}
                onChange={(e) => updateRule("decks", Number(e.target.value) as Rules["decks"]) }
              >
                {[1, 2, 4, 6, 8].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Dealer stands on soft 17
              <select
                className="rounded-md bg-slate-100 px-3 py-2 text-slate-900"
                value={rules.s17 ? "S17" : "H17"}
                onChange={(e) => updateRule("s17", e.target.value === "S17")}
              >
                <option value="S17">S17</option>
                <option value="H17">H17</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Blackjack payout
              <select
                className="rounded-md bg-slate-100 px-3 py-2 text-slate-900"
                value={rules.bjPays}
                onChange={(e) => updateRule("bjPays", e.target.value as Rules["bjPays"])}
              >
                <option value="3:2">3 : 2</option>
                <option value="6:5">6 : 5</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Allow surrender
              <select
                className="rounded-md bg-slate-100 px-3 py-2 text-slate-900"
                value={rules.surrender ? "yes" : "no"}
                onChange={(e) => updateRule("surrender", e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Resplit aces
              <select
                className="rounded-md bg-slate-100 px-3 py-2 text-slate-900"
                value={rules.resplitAces ? "yes" : "no"}
                onChange={(e) => updateRule("resplitAces", e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Penetration
              <input
                type="range"
                min={0.5}
                max={0.95}
                step={0.01}
                value={rules.penetration}
                onChange={(e) => updateRule("penetration", Number(e.target.value) as Rules["penetration"])}
              />
              <span className="text-xs text-slate-400">{(rules.penetration * 100).toFixed(0)}%</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-md disabled:opacity-40"
              onClick={() => playHands(1)}
              disabled={!canPlay || isPlaying}
            >
              Play 1 hand
            </button>
            <button
              className="px-4 py-2 bg-emerald-500/80 hover:bg-emerald-400 text-slate-900 font-semibold rounded-md disabled:opacity-40"
              onClick={() => playHands(handsToPlay)}
              disabled={!canPlay || isPlaying}
            >
              Play {handsToPlay} hands
            </button>
            <button
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold rounded-md disabled:opacity-40"
              onClick={handleSimulate}
              disabled={isSimulating}
            >
              {isSimulating ? "Simulating…" : "Simulate (fast)"}
            </button>
            <button
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-md"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Animated play uses the same deterministic shoe as the fast Monte-Carlo run when a seed is supplied.
          </p>
        </section>

        {mode === "simulate" && (
          <section className="bg-slate-900/60 rounded-xl p-6 space-y-6">
            <h2 className="text-xl font-semibold text-slate-100">Simulation mode</h2>
            {simulation ? (
              <>
                <StatsPanel stats={simulation.stats} bet={bet} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-slate-200 font-semibold mb-2">Outcome histogram</h3>
                    <HistogramChart histogram={simulation.histogram} />
                  </div>
                  <div>
                    <h3 className="text-slate-200 font-semibold mb-2">First trial bankroll</h3>
                    <BankrollChart history={firstHistory} />
                  </div>
                </div>
                <button
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-md"
                  onClick={handleExport}
                >
                  Export CSV
                </button>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Run a simulation to compute EV, risk, and distribution.</p>
            )}
          </section>
        )}

        {mode === "play" && (
          <section className="bg-slate-900/60 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-100">Play mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-100">
              <div className="bg-slate-900/70 rounded-lg p-4">
                <p className="text-slate-400">Hands played</p>
                <p className="text-2xl font-semibold text-emerald-400">{handsPlayed}</p>
              </div>
              <div className="bg-slate-900/70 rounded-lg p-4">
                <p className="text-slate-400">Current bankroll</p>
                <p className="text-2xl font-semibold text-emerald-400">{numberFormatter.format(currentBankroll)}</p>
              </div>
              <div className="bg-slate-900/70 rounded-lg p-4">
                <p className="text-slate-400">Last result</p>
                <p className="text-lg font-semibold text-slate-100">
                  {lastRound
                    ? `${numberFormatter.format(lastRound.net)} (${lastRound.hands
                        .map((h) => `${h.outcome} ${h.payout >= 0 ? "+" : ""}${h.payout.toFixed(2)}`)
                        .join(", ")})`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-lg p-4">
              <h3 className="text-slate-200 font-semibold mb-2">Hand log</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto text-sm text-slate-100">
                {displayedEvents.map((event, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400 w-24">
                      {dealerActionLabel[event.type]}
                    </span>
                    <span>{formatEvent(event)}</span>
                  </div>
                ))}
                {displayedEvents.length === 0 && <p className="text-slate-400 text-sm">Play a hand to see the log.</p>}
              </div>
            </div>
          </section>
        )}

        <section className="bg-slate-900/60 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Hand history</h2>
              <p className="text-xs text-slate-400">
                Most recent hands from animated play and fast simulations appear here.
              </p>
            </div>
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
              onClick={clearLog}
              disabled={handLog.length === 0}
            >
              Clear log
            </button>
          </div>
          {logTrimmed && (
            <p className="text-xs text-amber-400">Only the most recent {MAX_LOG_ENTRIES} entries are shown.</p>
          )}
          <div
            ref={logContainerRef}
            className="bg-slate-900/70 rounded-lg max-h-80 overflow-y-auto divide-y divide-slate-800"
          >
            {handLog.length === 0 ? (
              <p className="text-sm text-slate-400 p-4">Play or simulate to populate the history.</p>
            ) : (
              handLog.map((entry) => {
                if (entry.kind === "round") {
                  const netClass =
                    entry.net > 0
                      ? "text-emerald-400"
                      : entry.net < 0
                      ? "text-rose-400"
                      : "text-slate-200";
                  return (
                    <div key={entry.id} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span>
                          {entry.source === "play" ? "Play" : `Sim trial ${entry.trial}`} · Hand {entry.handNumber}
                        </span>
                        <span className={`font-semibold ${netClass}`}>
                          {numberFormatter.format(entry.net)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">
                        Dealer: [{cardsToString(entry.dealerHand)}]
                      </div>
                      <ul className="text-xs text-slate-200 space-y-1">
                        {entry.hands.map((hand, idx) => (
                          <li key={idx}>{formatHandResultLine(hand, idx)}</li>
                        ))}
                      </ul>
                      {entry.bankrollAfter !== undefined && (
                        <div className="text-xs text-slate-400">
                          Bankroll after hand: {numberFormatter.format(entry.bankrollAfter)}
                        </div>
                      )}
                    </div>
                  );
                }
                const profitClass =
                  entry.profit > 0
                    ? "text-emerald-400"
                    : entry.profit < 0
                    ? "text-rose-400"
                    : "text-slate-200";
                return (
                  <div key={entry.id} className="p-4 space-y-1 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        Simulation trial {entry.trial} summary
                      </span>
                      <span className={`font-semibold ${profitClass}`}>
                        {numberFormatter.format(entry.profit)}
                      </span>
                    </div>
                    <div>Hands played: {entry.handsPlayed}</div>
                    <div>Ending bankroll: {numberFormatter.format(entry.endingBankroll)}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
