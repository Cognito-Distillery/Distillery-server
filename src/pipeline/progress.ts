export type PipelineStatus = {
  status: "idle" | "running";
  phase: "distill" | "cask" | null;
  startedAt: string | null;
  lastRun: { completedAt: string; distilled: number; casked: number } | null;
};

const state: PipelineStatus = {
  status: "idle",
  phase: null,
  startedAt: null,
  lastRun: null,
};

export function getProgress(): PipelineStatus {
  return { ...state };
}

export function setRunning(phase: "distill" | "cask"): void {
  state.status = "running";
  state.phase = phase;
  state.startedAt = new Date().toISOString();
}

export function setIdle(result: { distilled: number; casked: number }): void {
  state.status = "idle";
  state.phase = null;
  state.startedAt = null;
  state.lastRun = {
    completedAt: new Date().toISOString(),
    ...result,
  };
}
