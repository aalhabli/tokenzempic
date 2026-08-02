/**
 * Text grouping without a model.
 *
 * Two jobs. Group the intents of an action-less cluster so "my espresso tastes
 * bitter" and "my espresso tastes bitter lately, and I need advice" land
 * together. And score how alike a cluster's answers are, because a question
 * that gets the same answer every time is a question worth writing down once.
 *
 * Token overlap is enough for both. Reading the logs with a model would cost
 * the customer the very tokens the tool exists to save.
 */

/** Words that carry no signal and would inflate every comparison. */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'is', 'it',
  'its', 'me', 'my', 'need', 'of', 'on', 'or', 'that', 'the', 'their', 'them',
  'there', 'they', 'this', 'to', 'want', 'was', 'what', 'when', 'where',
  'which', 'who', 'will', 'with', 'would', 'you', 'your',
]);

export function tokenSet(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

/** Overlap of two token sets, 0 to 1. Two empty sets count as identical. */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Greedy grouping. Each item joins the first group whose leader it resembles,
 * and starts a new group otherwise.
 *
 * Greedy makes the result depend on input order, so the caller must pass items
 * in a stable order. In exchange it runs in one pass and a person can follow
 * why any two items ended up together, which matters when the output becomes a
 * recommendation someone has to trust.
 */
export function groupBySimilarity<T>(
  items: T[],
  text: (item: T) => string,
  threshold = 0.5
): T[][] {
  const groups: Array<{ leader: Set<string>; members: T[] }> = [];
  for (const item of items) {
    const tokens = tokenSet(text(item));
    const hit = groups.find((g) => similarity(g.leader, tokens) >= threshold);
    if (hit) hit.members.push(item);
    else groups.push({ leader: tokens, members: [item] });
  }
  return groups.map((g) => g.members);
}

/**
 * How alike a set of texts is, as the mean overlap of every pair. Returns null
 * for fewer than two texts, because one answer tells you nothing about whether
 * the next one will match.
 */
export function stability(texts: string[]): number | null {
  const sets = texts.filter((t) => t.trim().length > 0).map(tokenSet);
  if (sets.length < 2) return null;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i];
      const b = sets[j];
      if (!a || !b) continue;
      total += similarity(a, b);
      pairs++;
    }
  }
  return pairs === 0 ? null : total / pairs;
}
