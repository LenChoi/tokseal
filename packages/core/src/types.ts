/** Shared types for tokseal. */

export type TokenBreakdown = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
};

/** One aggregated row, keyed by client + model. */
export type UsageRow = TokenBreakdown & {
  client: string;
  model: string;
  messageCount: number;
  cost: number; // USD; 0 when unpriced
  priced: boolean;
  /** True when token counts were estimated from text (no usage block in the log). */
  estimated: boolean;
};

/** Per-day totals for the contribution-style graph. */
export type DayBucket = TokenBreakdown & {
  date: string; // YYYY-MM-DD
  messageCount: number;
  sessionCount: number;
  cost: number;
};

/** Totals shape shared by reports, windows, and submissions. */
export type Totals = TokenBreakdown & {
  totalTokens: number;
  cost: number;
  messageCount: number;
  activeDays: number;
  sessionCount: number;
};

export type UsageReport = {
  rows: UsageRow[];
  days: DayBucket[];
  totals: Totals;
  /** Totals of estimated-only sources (Kiro, imports). Never mixed into `totals`, `days`, or the grade. */
  estimated: Totals;
  dateRange: { start: string | null; end: string | null };
  clients: string[];
  models: string[];
  generatedAt: string;
};
