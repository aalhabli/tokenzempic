/**
 * The deterministic clustering key: what the agent *did*, not what the user said.
 * Sessions with the same topic and action sequence belong to the same cluster,
 * no model calls needed. Utterance-level grouping (embeddings) happens within
 * a signature cluster, later.
 */
export function actionSignature(topic: string | null, actionSequence: string[]): string {
  const parts = [topic ?? 'unknown', ...actionSequence]
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);
  return parts.join(' > ');
}
