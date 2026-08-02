import { describe, expect, it } from 'vitest';
import { clusterSessions, reducibleModelCalls } from './cluster.js';
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
    tokens: null,
    intents: [],
    scores: { 'Relevance Score': '5' },
    stepCounts: {},
    modelCalls: 3,
    ...partial,
  };
}

describe('clusterSessions', () => {
  const records = [
    session({ sessionId: 'S1', intents: ['Where is my order?'] }),
    session({ sessionId: 'S2', intents: ['Has my order shipped?'] }),
    session({ sessionId: 'S3', intents: ['When will it arrive?'] }),
    session({
      sessionId: 'S4',
      topic: 'general_support',
      actionSequence: [],
      intents: ['My espresso tastes bitter.'],
      modelCalls: 4,
    }),
    session({
      sessionId: 'S5',
      topic: 'returns_refunds',
      actionSequence: ['Get_Return_Policy'],
      intents: ['What is your return policy?'],
    }),
  ];

  const clusters = clusterSessions(records);

  it('groups by action signature, not by what people said', () => {
    const order = clusters.find((c) => c.signature === 'order_status > get_order_status');
    expect(order?.sessionCount).toBe(3);
    expect(order?.intents).toHaveLength(3);
  });

  it('puts the biggest pattern first', () => {
    expect(clusters[0].signature).toBe('order_status > get_order_status');
  });

  it('sums and averages the model calls', () => {
    expect(clusters[0].modelCalls).toBe(9);
    expect(clusters[0].modelCallsPerSession).toBe(3);
  });

  it('recommends compiling a repeated, well scored pattern', () => {
    expect(clusters[0].verdict).toBe('distillable');
  });

  it('will not call one action-less session a pattern', () => {
    const tail = clusters.find((c) => c.signature.startsWith('general_support'));
    expect(tail?.verdict).toBe('too-few');
  });

  it('will not call a single session a pattern', () => {
    const returns = clusters.find((c) => c.signature.startsWith('returns_refunds'));
    expect(returns?.verdict).toBe('too-few');
  });

  it('refuses to compile a badly scored pattern', () => {
    const poor = clusterSessions([
      session({ sessionId: 'P1', scores: { 'Relevance Score': '2' } }),
      session({ sessionId: 'P2', scores: { 'Relevance Score': '1' } }),
    ]);
    expect(poor[0].qualityScore).toBe(1.5);
    expect(poor[0].verdict).toBe('poor-quality');
  });

  it('treats an unscored pattern as unknown, not as safe', () => {
    const unscored = clusterSessions([
      session({ sessionId: 'U1', scores: {} }),
      session({ sessionId: 'U2', scores: {} }),
    ]);
    expect(unscored[0].qualityScore).toBeNull();
    expect(unscored[0].verdict).toBe('unscored');
  });

  it('calls a no-action cluster stalled when the topic acts elsewhere', () => {
    // Order status reaches its action in three sessions and never reaches it
    // in two. The two are a stall, not work worth leaving to the agent.
    const mixed = clusterSessions([
      session({ sessionId: 'A1' }),
      session({ sessionId: 'A2' }),
      session({ sessionId: 'A3' }),
      session({ sessionId: 'B1', actionSequence: [] }),
      session({ sessionId: 'B2', actionSequence: [] }),
    ]);
    const stalled = mixed.find((c) => c.signature === 'order_status');
    expect(stalled?.sessionCount).toBe(2);
    expect(stalled?.verdict).toBe('stalled');
  });

  it('still leaves a topic that never acts to the agent', () => {
    const tail = clusters.find((c) => c.signature.startsWith('general_support'));
    expect(tail?.actions).toEqual([]);
  });

  it('sums tokens when metering has caught up, and reports null before', () => {
    const metered = clusterSessions([
      session({ sessionId: 'T1', tokens: 10000 }),
      session({ sessionId: 'T2', tokens: 8000 }),
    ]);
    expect(metered[0].tokens).toBe(18000);
    expect(clusters[0].tokens).toBeNull();
  });

  it('splits an action-less topic by the question, not into one lump', () => {
    const help = clusterSessions([
      session({ sessionId: 'H1', topic: 'general_support', actionSequence: [],
        intents: ['My espresso tastes bitter lately, and I need advice on how to fix it.'],
        responses: ['Try a coarser grind and a shorter brew time.'] }),
      session({ sessionId: 'H2', topic: 'general_support', actionSequence: [],
        intents: ['My espresso tastes bitter lately and I need advice to fix it.'],
        responses: ['Try a coarser grind and a shorter brew time.'] }),
      session({ sessionId: 'H3', topic: 'general_support', actionSequence: [],
        intents: ['Which roast works best in a moka pot?'],
        responses: ['A medium or dark roast suits a moka pot.'] }),
      session({ sessionId: 'H4', topic: 'general_support', actionSequence: [],
        intents: ['Which roast is best for a moka pot?'],
        responses: ['Medium or dark roast works best in a moka pot.'] }),
    ]);
    expect(help).toHaveLength(2);
    expect(help.every((c) => c.sessionCount === 2)).toBe(true);
  });

  it('tells a repeated question with one answer to be written down', () => {
    const stable = clusterSessions([
      session({ sessionId: 'S1', actionSequence: [], topic: 'general_support',
        intents: ['My espresso tastes bitter.'],
        responses: ['Try a coarser grind, a shorter brew time, and cooler water.'] }),
      session({ sessionId: 'S2', actionSequence: [], topic: 'general_support',
        intents: ['My espresso tastes bitter.'],
        responses: ['Try a coarser grind, a shorter brew time, and cooler water today.'] }),
    ]);
    expect(stable[0].answerStability).toBeGreaterThan(0.8);
    expect(stable[0].verdict).toBe('static-answer');
  });

  it('leaves a repeated question with varied answers to the agent', () => {
    const varied = clusterSessions([
      session({ sessionId: 'V1', actionSequence: [], topic: 'general_support',
        intents: ['I have a complaint.'],
        responses: ['I am sorry to hear that, tell me about the roast date.'] }),
      session({ sessionId: 'V2', actionSequence: [], topic: 'general_support',
        intents: ['I have a complaint.'],
        responses: ['Please send a photograph of the packaging so we can help.'] }),
    ]);
    expect(varied[0].verdict).toBe('no-actions');
  });

  it('ranks by turns rather than by session count', () => {
    const ranked = clusterSessions([
      session({ sessionId: 'A1', topic: 'short', turns: 1 }),
      session({ sessionId: 'A2', topic: 'short', turns: 1 }),
      session({ sessionId: 'A3', topic: 'short', turns: 1 }),
      session({ sessionId: 'B1', topic: 'long', turns: 4 }),
      session({ sessionId: 'B2', topic: 'long', turns: 4 }),
    ]);
    expect(ranked[0].topic).toBe('long');
    expect(ranked[0].turns).toBe(8);
    expect(ranked[0].turnsPerSession).toBe(4);
  });

  it('counts only distillable sessions as reducible', () => {
    // Three order-status sessions qualify. The tail and the single return do not.
    expect(reducibleModelCalls(clusters)).toBe(3);
  });
});
