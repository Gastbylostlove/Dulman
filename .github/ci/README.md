# AI PR review

The workflow runs only when a repository user with `push`, `maintain`, or
`admin` permission comments on a PR with exactly one of:

```text
@codex review
@claude review
```

Required repository configuration:

- Secret `OPENAI_API_KEY` for `@codex`.
- Secret `ANTHROPIC_API_KEY` for `@claude`.
- Variable `CODEX_MODEL` for the OpenAI Responses API model.
- Variable `CLAUDE_MODEL` for the Anthropic Messages API model.

The workflow checks out only the default branch. It reads the PR diff through
the GitHub API and never executes fork code. The diff and `docs/rules/` are
sent to the selected provider, so do not use this review flow for confidential
code unless that provider is approved for the repository.

The workflow creates an `AI PR Review` check on the PR head commit. Configure
that check as a required status check in the `main` branch protection rules.
Then a finding with `blocking: true` fails the check and prevents merge. After
the code is fixed, push the commit and request a new review with the same tag.

This check is intentionally not an automatic review on every push. The
comment selects the provider and controls provider usage.
