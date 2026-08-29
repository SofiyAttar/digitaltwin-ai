import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { runScenario, SCENARIOS, type ScenarioId, type ScenarioResult } from "./scenarios";

interface TwinContextValue {
  scenarioId: ScenarioId;
  setScenarioId: (id: ScenarioId) => void;
  result: ScenarioResult;
}

const TwinContext = createContext<TwinContextValue | null>(null);

export function TwinProvider({ children }: { children: ReactNode }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("s3_stall");
  // Fully deterministic (seeded PRNG), so server and client render identically.
  const result = useMemo(() => runScenario(scenarioId), [scenarioId]);

  const value = useMemo(
    () => ({ scenarioId, setScenarioId, result }),
    [scenarioId, result],
  );

  return <TwinContext.Provider value={value}>{children}</TwinContext.Provider>;
}

export function useTwin() {
  const ctx = useContext(TwinContext);
  if (!ctx) throw new Error("useTwin must be used inside <TwinProvider>");
  return ctx;
}

export { SCENARIOS };
export type { ScenarioId, ScenarioResult };
