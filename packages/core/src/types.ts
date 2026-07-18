/**
 * One normalized agent session, built from the OTel session trace and/or
 * the Data Cloud session-tracing DMOs. This is the unit everything else
 * (clustering, reports, codegen) works on.
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
}
