import { nowIso } from "./time";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  run_id?: string;
}

export function log(scope: string, message: string, data?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    level: "info",
    scope,
    message,
    data,
    timestamp: nowIso()
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
  return entry;
}

export function warn(scope: string, message: string, data?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    level: "warn",
    scope,
    message,
    data,
    timestamp: nowIso()
  };
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(entry));
  return entry;
}

export function error(scope: string, message: string, data?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    level: "error",
    scope,
    message,
    data,
    timestamp: nowIso()
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(entry));
  return entry;
}

export function createLogger(runId: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) =>
      log("pipeline", message, { ...(data ?? {}), run_id: runId }),
    warn: (message: string, data?: Record<string, unknown>) =>
      warn("pipeline", message, { ...(data ?? {}), run_id: runId }),
    error: (message: string, data?: Record<string, unknown>) =>
      error("pipeline", message, { ...(data ?? {}), run_id: runId })
  };
}
