# tokenzempic

An `sf` CLI plugin that reads Agentforce session traces and reports what your
agent's conversation patterns cost, in the units Salesforce bills you for.

Agentforce records what an agent did, turn by turn, in Data Cloud. Nothing reads
those traces and tells you which conversations cost more than they need to.
That is the gap this fills.

## What it does

It reads the session traces, groups the sessions by what the agent did and by
what people asked for, and reports each pattern with its volume, its turn count,
and its cost. Then it says which patterns look reducible, and why.

It spends nothing to do this. Grouping is string comparison, and the intent
labels come from Agentforce Optimization, which already writes them for every
session. No model reads your traces.

## What we measured

Every figure below comes from one Developer Edition org running a seeded
corpus. Your org will differ. They are here because the design rests on them,
not as a promise about your numbers.

**Cost is close to linear in the number of customer messages.** One message
costs exactly one billable interaction, plus about six model-call units.
Measured across 334 sessions, with no exception. So a three-message exchange
costs roughly three times a one-message exchange.

**A turn cannot be made free.** Any turn that reaches a subagent costs at least
three model calls: the router, a guardrail, and the subagent's own reasoning.
Agent Script has no statement that ends a turn or answers without entering the
reasoning loop, so no amount of generated code removes that floor.

**Turns are the only lever that moved.** On one intent, removing a single turn
cut tokens by 36% and billable units by 29%. The agent also resolved more
sessions, not fewer.

**The prompt is mostly not yours.** Input is 98% of token spend, and about 74%
of a subagent's prompt is Salesforce system text you cannot edit. Shortening
your own instructions changes little.

## What it does not do

It does not make an agent free, and it will not tell you it can.

It does not generate code yet. Reading and reporting work; the part that
proposes a change is not built.

It does not replace Agentforce Optimization. Optimization scores conversation
quality and groups moments by intent. It never links an intent to the actions
that served it. That join is what this tool adds, so the two work better
together than apart.

## What your org needs

Point tokenzempic at the org where your agent already runs: a sandbox, or
production. It reads the session traces that Agentforce writes to Data Cloud.
An org that does not write them has nothing for the tool to read.

Turn tracing on before you install anything:

1. Provision **Data Cloud** in that org. The session-tracing objects live there.
2. Go to Setup, then **Einstein Audit, Analytics, and Monitoring Setup**.
3. Set **Data Space**. The audit APIs fail until an org selects one.
4. Turn on **Audit and Feedback**.
5. Turn on **Agentforce Session Tracing**. This also turns on Agent Platform
   Tracing, which records each Flow and Apex action.

Step 5 provisions these data model objects:

| Object | Holds |
|---|---|
| `ssot__AiAgentSession__dlm` | One conversation |
| `ssot__AiAgentInteraction__dlm` | One turn, and the topic the router chose |
| `ssot__AiAgentInteractionStep__dlm` | Each step in a turn, and each action call |
| `ssot__AiAgentInteractionMessage__dlm` | What the person and the agent said |
| `AiAgentGenerativeAiUsage_std__dlm` | Token counts and billable usage |

Three things to know before you plan around this:

- Tracing applies to sessions that start after you turn it on. Your existing
  conversation history is not backfilled, so the first useful report comes
  after your agent has run for a while under tracing.
- A sandbox refresh drops the traces with everything else. Turn tracing on
  again after a refresh.
- Three clocks run at different speeds. Traces arrive in minutes, the
  Optimization intent labels and scores in tens of minutes, and the billing
  figures in hours. A report run straight after a conversation shows the shape
  but not the cost.

To confirm that traces arrive, have one conversation, wait a few minutes, then
run:

```bash
echo '{"sql":"SELECT ssot__Id__c FROM ssot__AiAgentSession__dlm LIMIT 10"}' \
  | sf api request rest "/services/data/v67.0/ssot/queryv2" --method POST -b - -o <your-org>
```

Sessions, turns, steps, and messages showed up about three to five minutes
after a conversation ended in the org this was measured in. Treat that as the
order of magnitude, not a guarantee.

## Privacy

tokenzempic runs on your machine. It reads your org through the supported
Salesforce APIs. Your session traces stay in your infrastructure.

## Status

Early, and there is nothing to install yet. Reading traces, grouping them, and
reporting cost are done. The command line and the part that proposes a change
are not. Watch the repository to see when the first release lands.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then [the style guide](docs/style-guide.md). Report a vulnerability through [SECURITY.md](SECURITY.md), not through a public issue.

## License

Apache-2.0
