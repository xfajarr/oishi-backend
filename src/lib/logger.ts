/**
 * Structured logger with levels, timestamps, and component tags.
 * Zero dependencies. Colorized in terminal, plain in production.
 */
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Levels ───────────────────────────────────────────────────────────────
const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_VALUES: Record<Level, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

// ── Config ───────────────────────────────────────────────────────────────
const CONFIG = {
  level: (process.env.LOG_LEVEL ?? "info") as Level,
  file: process.env.LOG_FILE ? join(import.meta.dirname, "..", "..", process.env.LOG_FILE) : null,
  colors: process.env.NO_COLOR !== "1" && process.env.NODE_ENV !== "production",
};

if (CONFIG.file) {
  const dir = join(import.meta.dirname, "..", "..", "logs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Clear log file on startup
  writeFileSync(CONFIG.file, `──── Oishi Backend started at ${new Date().toISOString()} ────\n`);
}

// ── Color helpers ─────────────────────────────────────────────────────────
const C = CONFIG.colors
  ? {
      reset: "\x1b[0m",
      dim: "\x1b[2m",
      gray: "\x1b[90m",
      cyan: "\x1b[36m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      red: "\x1b[31m",
      bold: "\x1b[1m",
      magenta: "\x1b[35m",
    }
  : { reset: "", dim: "", gray: "", cyan: "", green: "", yellow: "", red: "", bold: "", magenta: "" };

const LEVEL_COLORS: Record<Level, string> = {
  trace: C.dim,
  debug: C.cyan,
  info: C.green,
  warn: C.yellow,
  error: C.red,
  fatal: `${C.red}${C.bold}`,
};

const LEVEL_LABELS: Record<Level, string> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: " INFO",
  warn: " WARN",
  error: "ERROR",
  fatal: "FATAL",
};

// ── Logger factory ────────────────────────────────────────────────────────
export function createLogger(component: string) {
  function log(level: Level, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_VALUES[level] < LEVEL_VALUES[CONFIG.level]) return;

    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const color = LEVEL_COLORS[level];
    const label = LEVEL_LABELS[level];
    const tag = `${C.gray}${component.padEnd(14)}${C.reset}`;

    // Terminal output
    const line = `${C.dim}${timestamp}${C.reset} ${color}${label}${C.reset} ${tag} ${message}`;
    const dataStr = data ? ` ${C.dim}${JSON.stringify(data)}${C.reset}` : "";
    console.log(`${line}${dataStr}`);

    // File output (no colors)
    if (CONFIG.file) {
      const plain = `${timestamp} ${label.trim()} [${component}] ${message}`;
      const plainData = data ? ` ${JSON.stringify(data)}` : "";
      appendFileSync(CONFIG.file, `${plain}${plainData}\n`);
    }
  }

  return {
    trace: (msg: string, data?: Record<string, unknown>) => log("trace", msg, data),
    debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
    fatal: (msg: string, data?: Record<string, unknown>) => log("fatal", msg, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
