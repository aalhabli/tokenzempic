/**
 * One normalized agent session, built from the Data Cloud session-tracing DMOs.
 * This is the unit everything else (clustering, reports, codegen) works on.
 */
export interface SessionRecord {
  sessionId: string;
  startedAt: string;
  /** What the user actually typed, turn by turn. */
  utterances: string[];
  /** Topic the reasoning engine classified the session into, if any. */
  topic: string | null;
  /** Ordered names of the actions (Flows, Apex, prompts) the agent invoked. */
  actionSequence: string[];
  /** Input parameters the agent extracted and passed to actions. */
  params: Record<string, unknown>;
  outcome: 'resolved' | 'escalated' | 'abandoned' | 'unknown';
  /** Credit/token cost of the session if the org exposes it, else null. */
  credits: number | null;
  /**
   * What Agentforce Optimization decided the session was about, one entry per
   * moment. Salesforce writes these itself, so the tool pays nothing for an
   * intent label and gets a better one than it would derive.
   */
  intents: string[];
  /**
   * Optimization scores for the session, keyed by the name the org uses:
   * "Relevance Score", "Quality Score", "Deflection Score", "Abandonment
   * Score". A score the org did not write is absent, never zero.
   */
  scores: Record<string, string>;
  /**
   * How many steps of each kind ran, keyed by the step type the org writes.
   * Credits are unreadable in some orgs, so this is the cost evidence that is
   * always available.
   */
  stepCounts: Record<string, number>;
  /**
   * Steps that invoke a model. This is the number distillation reduces, and
   * the only cost figure that comes from measurement rather than a price list.
   */
  modelCalls: number;
}
