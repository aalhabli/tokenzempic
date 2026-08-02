import { describe, expect, it } from 'vitest';
import { clusterSessions } from '../cluster/cluster.js';
import { renderMarkdownReport } from './markdown.js';
import type { SessionRecord } from '../types.js';

function session(partial: Partial<SessionRecord> & { sessionId: string }): SessionRecord {
  return {
    startedAt: '2026-08-02T11:53:16Z',
    utterances: [],
    topic: 'order_status',
    actionSequence: ['Get_Order_Status'],
    params: {},
    outcome: 'resolved',
    credits: null,
    intents: [],
    scores: { 'Relevance Score': '5' },
    stepCounts: {},
    modelCalls: 3,
    ...partial,
  };
}

const clusters = clusterSessions([
  session({ sessionId: 'S1', intents: ['Where is my order?'] }),
  session({ sessionId: 'S2', intents: ['Has my order shipped?'] }),
  session({
    sessionId: 'S3',
    topic: 'general_support',
    actionSequence: [],
    intents: ['My espresso tastes bitter.'],
    modelCalls: 4,
  }),
]);

const report = renderMarkdownReport(clusters, {
  agentName: 'Support',
  window: 'the last 24 hours',
});

describe('renderMarkdownReport', () => {
  it('leads with the counts a reader wants first', () => {
    expect(report).toContain('3 sessions fall into 2 patterns');
    expect(report).toContain('10 model calls');
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
    expect(report).toContain('There is no deterministic path to compile to.');
  });

  it('never quotes a token count or a money figure', () => {
    // Naming them in the disclaimer is fine. Putting a number on them is not.
    expect(report).not.toMatch(/[$£€]\s*\d/);
    expect(report).not.toMatch(/\d[\d,.]*\s*(tokens?|credits?)\b/i);
  });

  it('says why cost is reported the way it is', () => {
    expect(report).toContain('an estimate would be a guess');
  });

  it('writes a clean table row', () => {
    expect(report).toContain('| 2 | order_status > get_order_status | Get_Order_Status |');
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

  it('reports honestly when nothing is ready', () => {
    const none = clusterSessions([session({ sessionId: 'N1', actionSequence: [] })]);
    expect(renderMarkdownReport(none)).toContain('Nothing here is ready to compile yet.');
  });
});
