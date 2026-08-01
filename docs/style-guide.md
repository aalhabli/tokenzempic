# Style guide

This applies to every word in the repository: the documentation, the code comments, the issues, the pull requests, the commit messages, and the text that the tool itself generates.

The last one is the reason this guide exists. `sf tokenzempic compile` writes pull request bodies that a human reviews under time pressure. That text follows the same rules as the rest of the repository.

---

## Simplified Technical English

All writing follows **ASD-STE100 Simplified Technical English**, the controlled English standard from the aerospace industry. The specification is at [asd-ste100.org](https://www.asd-ste100.org/). The approved dictionary is licensed and is not in this repository.

The working rules:

### Words

- Use one word for one meaning. Use the same word for the same thing every time. A trace is a trace in every file. It is never a "log", a "record", or a "capture".
- Use short, common words. Do not use *leverage*, *utilize*, *facilitate*, *delve*, or *ensure*. Write *make sure*.
- Keep a noun cluster to three words or fewer. Write "the signature of the action sequence", not "action sequence signature hash".
- Write the full form of an abbreviation the first time you use it in a document.

### Verbs

- Use the active voice. Write "The command reads the trace." Do not write "The trace is read by the command."
- Use the simple tenses only: present, past, and future. Do not use the present perfect or the past perfect.
- Do not use an *-ing* form as an adjective or a noun. Write "the file that holds the trace", not "the trace-holding file".

### Sentences

- An instruction has 20 words or fewer. A description has 25 words or fewer.
- Give one instruction in one sentence.
- Start an instruction with the verb. Write "Open the issue first."
- Use the articles *a*, *an*, and *the*. Do not drop them.
- A descriptive paragraph has six sentences or fewer.

---

## Tone

Simplified Technical English controls the grammar. These rules control the tone. Write like a busy engineer who explains something to a peer.

- Do not open with a preamble. Cut "Great question" and "Sure, here is".
- Do not restate the task before you do it.
- Do not close with a summary that adds nothing new.
- Do not use these words: *robust*, *seamless*, *powerful*, *comprehensive*, *crucial*, *essential*, *streamline*, *unlock*, *elevate*, *game-changer*, *best-in-class*.
- Do not write "It is worth noting that" or "It is important to note that".
- Do not use the "not only X, but also Y" pattern. Do not use the "It is not X, it is Y" pattern.
- Do not pad a list to three items for rhythm. Two items are fine. One item is fine.
- Do not put an emoji in a heading, a commit message, a pull request, or a document.
- Do not claim a result that you did not measure. Write the measured number, or write nothing.

Read the text aloud before you commit it. If it sounds like a brochure, rewrite it.

---

## The one exemption

The pitch in `README.md` does not follow Simplified Technical English. It sits between the `<!-- ste:off -->` and `<!-- ste:on -->` markers. Everything outside those markers follows the guide, in every file.

Do not add a second exempt block.

---

## Redaction

Never put real data in the repository or in an issue. This covers:

- An org ID, a session ID, an access token, or a refresh token
- An LLM API key
- A customer conversation, a name, or an email address

Use the placeholder forms in an example: `00Dxx0000000000`, `sk-...`, `user@example.com`. `.gitleaks.toml` holds the patterns that CI blocks.
