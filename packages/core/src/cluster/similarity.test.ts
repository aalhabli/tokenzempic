import { describe, expect, it } from 'vitest';
import { groupBySimilarity, similarity, stability, tokenSet } from './similarity.js';

describe('tokenSet', () => {
  it('drops punctuation, case, and words that carry no signal', () => {
    expect([...tokenSet('My espresso tastes BITTER, lately!')].sort()).toEqual([
      'bitter',
      'espresso',
      'lately',
      'tastes',
    ]);
  });
});

describe('similarity', () => {
  it('scores the same words as identical', () => {
    expect(similarity(tokenSet('bitter espresso'), tokenSet('espresso bitter'))).toBe(1);
  });

  it('scores unrelated text as nothing', () => {
    expect(similarity(tokenSet('bitter espresso'), tokenSet('password reset'))).toBe(0);
  });

  it('treats two empty sets as identical rather than dividing by zero', () => {
    expect(similarity(tokenSet('the a of'), tokenSet('and to it'))).toBe(1);
  });
});

describe('groupBySimilarity', () => {
  // The questions below are the ones a real traced org produced under a single
  // action-less topic. They must not collapse into one pattern.
  const intents = [
    'My espresso tastes bitter lately, and I need advice on how to fix it.',
    'My espresso tastes bitter and I want to fix it.',
    'Which roast works best in a moka pot?',
    'Which roast is best for a moka pot?',
    'My grinder is making a rattling noise, and I want to know if that is normal.',
  ];

  const groups = groupBySimilarity(intents, (t) => t);

  it('puts the same question together whatever the wording', () => {
    const espresso = groups.find((g) => g[0]?.includes('espresso'));
    expect(espresso).toHaveLength(2);
  });

  it('keeps different questions apart', () => {
    expect(groups).toHaveLength(3);
  });

  it('gives the same answer twice for the same input', () => {
    expect(groupBySimilarity(intents, (t) => t)).toEqual(groups);
  });
});

describe('stability', () => {
  it('scores rewordings of one answer as stable', () => {
    const answers = [
      'Try a coarser grind, a shorter brew time, and a lower water temperature.',
      'Use a coarser grind, shorten the brew time, and lower the water temperature.',
    ];
    expect(stability(answers)).toBeGreaterThan(0.5);
  });

  it('scores genuinely different answers as unstable', () => {
    expect(
      stability(['Your order shipped on Monday.', 'Please contact the roastery about a warranty.'])
    ).toBeLessThan(0.2);
  });

  it('refuses to judge a single answer', () => {
    expect(stability(['only one'])).toBeNull();
    expect(stability([])).toBeNull();
  });
});
