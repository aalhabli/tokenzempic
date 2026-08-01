# Decision records

A decision record holds one architectural decision and the reason behind it. It answers the question "why is it like this?" a year later, when the reason is no longer in anybody's head.

Write one when a choice is hard to reverse, when you rejected a reasonable alternative, or when the next person will want to undo it.

## How to add one

1. Copy the template below to `NNNN-short-title.md`. Use the next free number.
2. Fill it in. Keep it to one page.
3. Include it in the pull request that carries the change.
4. Never edit an accepted record. Write a new one, and set the old one to `Superseded by NNNN`.

## Template

```markdown
# NNNN. Title in the imperative

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context

What forced the decision. The constraint, the measurement, or the failure.

## Decision

What we do. One or two sentences, in the active voice.

## Alternatives

What else we looked at, and why we rejected it.

## Consequences

What becomes easier. What becomes harder. What we must watch.
```
