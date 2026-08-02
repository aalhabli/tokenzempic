/**
 * The values Agentforce actually writes to the session-tracing DMOs.
 *
 * Confirmed against a real traced org on 2026-08-02 (API v67.0). Salesforce
 * does not publish this list, so treat it as observed, not guaranteed, and
 * re-check it with `observedVocabulary` after a platform release.
 */

/** ssot__AiAgentInteractionStep__dlm.ssot__AiAgentInteractionStepType__c */
export const StepType = {
  /** The router choosing a subagent. Name is `agent_router`. */
  Topic: 'TOPIC_STEP',
  /** A safety or guardrail classifier. */
  Classifier: 'CLASSIFIER_STEP',
  /** The subagent's reasoning turn. Name is the subagent. This is the cost. */
  Llm: 'LLM_STEP',
  /** The agent invoking a tool. Sub type is `flow`, `apex`, and so on. */
  Action: 'ACTION_STEP',
  /** Instruction-adherence checking. */
  TrustGuardrails: 'TRUST_GUARDRAILS_STEP',
  /** Session state bookkeeping. Free. */
  VariableUpdate: 'VARIABLE_UPDATE_STEP',
  /** Terminal step. Its name carries the reason, such as CLOSED_USER_REQUEST. */
  SessionEnd: 'SESSION_END',
} as const;

/** ssot__AiAgentInteractionMessage__dlm.ssot__AiAgentInteractionMessageType__c */
export const MessageType = {
  User: 'Input',
  Agent: 'Output',
} as const;

/** ssot__AiAgentInteraction__dlm.ssot__AiAgentInteractionType__c */
export const InteractionType = {
  Turn: 'TURN',
  SessionEnd: 'SESSION_END',
} as const;

/**
 * Step types that burn a model call. Everything else in a session is
 * bookkeeping or deterministic execution, and saying otherwise would
 * overstate what distillation saves.
 */
export const BILLABLE_STEP_TYPES: readonly string[] = [
  StepType.Topic,
  StepType.Classifier,
  StepType.Llm,
  StepType.TrustGuardrails,
];
