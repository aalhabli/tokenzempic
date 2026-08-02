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
import { groupBySimilarity, stability } from './similarity.js';

/** Why a cluster is or is not worth compiling. */
export type Distillability =
  /** Repeats, runs actions, and the org scores it well. Compile this. */
  | 'distillable'
  /** Repeats and runs actions, but the org has not scored it. Look first. */
  | 'unscored'
  /** The org scores it badly. Compiling would harden a bad answer. */
  | 'poor-quality'
  /**
   * The agent answered the same question the same way every time, and called
   * nothing. Write the answer down once instead of generating it again.
   */
  | 'static-answer'
  /** No actions ran, and the answers differ every time. Real judgement work. */
  | 'no-actions'
  /**
   * Other sessions on this topic reach an action and these do not. The trace
   * does not say why, so this states the observation rather than the cause:
   * the agent may stall asking for input it could already have, or it may
   * answer another way. Both are worth reading before anything is generated.
   */
  | 'inconsistent'
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
  /** Customer turns across the cluster. Turns are where the tokens are. */
  turns: number;
  /** Mean turns per session, to one decimal place. */
  turnsPerSession: number;
  /**
   * How alike the agent's answers are, 0 to 1, or null when there are too few
   * to judge. High means the agent rewrites the same answer every time.
   */
  answerStability: number | null;
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
  /** Overlap at which two intents count as the same question. */
  intentThreshold?: number;
  /** Answer overlap at which a cluster counts as having one fixed answer. */
  stableAnswerThreshold?: number;
  /** Which Optimization score decides quality, and the floor it must clear. */
  qualityTagName?: string;
  minQualityScore?: number;
}

// Both thresholds are judgement calls with no ground truth behind them. They
// are set where they separate the questions and answers seen in a real traced
// org, and they are options so an org that disagrees can move them. Jaccard is
// harsh on short text, so two wordings of one question often share only about
// half their content words.
const DEFAULTS = {
  minSessions: 2,
  intentThreshold: 0.4,
  stableAnswerThreshold: 0.45,
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
  answerStability: number | null,
  options: Required<ClusterOptions>
): Distillability {
  if (actions.length === 0) {
    // An agent that answers well without calling anything is the case the
    // action signature cannot see. Ask a different question of it: does the
    // same question keep arriving, and does the answer keep coming out the
    // same? If so it is a knowledge article or a screen flow, not judgement.
    if (sessionCount < options.minSessions) return 'too-few';
    if (answerStability !== null && answerStability >= options.stableAnswerThreshold) {
      return 'static-answer';
    }
    return 'no-actions';
  }
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
    const first = sessions[0];
    if (!first) continue;

    // A bucket with actions is already one pattern: the agent did the same
    // work. A bucket without them is only one pattern by accident, so split it
    // by what people asked for. Sorted first, so the grouping does not depend
    // on the order rows came back from the query.
    const parts =
      first.actionSequence.length > 0
        ? [sessions]
        : groupBySimilarity(
            sessions.slice().sort((a, b) => a.sessionId.localeCompare(b.sessionId)),
            (r) => r.intents.join(' ') || r.utterances.join(' '),
            opts.intentThreshold
          );

    for (const part of parts) {
      const lead = part[0];
      if (!lead) continue;
      const modelCalls = part.reduce((n, s) => n + s.modelCalls, 0);
      const tokenTotal = part.reduce((n, s) => n + (s.tokens ?? 0), 0);
      const turns = part.reduce((n, s) => n + s.turns, 0);
      const quality = meanScore(part, opts.qualityTagName);
      // Only the last reply of each session. Every session opens with the same
      // welcome message, and comparing greetings to answers measured the
      // greeting. Switching to the final answer moved one real cluster from
      // 0.34 to 0.58 against a traced org.
      const answerStability = stability(
        part.map((s) => s.responses[s.responses.length - 1] ?? '')
      );

      // Name a split cluster after the question, so the report does not show
      // five rows all called general_support.
      const label =
        parts.length > 1 && lead.intents[0]
          ? `${signature} > ${lead.intents[0]}`
          : signature;

      clusters.push({
        signature: label,
        actions: lead.actionSequence,
        topic: lead.topic,
        sessions: part,
        sessionCount: part.length,
        intents: [...new Set(part.flatMap((s) => s.intents))].sort(),
        turns,
        turnsPerSession: Math.round((turns / part.length) * 10) / 10,
        modelCalls,
        tokens: tokenTotal > 0 ? tokenTotal : null,
        modelCallsPerSession: Math.round((modelCalls / part.length) * 10) / 10,
        qualityScore: quality,
        answerStability,
        verdict: judge(part.length, lead.actionSequence, quality, answerStability, opts),
      });
    }
  }

  // A cluster that ran no actions is only agent-worthy work if nothing on that
  // topic ever reaches an action. When a sibling cluster does, something is
  // inconsistent. Do not name the cause: an earlier version called this a
  // stall, and then produced false positives on sessions that answered
  // correctly from knowledge instead of calling a Flow.
  const topicsThatAct = new Set(
    clusters.filter((c) => c.actions.length > 0).map((c) => c.topic)
  );
  for (const c of clusters) {
    const unresolved = c.verdict === 'no-actions' || c.verdict === 'static-answer';
    if (unresolved && c.topic !== null && topicsThatAct.has(c.topic)) {
      c.verdict = 'inconsistent';
    }
  }

  // Rank by the work a cluster costs, not by how often it appears. Turns carry
  // the tokens, so a four-turn pattern seen twenty times outranks a one-turn
  // pattern seen sixty.
  return clusters.sort(
    (a, b) => b.turns - a.turns || b.sessionCount - a.sessionCount || b.modelCalls - a.modelCalls
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
