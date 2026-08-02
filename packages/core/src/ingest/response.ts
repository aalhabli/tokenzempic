/**
 * The Data Cloud query API returns rows as positional arrays, not objects.
 * The column order lives in `metadata[column].placeInOrder`. This turns one
 * response into the keyed rows the rest of ingestion expects.
 */

import type { DmoRow } from './types.js';

export interface DataCloudResponse {
  data?: unknown[][];
  metadata?: Record<string, { placeInOrder: number; type?: string }>;
  rowCount?: number;
  done?: boolean;
}

/**
 * Data Cloud writes the string "NOT_SET" where a value is absent. Left alone
 * it would become a topic name, so it is folded to null on the way in.
 */
function clean(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value === '' || value === 'NOT_SET') return null;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

export function toRows(response: DataCloudResponse): DmoRow[] {
  const metadata = response.metadata ?? {};
  const columns = Object.entries(metadata)
    .sort((a, b) => a[1].placeInOrder - b[1].placeInOrder)
    .map(([name]) => name);

  if (columns.length === 0) return [];

  return (response.data ?? []).map((values) => {
    const row: DmoRow = {};
    columns.forEach((name, index) => {
      row[name] = clean(values[index]);
    });
    return row;
  });
}
