# Contributing

Glad you are here. This is an early project, so the fastest way to help is to open an issue before you write code.

## Before you start

Open an issue for anything larger than a typo fix. A pull request that arrives with no issue behind it can be work that nobody wanted, and that wastes your time more than mine.

A good issue answers five questions:

1. **What is the problem?** Describe the behaviour, not the solution you have in mind.
2. **What is the evidence?** Give the command, the output, or the file and line.
3. **What is the scope?** Say what changes, and say what does not change.
4. **What is the acceptance criterion?** Write a checklist a reviewer can confirm.
5. **How do you verify it?** Name the test or the command that proves it works.

Reproduce a bug before you report it. If you are not sure yet, open a spike instead. A spike is a time-boxed question, and the written answer is the deliverable.

## Set up

```bash
git clone https://github.com/aalhabli/tokenzempic.git
cd tokenzempic
npm install
npm run build
npm test
```

You need Node 22.5 or later, and the Salesforce `sf` CLI for anything that touches an org.

## Make the change

1. Branch from fresh `origin/main`. Name the branch `<issue-number>-short-slug`.
2. Keep the business logic in `packages/core/`. The command layer in `packages/cli/` parses the input and prints the output. It holds no logic.
3. Add a test for new logic. A change to the code generator needs a parity test that compares the generated output against a recorded session.
4. Stage explicit paths with `git add <path>`. Do not run `git add .`.
5. Run `npm run lint && npm run build && npm test`. All three must pass.

## Open the pull request

- Title: `#12: short summary in the imperative`.
- Body: start with `Resolves #12`, then fill the template.
- Keep it small. If the diff passes about 400 lines of hand-written code, split the issue.
- Review your own diff line by line first.

I squash and merge once CI is green.

## Writing

Everything in this repository follows [the style guide](docs/style-guide.md): ASD-STE100 Simplified Technical English, plain tone, no marketing words. This applies to your issue, your commit messages, and your pull request, not only to the documentation. Read the guide once. It takes two minutes.

## Never commit

- An org ID, a session ID, an access token, or a refresh token
- An LLM API key, or a `.env` file
- A real customer conversation, name, or email address

Use the placeholder forms: `00Dxx0000000000`, `sk-...`, `user@example.com`. CI runs a secret scan on every pull request, and GitHub push protection blocks a known token before it lands. Neither one is a substitute for reading your own diff.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
