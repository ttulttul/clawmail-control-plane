import { createConsola } from "consola";

const baseLogger = createConsola({
  level: process.env.NODE_ENV === "production" ? 3 : 4,
});

export interface RequestLogger {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
}

function writeLog(
  level: "debug" | "info" | "warn" | "error",
  requestId: string,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  baseLogger[level]({ requestId, ...metadata }, message);
}

export function createRequestLogger(requestId: string): RequestLogger {
  return {
    debug: (message, metadata) => writeLog("debug", requestId, message, metadata),
    info: (message, metadata) => writeLog("info", requestId, message, metadata),
    warn: (message, metadata) => writeLog("warn", requestId, message, metadata),
    error: (message, metadata) => writeLog("error", requestId, message, metadata),
  };
}
