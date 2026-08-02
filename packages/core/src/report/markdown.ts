/**
 * The audit report: what the agent does all day, and which of it is worth
 * compiling.
 *
 * The report quotes model calls, never tokens and never money. Token counts
 * are not readable in every org, and a currency figure would be a guess.
 */

import type { Cluster, Distillability } from '../cluster/cluster.js';
import { reducibleModelCalls } from '../cluster/cluster.js';

function thousands(n: number): string {
  return n.toLocaleString('en-US');
}

const VERDICT_TEXT: Record<Distillability, string> = {
  distillable: 'Compile this',
  unscored: 'Look before you compile',
  'poor-quality': 'Fix the agent first',
  'static-answer': 'Write it down once',
  'no-actions': 'Leave it to the agent',
  inconsistent: 'Sometimes acts, sometimes not',
  'too-few': 'Not yet a pattern',
};

const VERDICT_WHY: Record<Distillability, string> = {
  distillable: 'It repeats, it runs the same actions, and the org scores it well.',
  unscored: 'It repeats and runs actions, but nothing has scored it yet.',
  'poor-quality': 'The org scores it below the floor. Compiling would fix a bad answer in place.',
  'static-answer':
    'The same question keeps arriving and the agent writes the same answer every ' +
    'time. It calls nothing, so there is nothing to speed up, only something to ' +
    'stop regenerating. A knowledge article or a screen flow ends it.',
  'no-actions': 'The agent only reasoned, and its answers differ each time. Real judgement work.',
  inconsistent:
    'Other sessions on this topic reach an action and these do not. The trace ' +
    'does not say why. The agent may be asking for something it could already ' +
    'have, or it may be answering another way. Read a few before you compile.',
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

/**
 * What the org pays for one unit of each kind. The tool ships no price list:
 * a rate depends on the contract, and a stale one would be a lie with a
 * decimal point on it. Supply this and the report gives money. Leave it out
 * and the report gives counts.
 */
export type UnitRates = Record<string, number>;

export interface ReportOptions {
  /** Credit or currency cost per billable unit, keyed by unit name. */
  unitRates?: UnitRates;
  /** What one unit of `unitRates` is called, for example "credits". */
  rateLabel?: string;
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
  const tokens = clusters.reduce((n, c) => n + (c.tokens ?? 0), 0);
  const billable = clusters.reduce((n, c) => n + c.billableTotal, 0);
  const rates = options.unitRates;
  const rateLabel = options.rateLabel ?? 'credits';
  const priced = (units: Record<string, number>): number | null => {
    if (!rates) return null;
    let total = 0;
    for (const [unit, n] of Object.entries(units)) {
      const rate = rates[unit];
      if (rate === undefined) return null;
      total += n * rate;
    }
    return total;
  };
  const allUnits: Record<string, number> = {};
  for (const c of clusters) {
    for (const [u, n] of Object.entries(c.billableUnits)) allUnits[u] = (allUnits[u] ?? 0) + n;
  }
  const totalPriced = priced(allUnits);
  const reducible = reducibleModelCalls(clusters);
  const wasted = clusters
    .filter((c) => c.verdict === 'inconsistent')
    .reduce((n, c) => n + (c.tokens ?? 0), 0);
  const wastedSessions = clusters
    .filter((c) => c.verdict === 'inconsistent')
    .reduce((n, c) => n + c.sessionCount, 0);

  const lines: string[] = [];

  lines.push(`# Agent audit${options.agentName ? `: ${options.agentName}` : ''}`);
  lines.push('');
  if (options.window) lines.push(`Sessions from ${options.window}.`, '');

  lines.push(
    `${plural(sessions, 'session falls', 'sessions fall')} into ` +
      `${plural(clusters.length, 'pattern', 'patterns')}. ` +
      `They cost ${plural(billable, 'billable unit', 'billable units')}` +
      (totalPriced !== null ? ` (${thousands(Math.round(totalPriced))} ${rateLabel})` : '') +
      `, across ${plural(modelCalls, 'model call', 'model calls')}` +
      (tokens > 0 ? ` and ${thousands(tokens)} tokens.` : '.')
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

  if (wastedSessions > 0) {
    lines.push(
      `${plural(wastedSessions, 'session', 'sessions')} did not reach an action ` +
        `that other sessions on the same topic did reach` +
        (wasted > 0 ? `, at a cost of ${thousands(wasted)} tokens` : '') +
        `. Read the patterns marked "Sometimes acts, sometimes not" before you ` +
        `compile anything.`
    );
    lines.push('');
  }

  lines.push('## What the agent does');
  lines.push('');
  lines.push(
    '| Sessions | Turns each | Units each | Pattern | Actions | Tokens | Same answer | Verdict |'
  );
  lines.push('|---:|---:|---:|---|---|---:|---:|---|');
  for (const c of clusters) {
    const cells = [
      String(c.sessionCount),
      String(c.turnsPerSession),
      String(c.billablePerSession),
      escapeCell(c.signature),
      c.actions.length ? escapeCell(c.actions.join(', ')) : 'none',
      c.tokens === null ? 'not yet' : thousands(c.tokens),
      c.answerStability === null ? '-' : `${Math.round(c.answerStability * 100)}%`,
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
    const unitLine = Object.entries(c.billableUnits)
      .sort((a, b) => b[1] - a[1])
      .map(([u, n]) => `${thousands(n)} ${u}`)
      .join(', ');
    lines.push(
      `${plural(c.sessionCount, 'session', 'sessions')}, ` +
        `${plural(c.turns, 'customer turn', 'customer turns')}, ` +
        (unitLine ? `${unitLine}, ` : '') +
        `${plural(c.modelCalls, 'model call', 'model calls')}, ` +
        `${c.modelCallsPerSession} per session` +
        (c.tokens === null ? '.' : `, ${thousands(c.tokens)} tokens.`)
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
    'Billable units come from the org\'s own metering, which is what Flex ' +
      'Credits charge for. A change can cut tokens and still raise the bill by ' +
      'adding actions, so the units lead and the tokens follow. No price is ' +
      'given unless you supply the rates, because a rate depends on your ' +
      'contract. ' +
      'Model calls are counted from the session trace. Token counts come from ' +
      'the org\'s own metering, which lands hours after the trace does, so a ' +
      'recent pattern reads "not yet" rather than zero. No money figure is ' +
      'given, because the rate depends on the contract and an estimate would ' +
      'be a guess.'
  );
  lines.push('');

  return lines.join('\n');
}
