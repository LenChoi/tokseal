export * from './types.js';
export { resolvePrice, costFor, setPriceOverrides, PRICE_COUNT, type PricePerMillion } from './pricing.js';
export { parseClaude, claudeBaseDir, type UsageEvent } from './parse-claude.js';
export { parseCodex, codexBaseDir } from './parse-codex.js';
export { parseGemini, parseQwen, geminiBaseDir, qwenBaseDir } from './parse-gemini.js';
export { CLIENTS, parseAll, type ClientDef, type ParseAllResult } from './clients.js';
export { parseKiro, kiroBaseDir } from './parse-kiro.js';
export { parseOpencode, opencodeDataDir } from './parse-opencode.js';
export { parseCopilot, copilotBaseDir } from './parse-copilot.js';
export { parseClineFamily, parseClineTasks, globalStorageRoots, CLINE_FAMILY } from './parse-cline.js';
export { parseAmp, parseAmpThread, ampDataDir } from './parse-amp.js';
export { parseDroid, parseDroidSession, normalizeDroidModel, droidBaseDir } from './parse-droid.js';
export { importExport, parseImports, listImports, importsDir } from './imports.js';
export { estimateTokens } from './estimate.js';
export { aggregate } from './aggregate.js';
export { grade, gradeFromTotals, totalsFromDays, windowDays, levelFor, GRADE_WINDOW_DAYS, POPULATION_MIN, type Grade, type GradeLevel } from './grade.js';
export { renderGraph, type GraphOptions } from './graph.js';
export { pixelText, pixelTextWidth, pixelSprite } from './pixelfont.js';
export { renderCard, humanTokens, type CardTheme, type CardOptions } from './card.js';

import { parseAll } from './clients.js';
import { aggregate } from './aggregate.js';
import type { UsageReport } from './types.js';

/** Convenience: parse every supported client locally and aggregate. */
export async function collect(only?: string[]): Promise<UsageReport> {
  const { events } = await parseAll(only);
  return aggregate(events);
}
export {
  toSubmission,
  daysFromSubmission,
  reportFromSubmission,
  gradeFromSubmission,
  validateSubmission,
  SUBMISSION_VERSION,
  type Submission,
  type SubmissionModel,
  type SubmissionDay,
} from './submission.js';
export { reprice, sanityCheck, anomalyCheck, type SanityResult, type PriorHistory } from './sanity.js';
export { renderBadge, type BadgeOptions } from './badge.js';
