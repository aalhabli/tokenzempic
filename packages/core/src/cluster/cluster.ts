/**
 * Groups sessions by what the agent did, and judges which groups are worth
 * compiling to deterministic execution.
 *
 * No model calls happen here. The intent labels come from Agentforce
 * Optimization, which already wrote them, and the grouping key is the action
 * sequence, which is plain string work.
 */

import type { SessionRecord } from '../types.js';
import { actionSignature } from './signature.js';

/** Why a cluster is or is not worth compiling. */
export type Distillability =
  /** Repeats, runs actions, and the org scores it well. Compile this. */
  | 'distillable'
  /** Repeats and runs actions, but the org has not scored it. Look first. */
  | 'unscored'
  /** The org scores it badly. Compiling would harden a bad answer. */
  | 'poor-quality'
  /** No actions ran, so there is no deterministic path to compile to. */
  | 'no-actions'
  /**
   * The agent recognised the intent and never reached the action, while other
   * sessions on the same topic did. These cost tokens and resolve nothing, so
   * the fix is the agent's inputs, not generated code.
   */
  | 'stalled'
  /** Too few sessions to call it a pattern. */
  | 'too-few';

export interface Cluster {
  /** The grouping key: topic and the ordered actions the agent ran. */
  signature: string;
  /** Actions the agent ran, in order. Empty when it only reasoned. */
  actions: string[];
  topic: string | null;
  sessions: SessionRecord[];
  sessionCount: number;
  /** Distinct intents Optimization recorded for these sessions. */
  intents: string[];
  /** Model calls across the cluster. Always available. */
  modelCalls: number;
  /**
   * Tokens across the cluster, when metering has caught up. Null while the
   * org is still only reporting traces.
   */
  tokens: number | null;
  /** Mean model calls per session, to one decimal place. */
  modelCallsPerSession: number;
  /**
   * Mean of the Optimization score named in the options, when the org wrote
   * it. Null when nothing scored these sessions.
   */
  qualityScore: number | null;
  verdict: Distillability;
}

export interface ClusterOptions {
  /** Fewer sessions than this is noise, not a pattern. */
  minSessions?: number;
  /** Which Optimization score decides quality, and the floor it must clear. */
  qualityTagName?: string;
  minQualityScore?: number;
}

const DEFAULTS = {
  minSessions: 2,
  qualityTagName: 'Relevance Score',
  minQualityScore: 4,
};

function meanScore(sessions: SessionRecord[], tagName: string): number | null {
  const values = sessions
    .map((s) => Number(s.scores[tagName]))
    .filter((n) => Number.isFinite(n));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function judge(
  sessionCount: number,
  actions: string[],
  quality: number | null,
  options: Required<ClusterOptions>
): Distillability {
  if (actions.length === 0) return 'no-actions';
  if (sessionCount < options.minSessions) return 'too-few';
  if (quality === null) return 'unscored';
  if (quality < options.minQualityScore) return 'poor-quality';
  return 'distillable';
}

export function clusterSessions(
  records: SessionRecord[],
  options: ClusterOptions = {}
): Cluster[] {
  const opts = { ...DEFAULTS, ...options };

  const bySignature = new Map<string, SessionRecord[]>();
  for (const record of records) {
    const key = actionSignature(record.topic, record.actionSequence);
    const bucket = bySignature.get(key);
    if (bucket) bucket.push(record);
    else bySignature.set(key, [record]);
  }

  const clusters: Cluster[] = [];
  for (const [signature, sessions] of bySignature) {
    // Every bucket was created with a session in it, so this only satisfies
    // the compiler.
    const first = sessions[0];
    if (!first) continue;

    const modelCalls = sessions.reduce((total, s) => total + s.modelCalls, 0);
    const tokenTotal = sessions.reduce((total, s) => total + (s.tokens ?? 0), 0);
    const quality = meanScore(sessions, opts.qualityTagName);

    clusters.push({
      signature,
      actions: first.actionSequence,
      topic: first.topic,
      sessions,
      sessionCount: sessions.length,
      intents: [...new Set(sessions.flatMap((s) => s.intents))].sort(),
      modelCalls,
      tokens: tokenTotal > 0 ? tokenTotal : null,
      modelCallsPerSession: Math.round((modelCalls / sessions.length) * 10) / 10,
      qualityScore: quality,
      verdict: judge(sessions.length, first.actionSequence, quality, opts),
    });
  }

  // A cluster that ran no actions is only agent-worthy work if nothing on that
  // topic ever reaches an action. When a sibling cluster does, the agent knew
  // what was wanted and never got there, which is a stall and not a judgement
  // call. Telling a reader to "leave it to the agent" would be wrong.
  const topicsThatAct = new Set(
    clusters.filter((c) => c.actions.length > 0).map((c) => c.topic)
  );
  for (const c of clusters) {
    if (c.verdict === 'no-actions' && c.topic !== null && topicsThatAct.has(c.topic)) {
      c.verdict = 'stalled';
    }
  }

  // Biggest first. The cluster that repeats most is the one worth compiling.
  return clusters.sort(
    (a, b) => b.sessionCount - a.sessionCount || b.modelCalls - a.modelCalls
  );
}

/**
 * Model calls that would stop happening if every distillable cluster were
 * compiled. One reasoning step goes per session; routing and guardrails stay,
 * so this deliberately does not claim the whole session becomes free.
 */
export function reducibleModelCalls(clusters: Cluster[]): number {
  return clusters
    .filter((c) => c.verdict === 'distillable')
    .reduce((total, c) => total + c.sessionCount, 0);
}
