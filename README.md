# code_inspector

A marketplace of three Claude Code mods, each in its own folder.

| Mod | What it does | Command |
| --- | --- | --- |
| [code-inspector](code-inspector/README.md) | A pane to review the current branch: Claude's summary, the diffs with read marks and a model-judged filter, and Claude's notes on its pushbacks and trade-offs. | `/inspect` |
| [pr-tracker](pr-tracker/README.md) | A pane that lists your open GitHub pull requests with their review and CI state, and the pull requests waiting for your review. | `/prs` |
| [jira-check](jira-check/README.md) | A command that audits a Jira ticket and its dependencies, and publishes the result as a tree of cards: answered comments, scope covered by the children, contradictions, pull requests. | `/jira-check` |

## Installation

At the prompt of a terminal session, one line per mod:

```
/plugin install code-inspector --marketplace brique-jaune/code_inspector
/plugin install pr-tracker --marketplace brique-jaune/code_inspector
/plugin install jira-check --marketplace brique-jaune/code_inspector
```

Answer `y` to add the marketplace, then choose a scope.

From a shell:

```
claude plugin install code-inspector --marketplace brique-jaune/code_inspector
claude plugin install pr-tracker --marketplace brique-jaune/code_inspector
claude plugin install jira-check --marketplace brique-jaune/code_inspector
```

In the desktop app, where `/plugin` does not run: click `+` next to the input
box, then Plugins, Add marketplace with `brique-jaune/code_inspector`, then
Add plugin.

## Development

With `<mod>` one of `code-inspector`, `pr-tracker` and `jira-check`:

```
claude --plugin-dir ./<mod>        # loads the mod from its folder
claude plugin validate ./<mod>     # checks the manifest and the module
claude plugin test ./<mod>         # runs <mod>/tests/*.test.tsx
```

The last two run for every mod on every pull request
(`.github/workflows/ci.yml`).

### Releases

[release-please](https://github.com/googleapis/release-please) keeps a release
pull request open on `main` for each mod with something to release: merging it
bumps the version in that mod's `.claude-plugin/plugin.json`, writes its
`CHANGELOG.md` and tags the release. It reads
[Conventional Commits](https://www.conventionalcommits.org): only a `feat:` or
a `fix:` commit makes a release, of the mod whose folder the commit touches.
