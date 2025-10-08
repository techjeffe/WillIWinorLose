/// <reference lib="webworker" />
import { simulateRun, SimConfig } from "../../../core";

interface SimulateMessage {
  config: SimConfig;
  bankroll: number;
}

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<SimulateMessage>) => {
  const { config, bankroll } = event.data;
  const result = simulateRun(config, bankroll);
  self.postMessage(result);
};

export {};
