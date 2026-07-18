import { describe, expect, it } from 'vitest';
import { actionSignature } from './signature.js';

describe('actionSignature', () => {
  it('groups sessions by topic and action sequence, not wording', () => {
    const a = actionSignature('Order Status', ['Query Order', 'Respond']);
    const b = actionSignature('order status', [' query order ', 'Respond']);
    expect(a).toBe(b);
    expect(a).toBe('order status > query order > respond');
  });

  it('handles sessions with no classified topic', () => {
    expect(actionSignature(null, ['Escalate'])).toBe('unknown > escalate');
  });

  it('drops empty action names instead of producing dangling separators', () => {
    expect(actionSignature('Returns', ['', 'Send Policy'])).toBe('returns > send policy');
  });
});
