import { describe, expect, it } from 'vitest';
import { toRows } from './response.js';

/** Shaped like a real /ssot/queryv2 response: positional rows plus column metadata. */
const response = {
  data: [
    ['019fc252-1be3', '2026-08-02 11:53:10.661 UTC', 'NOT_SET'],
    ['019fc252-433b', '2026-08-02 11:53:19.290 UTC', 'CLOSED_USER_REQUEST'],
  ],
  metadata: {
    ssot__AiAgentSessionEndType__c: { placeInOrder: 2, type: 'VARCHAR' },
    ssot__Id__c: { placeInOrder: 0, type: 'VARCHAR' },
    ssot__StartTimestamp__c: { placeInOrder: 1, type: 'TIMESTAMP WITH TIME ZONE' },
  },
  rowCount: 2,
  done: true,
};

describe('toRows', () => {
  const rows = toRows(response);

  it('keys each value by its column, using placeInOrder not object order', () => {
    expect(rows[0].ssot__Id__c).toBe('019fc252-1be3');
    expect(rows[0].ssot__StartTimestamp__c).toBe('2026-08-02 11:53:10.661 UTC');
  });

  it('folds the NOT_SET sentinel to null', () => {
    expect(rows[0].ssot__AiAgentSessionEndType__c).toBeNull();
    expect(rows[1].ssot__AiAgentSessionEndType__c).toBe('CLOSED_USER_REQUEST');
  });

  it('returns nothing when the response carried no columns', () => {
    expect(toRows({ data: [], metadata: {} })).toEqual([]);
    expect(toRows({})).toEqual([]);
  });
});
