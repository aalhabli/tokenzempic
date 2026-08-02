import { describe, expect, it } from 'vitest';
import { clusterSessions } from '../cluster/cluster.js';
import { renderMarkdownReport } from './markdown.js';
import type { SessionRecord } from '../types.js';

function session(partial: Partial<SessionRecord> & { sessionId: string }): SessionRecord {
  return {
    startedAt: '2026-08-02T11:53:16Z',
    utterances: [],
    responses: [],
    turns: 1,
    topic: 'order_status',
    actionSequence: ['Get_Order_Status'],
    params: {},
    outcome: 'resolved',
    credits: null,
    billableUnits: {},
    billableTotal: 0,
    tokens: null,
    intents: [],
    scores: { 'Relevance Score': '5' },
    stepCounts: {},
    modelCalls: 3,
    ...partial,
  };
}

// Covers each verdict the report can print: a repeated pattern that acts, an
// action-less pattern whose answers differ, and a pattern seen only once.
const clusters = clusterSessions([
  session({ sessionId: 'S1', intents: ['Where is my order?'] }),
  session({ sessionId: 'S2', intents: ['Has my order shipped?'] }),
  session({
    sessionId: 'S3',
    topic: 'general_support',
    actionSequence: [],
    intents: ['I have a complaint about my last bag.'],
    responses: ['I am sorry to hear that. Tell me the roast date on the bag.'],
    modelCalls: 4,
  }),
  session({
    sessionId: 'S4',
    topic: 'general_support',
    actionSequence: [],
    intents: ['I have a complaint about my last bag.'],
    responses: ['Please send a photograph of the packaging so we can replace it.'],
    modelCalls: 4,
  }),
  session({
    sessionId: 'S5',
    topic: 'returns_refunds',
    actionSequence: ['Get_Return_Policy'],
    intents: ['What is your return policy?'],
  }),
]);

const report = renderMarkdownReport(clusters, {
  agentName: 'Support',
  window: 'the last 24 hours',
});

describe('renderMarkdownReport', () => {
  it('leads with the counts a reader wants first', () => {
    expect(report).toContain('5 sessions fall into 3 patterns');
    expect(report).toContain('17 model calls');
    expect(report).toContain('0 billable units');
  });

  it('says what compiling would remove without claiming the session is free', () => {
    expect(report).toContain('2 of those calls are reasoning steps');
    expect(report).toContain('It becomes cheaper.');
  });

  it('lists the intents Optimization recorded', () => {
    expect(report).toContain('Where is my order?');
    expect(report).toContain('Has my order shipped?');
  });

  it('gives every cluster a verdict and a reason', () => {
    expect(report).toContain('**Compile this.**');
    expect(report).toContain('**Leave it to the agent.**');
    expect(report).toContain('Real judgement work.');
  });

  it('never quotes a token count or a money figure', () => {
    // Naming them in the disclaimer is fine. Putting a number on them is not.
    expect(report).not.toMatch(/[$£€]\s*\d/);
    expect(report).not.toMatch(/\d[\d,.]*\s*(tokens?|credits?)\b/i);
  });

  it('leads with billable units, because that is what the org is charged', () => {
    const billed = clusterSessions([
      session({ sessionId: 'B1', billableUnits: { ACTION: 2, INTERACTION: 1 }, billableTotal: 3 }),
      session({ sessionId: 'B2', billableUnits: { ACTION: 2, INTERACTION: 1 }, billableTotal: 3 }),
    ]);
    const out = renderMarkdownReport(billed);
    expect(out).toContain('6 billable units');
    expect(out).toContain('4 ACTION');
  });

  it('gives no money unless the caller supplies rates', () => {
    const billed = clusterSessions([
      session({ sessionId: 'R1', billableUnits: { ACTION: 2 }, billableTotal: 2 }),
      session({ sessionId: 'R2', billableUnits: { ACTION: 2 }, billableTotal: 2 }),
    ]);
    expect(renderMarkdownReport(billed)).not.toMatch(/\d+ credits\)/);
    const withRates = renderMarkdownReport(billed, { unitRates: { ACTION: 20 } });
    expect(withRates).toContain('80 credits');
  });

  it('stays silent on money when a rate is missing for one unit', () => {
    const billed = clusterSessions([
      session({ sessionId: 'M1', billableUnits: { ACTION: 2, INTERACTION: 1 }, billableTotal: 3 }),
      session({ sessionId: 'M2', billableUnits: { ACTION: 2, INTERACTION: 1 }, billableTotal: 3 }),
    ]);
    expect(renderMarkdownReport(billed, { unitRates: { ACTION: 20 } })).not.toMatch(/credits\)/);
  });

  it('quotes tokens once metering has caught up', () => {
    const metered = clusterSessions([
      session({ sessionId: 'T1', tokens: 10000 }),
      session({ sessionId: 'T2', tokens: 8500 }),
    ]);
    const out = renderMarkdownReport(metered);
    expect(out).toContain('18,500 tokens');
  });

  it('says "not yet" rather than zero before metering lands', () => {
    expect(report).toContain('not yet');
  });

  it('calls out sessions whose topic acts elsewhere, without guessing why', () => {
    const mixed = clusterSessions([
      session({ sessionId: 'A1' }),
      session({ sessionId: 'A2' }),
      session({ sessionId: 'B1', actionSequence: [], tokens: 5000 }),
      session({ sessionId: 'B2', actionSequence: [], tokens: 5000 }),
    ]);
    const out = renderMarkdownReport(mixed);
    expect(out).toContain('2 sessions did not reach an action');
    expect(out).toContain('10,000 tokens');
    expect(out).toContain('Sometimes acts, sometimes not');
  });

  it('says why cost is reported the way it is', () => {
    expect(report).toContain('an estimate would be a guess');
    expect(report).toContain('lands hours after the trace does');
  });

  it('writes a clean table row', () => {
    expect(report).toContain('| 2 | 1 | 0 | order_status > get_order_status | Get_Order_Status |');
  });

  it('does not say "1 sessions"', () => {
    expect(report).not.toMatch(/\b1 sessions\b/);
    expect(report).toContain('1 session,');
  });

  it('escapes a pipe so the table cannot break', () => {
    const odd = clusterSessions([
      session({ sessionId: 'X1', topic: 'a|b' }),
      session({ sessionId: 'X2', topic: 'a|b' }),
    ]);
    expect(renderMarkdownReport(odd)).toContain('a\\|b');
  });

  it('escapes the backslash before the pipe, so an escaped pipe cannot break out', () => {
    // 'a\\|b' would become 'a\\\\|b' if only the pipe were escaped: the backslash
    // escapes the backslash and the pipe ends the cell.
    const odd = clusterSessions([
      session({ sessionId: 'Y1', topic: 'a\\|b' }),
      session({ sessionId: 'Y2', topic: 'a\\|b' }),
    ]);
    const row = renderMarkdownReport(odd)
      .split('\n')
      .find((l) => l.startsWith('| 2 '));
    // One backslash in, three out: the backslash doubles, then the pipe gets
    // an escape of its own.
    expect(row).toContain('a\\\\\\|b');
    // Seven cells still, counting only the pipes no backslash escapes.
    expect(row?.match(/(?<!\\)(?:\\\\)*\|/g)).toHaveLength(9);
  });

  it('keeps a newline from ending the row', () => {
    const odd = clusterSessions([
      session({ sessionId: 'Z1', topic: 'a\nb' }),
      session({ sessionId: 'Z2', topic: 'a\nb' }),
    ]);
    const rows = renderMarkdownReport(odd)
      .split('\n')
      .filter((l) => l.startsWith('| 2 '));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('a b');
  });

  it('reports honestly when nothing is ready', () => {
    const none = clusterSessions([session({ sessionId: 'N1', actionSequence: [] })]);
    expect(renderMarkdownReport(none)).toContain('Nothing here is ready to compile yet.');
  });
});
