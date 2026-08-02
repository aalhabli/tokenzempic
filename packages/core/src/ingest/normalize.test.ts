import { describe, expect, it } from 'vitest';
import { decodeEntities, normalizeSessions, observedVocabulary } from './normalize.js';
import type { RawTrace, StepRow } from './types.js';

/**
 * Fixtures use the step and message vocabulary observed in a real traced org,
 * including the escaped JSON that Data Cloud stores in the step IO columns.
 */
function step(partial: Partial<StepRow> & { id: string; interactionId: string }): StepRow {
  return {
    name: null,
    stepType: null,
    subType: null,
    inputValue: null,
    outputValue: null,
    errorMessage: null,
    startedAt: null,
    ...partial,
  };
}

const raw: RawTrace = {
  sessions: [
    { id: 'S1', startedAt: '2026-08-02T11:53:16Z', endedAt: null, endType: null },
    { id: 'S2', startedAt: '2026-08-02T11:53:24Z', endedAt: null, endType: null },
  ],
  interactions: [
    {
      id: 'I1',
      sessionId: 'S1',
      topicApiName: null,
      startedAt: '2026-08-02T11:53:16Z',
      interactionType: 'TURN',
    },
    {
      id: 'I2',
      sessionId: 'S1',
      topicApiName: 'order_status',
      startedAt: '2026-08-02T11:53:17Z',
      interactionType: 'TURN',
    },
    {
      id: 'I3',
      sessionId: 'S2',
      topicApiName: 'order_status',
      startedAt: '2026-08-02T11:53:25Z',
      interactionType: 'TURN',
    },
  ],
  steps: [
    step({
      id: 'T1',
      interactionId: 'I1',
      name: 'agent_router',
      stepType: 'TOPIC_STEP',
      startedAt: '2026-08-02T11:53:16Z',
    }),
    step({
      id: 'T2',
      interactionId: 'I1',
      name: 'pre_orchestration.guardrail',
      stepType: 'CLASSIFIER_STEP',
      startedAt: '2026-08-02T11:53:16Z',
    }),
    step({
      id: 'T3',
      interactionId: 'I2',
      name: 'order_status',
      stepType: 'LLM_STEP',
      startedAt: '2026-08-02T11:53:17Z',
    }),
    step({
      id: 'T4',
      interactionId: 'I2',
      name: 'Get_Order_Status',
      stepType: 'ACTION_STEP',
      subType: 'flow',
      inputValue: '{&quot;customer_email&quot;:&quot;dana.okafor@example.com&quot;}',
      outputValue: 'Order CO-00024: Delivered.',
      startedAt: '2026-08-02T11:53:18Z',
    }),
    step({
      id: 'T5',
      interactionId: 'I2',
      name: 'CLOSED_USER_REQUEST',
      stepType: 'SESSION_END',
      startedAt: '2026-08-02T11:53:20Z',
    }),
    step({
      id: 'T6',
      interactionId: 'I3',
      name: 'Get_Order_Status',
      stepType: 'ACTION_STEP',
      subType: 'flow',
      inputValue: 'not json at all',
      startedAt: '2026-08-02T11:53:26Z',
    }),
  ],
  messages: [
    {
      id: 'M1',
      sessionId: 'S1',
      interactionId: 'I1',
      messageType: 'Input',
      content: 'where&#39;s my order?',
      sentAt: '2026-08-02T11:53:16Z',
    },
    {
      id: 'M2',
      sessionId: 'S1',
      interactionId: 'I2',
      messageType: 'Output',
      content: 'Your order has been delivered.',
      sentAt: '2026-08-02T11:53:19Z',
    },
    {
      id: 'M3',
      sessionId: 'S2',
      interactionId: 'I3',
      messageType: 'Input',
      content: 'has my order shipped yet?',
      sentAt: '2026-08-02T11:53:24Z',
    },
  ],
  moments: [
    {
      id: 'MO1',
      sessionId: 'S1',
      requestSummary: 'I want to know if my order has shipped.',
      responseSummary: 'The agent said the order was delivered.',
      startedAt: '2026-08-02T11:53:16Z',
    },
    {
      id: 'MO2',
      sessionId: 'S2',
      requestSummary: 'I want to know when my order will arrive.',
      responseSummary: 'The agent said the order was delivered.',
      startedAt: '2026-08-02T11:53:24Z',
    },
  ],
  momentInteractions: [
    { momentId: 'MO1', interactionId: 'I2' },
    { momentId: 'MO2', interactionId: 'I3' },
  ],
  scores: [
    { sessionId: 'S1', momentId: 'MO1', name: 'Relevance Score', value: '5' },
    { sessionId: 'S1', momentId: null, name: 'Quality Score', value: '4' },
  ],
  usage: [
    {
      sessionId: 'S1',
      interactionId: 'I2',
      inputTokens: 900,
      outputTokens: 60,
      totalTokens: 960,
      usageQuantity: 2,
      isBillable: true,
      isMetered: true,
      modelName: 'gpt-x',
      toolName: null,
    },
    {
      sessionId: 'S1',
      interactionId: 'I2',
      inputTokens: 10,
      outputTokens: 0,
      totalTokens: 10,
      usageQuantity: 5,
      isBillable: false,
      isMetered: false,
      modelName: 'classifier',
      toolName: null,
    },
  ],
};

describe('normalizeSessions', () => {
  const records = normalizeSessions(raw);

  it('returns one record per session', () => {
    expect(records.map((r) => r.sessionId)).toEqual(['S1', 'S2']);
  });

  it('keeps only Input messages as utterances, decoded', () => {
    expect(records[0].utterances).toEqual(["where's my order?"]);
  });

  it('counts only ACTION_STEP rows in the action sequence', () => {
    expect(records[0].actionSequence).toEqual(['Get_Order_Status']);
  });

  it('does not mistake routing, reasoning, or session end for actions', () => {
    const names = records.flatMap((r) => r.actionSequence);
    expect(names).not.toContain('agent_router');
    expect(names).not.toContain('order_status');
    expect(names).not.toContain('CLOSED_USER_REQUEST');
  });

  it('gives two differently worded sessions the same signature inputs', () => {
    expect(records[0].topic).toBe(records[1].topic);
    expect(records[0].actionSequence).toEqual(records[1].actionSequence);
  });

  it('skips the router turn when picking the topic', () => {
    expect(records[0].topic).toBe('order_status');
  });

  it('decodes escaped JSON in action inputs', () => {
    expect(records[0].params).toEqual({
      Get_Order_Status: { customer_email: 'dana.okafor@example.com' },
    });
  });

  it('keeps unparsable action inputs as text', () => {
    expect(records[1].params).toEqual({ Get_Order_Status: 'not json at all' });
  });

  it('counts only billable usage toward credits', () => {
    expect(records[0].credits).toBe(2);
  });

  it('reports no credits when a session has no usage rows', () => {
    expect(records[1].credits).toBeNull();
  });

  it('reads the outcome from the terminal step, not the session row', () => {
    expect(records[0].outcome).toBe('resolved');
    expect(records[1].outcome).toBe('unknown');
  });
});

describe('Optimization moments and scores', () => {
  const records = normalizeSessions(raw);

  it('takes the intent Salesforce already worked out', () => {
    expect(records[0].intents).toEqual(['I want to know if my order has shipped.']);
    expect(records[1].intents).toEqual(['I want to know when my order will arrive.']);
  });

  it('gives two different intents one action signature', () => {
    expect(records[0].intents).not.toEqual(records[1].intents);
    expect(records[0].actionSequence).toEqual(records[1].actionSequence);
  });

  it('keeps the scores the org wrote, keyed by name', () => {
    expect(records[0].scores).toEqual({ 'Relevance Score': '5', 'Quality Score': '4' });
  });

  it('leaves a score absent rather than zero when the org wrote none', () => {
    expect(records[1].scores).toEqual({});
  });

  it('counts the steps that invoke a model', () => {
    // S1 runs TOPIC_STEP and CLASSIFIER_STEP and LLM_STEP. ACTION_STEP and
    // SESSION_END are free.
    expect(records[0].modelCalls).toBe(3);
    expect(records[0].stepCounts.ACTION_STEP).toBe(1);
    expect(records[0].stepCounts.SESSION_END).toBe(1);
  });

  it('does not count an action as a model call', () => {
    expect(records[1].modelCalls).toBe(0);
    expect(records[1].stepCounts.ACTION_STEP).toBe(1);
  });
});

describe('decodeEntities', () => {
  it('unescapes the payloads Data Cloud stores', () => {
    expect(decodeEntities('{&quot;a&quot;:&quot;b&#39;c&quot;}')).toBe('{"a":"b\'c"}');
  });
});

describe('observedVocabulary', () => {
  it('reports the distinct type values so the classifiers can be checked', () => {
    const vocab = observedVocabulary(raw);
    expect(vocab.stepType).toEqual([
      'ACTION_STEP',
      'CLASSIFIER_STEP',
      'LLM_STEP',
      'SESSION_END',
      'TOPIC_STEP',
    ]);
    expect(vocab.messageType).toEqual(['Input', 'Output']);
  });
});
