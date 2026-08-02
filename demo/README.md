# Nimbus Coffee demo org

Scaffolding, not product. This directory builds a throwaway org that behaves
like a customer service deployment, so there is something real to point
tokenzempic at. You do not need any of this to use the tool.

It holds the `Coffee_Order__c` object, a seed script, three Flows, and the
Nimbus agent. The agent is an Agent Script authoring bundle, so the whole agent
is one reviewable file.

## Build it

Your org needs Data Cloud and session tracing first. The README covers that.

Set the agent user before you publish. Open
`force-app/main/default/aiAuthoringBundles/Nimbus/Nimbus.agent` and replace
`AGENT_USER_PLACEHOLDER` with your org's Agentforce Service Agent user. The
repository does not carry that username, because it contains an org ID.

```bash
sf project deploy start -d demo/force-app -o <your-org>
python demo/scripts/seed_data.py
sf agent validate authoring-bundle -n Nimbus -o <your-org>
sf agent publish authoring-bundle -n Nimbus -o <your-org>
sf agent activate -n Nimbus --version 1 -o <your-org>
```

Publishing writes `bots/` and `genAiPlannerBundles/` into the project. Those are
generated and the repository ignores them. The bundle is the source.

## Two traps

Both cost a day if you meet them cold.

- **Every action must declare at least one input.** An action with none fails to
  publish. Leaving the `inputs` block out does not satisfy it either.
- **A Flow an agent calls needs `runInMode` set to `SystemModeWithoutSharing`.**
  The Agentforce Service Agent user gets object and field access but not
  internal record sharing. Without system mode the Flow finds nothing, and the
  agent reports that politely rather than failing. It reads like a bad topic
  description, and it is not.

## Topics

Five subagents. Four do the work: order status, password reset, returns and
refunds, and general support. Off Topic is the guard.

General support is deliberate. The Service Agent template's Off Topic deflects
instead of helping, and the honest tail of a support queue is complaints and
advice. That tail is the work worth paying a model for, so it has to survive
distillation and be visible when it does.
