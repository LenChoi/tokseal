export * from './types.js';
export { resolvePrice, costFor, type PricePerMillion } from './pricing.js';
export { parseClaude, claudeBaseDir, type UsageEvent } from './parse-claude.js';
export { aggregate } from './aggregate.js';
export { grade, type Grade } from './grade.js';
export { renderCard, humanTokens, type CardTheme, type CardOptions } from './card.js';

import { parseClaude } from './parse-claude.js';
import { aggregate } from './aggregate.js';
import type { UsageReport } from './types.js';

/** Convenience: parse every supported client locally and aggregate. MVP = Claude. */
export async function collect(): Promise<UsageReport> {
  const events = await parseClaude();
  return aggregate(events);
}
export {
  toSubmission,
  reportFromSubmission,
  gradeFromSubmission,
  validateSubmission,
  SUBMISSION_VERSION,
  type Submission,
  type SubmissionModel,
} from './submission.js';
