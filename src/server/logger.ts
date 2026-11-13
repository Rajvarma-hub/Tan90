import "server-only";
import { env } from "@/config/env.server";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function serialize(context: LogContext) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : value,
    ]),
  );
}

function log(level: LogLevel, message: string, context: LogContext = {}) {
  if (env.NODE_ENV !== "production") {
    console[level](`[${level}] ${message}`, context);
    return;
  }
  if (level === "debug") return;
  // One JSON object per line for log aggregators.
  console[level](JSON.stringify({ level, message, ...serialize(context) }));
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};
