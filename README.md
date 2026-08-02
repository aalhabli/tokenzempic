# tokenzempic

<!-- ste:off -->

*Put your Salesforce Agentforce agents on a zero token diet.*

Your Agentforce agent answered the same question 400 times last month. You paid it to think, every time.

tokenzempic is an `sf` CLI plugin that reads your agent's session traces — the diary Salesforce already keeps — finds what the agent does repeatedly, and opens a GitHub PR that replaces the repeats with plain Apex and Flows. The PR comes with parity tests that replay real sessions to prove the new logic does what the agent did. Anything the deterministic path doesn't recognize falls back to the agent, so nothing breaks on day one.

Salesforce's own architecture guide calls using an agent for repeatable work an anti-pattern. This is the cleanup tool.

## How it works

1. `sf tokenzempic study` pulls session traces and clusters them by what the agent *did*, not what users said. Clustering is plain code plus embeddings — no model reads your logs.
2. `sf tokenzempic report` shows what your agent does all day and what each slice costs.
3. `sf tokenzempic compile` writes Apex for the biggest cluster, generates parity tests, and opens a PR. A human reviews the diff. Nothing deploys on its own.
4. Repeat. Every merge moves more traffic off the meter.

## Honest numbers

- Agents with structured triggers (record-triggered, button-invoked): genuinely zero tokens after conversion.
- Conversational agents: one cheap classifier call replaces a 5–15 call reasoning loop. Roughly 90% fewer tokens, and everything after intent capture is deterministic.
- The agent keeps the genuinely new stuff. That's the only part worth paying per-token for.

<!-- ste:on -->

## What your org needs

tokenzempic reads the session traces that Agentforce writes to Data Cloud. An
org that does not write them has nothing for the tool to read. Turn on tracing
before you install anything.

1. Provision **Data Cloud**. The session-tracing objects live there.
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

Tracing applies to sessions that start after you turn it on. Earlier
conversations are not backfilled.

To confirm that the traces arrive, have one conversation, wait about five
minutes, then run:

```bash
echo '{"sql":"SELECT ssot__Id__c FROM ssot__AiAgentSession__dlm LIMIT 10"}' \
  | sf api request rest "/services/data/v67.0/ssot/queryv2" --method POST -b - -o <your-org>
```

Measured in a Developer Edition org: sessions, turns, steps, and messages
appear about three to five minutes after the conversation ends. Plan a demo
around that delay.

## The demo org

`demo/` holds the Nimbus Coffee org: the custom object, the seed script, three
Flows, and the Nimbus agent. The agent is an Agent Script authoring bundle, so
the whole agent is one reviewable file.

Set the agent user first. Open
`demo/force-app/main/default/aiAuthoringBundles/Nimbus/Nimbus.agent` and replace
`AGENT_USER_PLACEHOLDER` with the username of your org's Agentforce Service
Agent user. The repository does not carry that username, because it contains an
org ID.

```bash
sf project deploy start -d demo/force-app -o <your-org>
sf agent validate authoring-bundle -n Nimbus -o <your-org>
sf agent publish authoring-bundle -n Nimbus -o <your-org>
sf agent activate -n Nimbus --version 1 -o <your-org>
```

Publishing writes `bots/` and `genAiPlannerBundles/` into the project. Those
files are generated, so the repository ignores them. The bundle is the source.

Two things to know if you build your own agent this way:

- Every action must declare at least one input. An action with no inputs fails
  to publish.
- A Flow that an agent calls needs `runInMode` set to
  `SystemModeWithoutSharing`. The Agentforce Service Agent user does not get
  internal record sharing. Without it the Flow finds no records, and the agent
  reports that politely instead of failing.

## Privacy

tokenzempic runs on your machine. It reads your org through the supported Salesforce APIs. Your session logs stay in your infrastructure. You bring your own LLM key for the small parts that need one.

## Status

Early. There is nothing to install yet. Version 0.1 is the read-only agent audit, and it is in progress. Watch the repository to see when it lands.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then [the style guide](docs/style-guide.md). Report a vulnerability through [SECURITY.md](SECURITY.md), not through a public issue.

## License

Apache-2.0
