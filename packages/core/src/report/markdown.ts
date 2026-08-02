/**
 * The audit report: what the agent does all day, and which of it is worth
 * compiling.
 *
 * The report quotes model calls, never tokens and never money. Token counts
 * are not readable in every org, and a currency figure would be a guess.
 */

import type { Cluster, Distillability } from '../cluster/cluster.js';
import { reducibleModelCalls } from '../cluster/cluster.js';

const VERDICT_TEXT: Record<Distillability, string> = {
  distillable: 'Compile this',
  unscored: 'Look before you compile',
  'poor-quality': 'Fix the agent first',
  'no-actions': 'Leave it to the agent',
  'too-few': 'Not yet a pattern',
};

const VERDICT_WHY: Record<Distillability, string> = {
  distillable: 'It repeats, it runs the same actions, and the org scores it well.',
  unscored: 'It repeats and runs actions, but nothing has scored it yet.',
  'poor-quality': 'The org scores it below the floor. Compiling would fix a bad answer in place.',
  'no-actions': 'The agent only reasoned. There is no deterministic path to compile to.',
  'too-few': 'Too few sessions to call this a pattern.',
};

/**
 * Makes text safe to put in a table cell.
 *
 * Backslashes go first. Escaping the pipe in `a\|b` without them produces
 * `a\\|b`, where the backslash escapes the backslash and the pipe breaks the
 * row. A newline ends the row outright, so those collapse to a space.
 */
function escapeCell(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ');
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export interface ReportOptions {
  /** Agent the report describes, if the caller knows it. */
  agentName?: string;
  /** Window the sessions came from, as text the reader understands. */
  window?: string;
  /** How many example intents to print per cluster. */
  maxIntents?: number;
}

export function renderMarkdownReport(
  clusters: Cluster[],
  options: ReportOptions = {}
): string {
  const maxIntents = options.maxIntents ?? 5;
  const sessions = clusters.reduce((n, c) => n + c.sessionCount, 0);
  const modelCalls = clusters.reduce((n, c) => n + c.modelCalls, 0);
  const reducible = reducibleModelCalls(clusters);

  const lines: string[] = [];

  lines.push(`# Agent audit${options.agentName ? `: ${options.agentName}` : ''}`);
  lines.push('');
  if (options.window) lines.push(`Sessions from ${options.window}.`, '');

  lines.push(
    `${plural(sessions, 'session falls', 'sessions fall')} into ` +
      `${plural(clusters.length, 'pattern', 'patterns')}. ` +
      `They cost ${plural(modelCalls, 'model call', 'model calls')}.`
  );
  lines.push('');

  if (reducible > 0) {
    lines.push(
      `${plural(reducible, 'of those calls is a reasoning step', 'of those calls are reasoning steps')} on work the agent has ` +
        `already shown it can do the same way every time. Compiling the ` +
        `patterns marked "Compile this" removes them. Routing and guardrails ` +
        `stay, so the session does not become free. It becomes cheaper.`
    );
  } else {
    lines.push('Nothing here is ready to compile yet.');
  }
  lines.push('');

  lines.push('## What the agent does');
  lines.push('');
  lines.push('| Sessions | Pattern | Actions | Model calls each | Score | Verdict |');
  lines.push('|---:|---|---|---:|---:|---|');
  for (const c of clusters) {
    const cells = [
      String(c.sessionCount),
      escapeCell(c.signature),
      c.actions.length ? escapeCell(c.actions.join(', ')) : 'none',
      String(c.modelCallsPerSession),
      c.qualityScore === null ? 'none' : c.qualityScore.toFixed(1),
      VERDICT_TEXT[c.verdict],
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');

  lines.push('## The patterns in detail');
  lines.push('');
  for (const c of clusters) {
    lines.push(`### ${c.signature}`);
    lines.push('');
    lines.push(
      `${plural(c.sessionCount, 'session', 'sessions')}, ` +
        `${plural(c.modelCalls, 'model call', 'model calls')}, ` +
        `${c.modelCallsPerSession} per session.`
    );
    lines.push('');
    lines.push(`**${VERDICT_TEXT[c.verdict]}.** ${VERDICT_WHY[c.verdict]}`);
    lines.push('');
    if (c.intents.length) {
      lines.push('What people asked for:');
      lines.push('');
      for (const intent of c.intents.slice(0, maxIntents)) {
        lines.push(`- ${intent}`);
      }
      const hidden = c.intents.length - maxIntents;
      if (hidden > 0) lines.push(`- and ${hidden} more`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(
    'Model calls are counted from the session trace. Token counts and credit ' +
      'consumption are not reported, because they are not readable in every ' +
      'org and an estimate would be a guess.'
  );
  lines.push('');

  return lines.join('\n');
}
