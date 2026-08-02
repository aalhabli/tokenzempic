/**
 * Folds the five DMO tables into SessionRecord rows.
 *
 * The classifiers below use values confirmed against a real traced org (see
 * `vocabulary.ts`). They are still overridable, because Salesforce does not
 * publish the list and it can move between releases. Run `observedVocabulary`
 * against a fresh read before trusting them in a new org.
 */

import type { SessionRecord } from '../types.js';
import type { MessageRow, RawTrace, StepRow, UsageRow } from './types.js';
import { BILLABLE_STEP_TYPES, MessageType, StepType } from './vocabulary.js';

export interface NormalizeOptions {
  /** True when a message came from the person, not the agent. */
  isUserMessage?: (row: MessageRow) => boolean;
  /** True when a step is the agent invoking a tool, not reasoning about one. */
  isActionStep?: (row: StepRow) => boolean;
}

const defaultIsUserMessage = (row: MessageRow): boolean =>
  row.messageType === MessageType.User;

const defaultIsActionStep = (row: StepRow): boolean =>
  row.stepType === StepType.Action;

/**
 * The step-level input and output columns arrive HTML-escaped: `&quot;` where
 * the payload had a quote. Decoding has to happen before any JSON parse, or
 * every action parameter reads back as an unparsable string.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#92;/g, '\\')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function outcomeFrom(endReason: string | null): SessionRecord['outcome'] {
  if (!endReason) return 'unknown';
  if (/escalat|transfer|handoff/i.test(endReason)) return 'escalated';
  if (/abandon|timeout|expire|disconnect/i.test(endReason)) return 'abandoned';
  if (/closed|complete|resolved/i.test(endReason)) return 'resolved';
  return 'unknown';
}

/**
 * Action inputs arrive as one text column of escaped JSON. A failed parse
 * must not lose the session, so the decoded text is kept instead.
 */
function parseParams(steps: StepRow[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const step of steps) {
    if (!step.inputValue) continue;
    const key = step.name ?? step.id;
    const decoded = decodeEntities(step.inputValue);
    try {
      params[key] = JSON.parse(decoded);
    } catch {
      params[key] = decoded;
    }
  }
  return params;
}

function creditsFor(rows: UsageRow[]): number | null {
  const billable = rows.filter((r) => r.isBillable !== false);
  if (billable.length === 0) return null;
  const total = billable.reduce((sum, r) => sum + (r.usageQuantity ?? 0), 0);
  return total > 0 ? total : null;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function byTime(a: { startedAt: string | null }, b: { startedAt: string | null }): number {
  return (a.startedAt ?? '').localeCompare(b.startedAt ?? '');
}

export function normalizeSessions(
  raw: RawTrace,
  options: NormalizeOptions = {}
): SessionRecord[] {
  const isUserMessage = options.isUserMessage ?? defaultIsUserMessage;
  const isActionStep = options.isActionStep ?? defaultIsActionStep;

  const interactionsBySession = groupBy(raw.interactions, (r) => r.sessionId);
  const stepsByInteraction = groupBy(raw.steps, (r) => r.interactionId);
  const messagesBySession = groupBy(raw.messages, (r) => r.sessionId);
  const usageBySession = groupBy(raw.usage, (r) => r.sessionId);
  const momentsBySession = groupBy(raw.moments, (r) => r.sessionId);
  const scoresBySession = groupBy(raw.scores, (r) => r.sessionId);

  return raw.sessions.map((session) => {
    const interactions = (interactionsBySession.get(session.id) ?? []).slice().sort(byTime);

    const steps: StepRow[] = [];
    for (const interaction of interactions) {
      steps.push(...(stepsByInteraction.get(interaction.id) ?? []).slice().sort(byTime));
    }
    const actionSteps = steps.filter(isActionStep);

    const utterances = (messagesBySession.get(session.id) ?? [])
      .slice()
      .sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''))
      .filter(isUserMessage)
      .map((m) => m.content)
      .filter((c): c is string => Boolean(c))
      .map(decodeEntities);

    // The first topic the router settled on is what the session is about.
    // Later turns can drift, and drift belongs in the report, not the key.
    const topic = interactions.find((i) => i.topicApiName)?.topicApiName ?? null;

    // The session row's own end type reads NOT_SET in practice. The reason
    // lives on the terminal step instead.
    const endReason =
      steps.find((s) => s.stepType === StepType.SessionEnd)?.name ?? session.endType;

    const stepCounts: Record<string, number> = {};
    for (const s of steps) {
      if (!s.stepType) continue;
      stepCounts[s.stepType] = (stepCounts[s.stepType] ?? 0) + 1;
    }
    const modelCalls = BILLABLE_STEP_TYPES.reduce(
      (total, type) => total + (stepCounts[type] ?? 0),
      0
    );

    const intents = (momentsBySession.get(session.id) ?? [])
      .slice()
      .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
      .map((m) => m.requestSummary)
      .filter((t): t is string => Boolean(t))
      .map(decodeEntities);

    // Last write wins. An org can score the same session more than once, and
    // the newer value is the one worth reporting.
    const scores: Record<string, string> = {};
    for (const s of scoresBySession.get(session.id) ?? []) {
      scores[s.name] = s.value;
    }

    return {
      sessionId: session.id,
      startedAt: session.startedAt ?? '',
      utterances,
      topic,
      actionSequence: actionSteps.map((s) => s.name).filter((n): n is string => Boolean(n)),
      params: parseParams(actionSteps),
      outcome: outcomeFrom(endReason),
      credits: creditsFor(usageBySession.get(session.id) ?? []),
      intents,
      scores,
      stepCounts,
      modelCalls,
    };
  });
}

/**
 * Reports the distinct values the org actually writes to the type columns.
 * Run this against a real read whenever you meet a new org or a new release:
 * it is the cheapest way to find out that a default above has gone stale.
 */
export function observedVocabulary(raw: RawTrace): Record<string, string[]> {
  const distinct = (values: Array<string | null>): string[] =>
    [...new Set(values.filter((v): v is string => Boolean(v)))].sort();

  return {
    interactionType: distinct(raw.interactions.map((r) => r.interactionType)),
    stepType: distinct(raw.steps.map((r) => r.stepType)),
    stepSubType: distinct(raw.steps.map((r) => r.subType)),
    stepName: distinct(raw.steps.map((r) => r.name)),
    messageType: distinct(raw.messages.map((r) => r.messageType)),
    sessionEndType: distinct(raw.sessions.map((r) => r.endType)),
  };
}
