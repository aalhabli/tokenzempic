# tokenzempic

*Put your agent on a zero token diet.*

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

## Privacy

Runs entirely on your machine against your org, using supported Salesforce APIs. Session logs never leave your infrastructure. Bring your own LLM key for the small parts that need one.

## Status

Early. Nothing to install yet. v0.1 (the read-only agent audit) is in progress. Watch the repo if you want to know when it lands.

## License

Apache-2.0
