/**
 * The Data Cloud SQL that reads the session-tracing DMOs.
 *
 * One statement per DMO, joined in memory afterwards. Data Cloud can join,
 * but a failed join gives you one unhelpful error for the whole read, and
 * these tables are small per time window. Separate reads also let the caller
 * page each table on its own.
 */

import type {
  DataCloudQuery,
  InteractionRow,
  MessageRow,
  RawTrace,
  SessionRow,
  StepRow,
  UsageRow,
} from './types.js';

/** Data Cloud wants a timestamp literal, not a bind variable. */
function timestampLiteral(since: Date): string {
  return `TIMESTAMP '${since.toISOString().replace('T', ' ').replace('Z', '')}'`;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function sessionSql(since: Date, limit: number): string {
  return [
    'SELECT ssot__Id__c, ssot__StartTimestamp__c, ssot__EndTimestamp__c,',
    '       ssot__AiAgentSessionEndType__c',
    'FROM ssot__AiAgentSession__dlm',
    `WHERE ssot__StartTimestamp__c >= ${timestampLiteral(since)}`,
    'ORDER BY ssot__StartTimestamp__c DESC',
    `LIMIT ${limit}`,
  ].join(' ');
}

export function interactionSql(since: Date, limit: number): string {
  return [
    'SELECT ssot__Id__c, ssot__AiAgentSessionId__c, ssot__TopicApiName__c,',
    '       ssot__StartTimestamp__c, ssot__AiAgentInteractionType__c',
    'FROM ssot__AiAgentInteraction__dlm',
    `WHERE ssot__StartTimestamp__c >= ${timestampLiteral(since)}`,
    'ORDER BY ssot__StartTimestamp__c ASC',
    `LIMIT ${limit}`,
  ].join(' ');
}

export function stepSql(since: Date, limit: number): string {
  return [
    'SELECT ssot__Id__c, ssot__AiAgentInteractionId__c, ssot__Name__c,',
    '       ssot__AiAgentInteractionStepType__c, SubType__c,',
    '       ssot__InputValueText__c, ssot__OutputValueText__c,',
    '       ssot__ErrorMessageText__c, ssot__StartTimestamp__c',
    'FROM ssot__AiAgentInteractionStep__dlm',
    `WHERE ssot__StartTimestamp__c >= ${timestampLiteral(since)}`,
    'ORDER BY ssot__StartTimestamp__c ASC',
    `LIMIT ${limit}`,
  ].join(' ');
}

export function messageSql(since: Date, limit: number): string {
  return [
    'SELECT ssot__Id__c, ssot__AiAgentSessionId__c, ssot__AiAgentInteractionId__c,',
    '       ssot__AiAgentInteractionMessageType__c, ssot__ContentText__c,',
    '       ssot__MessageSentTimestamp__c',
    'FROM ssot__AiAgentInteractionMessage__dlm',
    `WHERE ssot__MessageSentTimestamp__c >= ${timestampLiteral(since)}`,
    'ORDER BY ssot__MessageSentTimestamp__c ASC',
    `LIMIT ${limit}`,
  ].join(' ');
}

export function usageSql(since: Date, limit: number): string {
  return [
    'SELECT AiAgentSessionId__c, AiAgentInteractionId__c, PromptInputTokenCount__c,',
    '       PromptCompletionTokenCount__c, PromptTotalTokenCount__c, UsageQuantity__c,',
    '       IsBillableIndicator__c, IsMeteredIndicator__c, ModelProviderModelName__c,',
    '       AiAgentToolName__c',
    'FROM AiAgentGenerativeAiUsage_std__dlm',
    `WHERE Timestamp__c >= ${timestampLiteral(since)}`,
    `LIMIT ${limit}`,
  ].join(' ');
}

/** Reads every table for one time window. */
export async function readRawTrace(
  query: DataCloudQuery,
  since: Date,
  limit = 5000
): Promise<RawTrace> {
  const [sessions, interactions, steps, messages, usage] = await Promise.all([
    query(sessionSql(since, limit)),
    query(interactionSql(since, limit)),
    query(stepSql(since, limit)),
    query(messageSql(since, limit)),
    query(usageSql(since, limit)),
  ]);

  return {
    sessions: sessions.map(
      (r): SessionRow => ({
        id: str(r.ssot__Id__c) ?? '',
        startedAt: str(r.ssot__StartTimestamp__c),
        endedAt: str(r.ssot__EndTimestamp__c),
        endType: str(r.ssot__AiAgentSessionEndType__c),
      })
    ),
    interactions: interactions.map(
      (r): InteractionRow => ({
        id: str(r.ssot__Id__c) ?? '',
        sessionId: str(r.ssot__AiAgentSessionId__c) ?? '',
        topicApiName: str(r.ssot__TopicApiName__c),
        startedAt: str(r.ssot__StartTimestamp__c),
        interactionType: str(r.ssot__AiAgentInteractionType__c),
      })
    ),
    steps: steps.map(
      (r): StepRow => ({
        id: str(r.ssot__Id__c) ?? '',
        interactionId: str(r.ssot__AiAgentInteractionId__c) ?? '',
        name: str(r.ssot__Name__c),
        stepType: str(r.ssot__AiAgentInteractionStepType__c),
        subType: str(r.SubType__c),
        inputValue: str(r.ssot__InputValueText__c),
        outputValue: str(r.ssot__OutputValueText__c),
        errorMessage: str(r.ssot__ErrorMessageText__c),
        startedAt: str(r.ssot__StartTimestamp__c),
      })
    ),
    messages: messages.map(
      (r): MessageRow => ({
        id: str(r.ssot__Id__c) ?? '',
        sessionId: str(r.ssot__AiAgentSessionId__c) ?? '',
        interactionId: str(r.ssot__AiAgentInteractionId__c),
        messageType: str(r.ssot__AiAgentInteractionMessageType__c),
        content: str(r.ssot__ContentText__c),
        sentAt: str(r.ssot__MessageSentTimestamp__c),
      })
    ),
    usage: usage.map(
      (r): UsageRow => ({
        sessionId: str(r.AiAgentSessionId__c) ?? '',
        interactionId: str(r.AiAgentInteractionId__c),
        inputTokens: num(r.PromptInputTokenCount__c),
        outputTokens: num(r.PromptCompletionTokenCount__c),
        totalTokens: num(r.PromptTotalTokenCount__c),
        usageQuantity: num(r.UsageQuantity__c),
        isBillable: bool(r.IsBillableIndicator__c),
        isMetered: bool(r.IsMeteredIndicator__c),
        modelName: str(r.ModelProviderModelName__c),
        toolName: str(r.AiAgentToolName__c),
      })
    ),
  };
}
