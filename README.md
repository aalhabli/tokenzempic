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

## Privacy

tokenzempic runs on your machine. It reads your org through the supported Salesforce APIs. Your session logs stay in your infrastructure. You bring your own LLM key for the small parts that need one.

## Status

Early. There is nothing to install yet. Version 0.1 is the read-only agent audit, and it is in progress. Watch the repository to see when it lands.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then [the style guide](docs/style-guide.md). Report a vulnerability through [SECURITY.md](SECURITY.md), not through a public issue.

## License

Apache-2.0
