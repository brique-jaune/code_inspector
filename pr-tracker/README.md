# pr-tracker

A Claude Code mod that opens a pane listing your GitHub pull requests, to the
right of the conversation: the ones you opened, with where their review and
their checks stand, and the ones waiting for your review.

The pane's interface is in French; this document quotes its labels as they
appear on screen.

## What the pane shows

- **A row of counts**: ✅ approved, ⚠️ changes requested, 👀 waiting for a
  review, ✏️ drafts, 📄 reviews asked of you.
- **Your open pull requests**, in four groups: "Approuvées", "Changements
  demandés", "En attente de review" and "Draft".
- **"À reviewer"**: the open pull requests whose review is requested from you
  or from one of your teams, with their author.

Each row holds:

- a dot for the checks of the last commit: green passed, red failed, yellow
  running, `○` when there is none;
- the repository in two letters (`acme/client-lib` is `CL`, `acme/workspace`
  is `WO`);
- the number, a link that opens the pull request;
- the title, and how long ago the pull request last changed.

Pull requests of archived repositories are left out. Each list holds the 50
most recently updated; a line says how many more GitHub has.

## Usage

Type `/prs` to open the pane and read GitHub.

The lists are read again every 30 minutes while the pane is open, and on the
"↻ Rafraîchir" button. A closed pane asks GitHub for nothing.

## Requirements

The mod reads GitHub through the [GitHub CLI](https://cli.github.com): `gh`
must be installed and logged in (`gh auth login`). It runs one command,
`gh api graphql`, with two searches; it writes nothing to GitHub, and no model
is called.

## Installation

At the prompt of a terminal session:

```
/plugin install pr-tracker --marketplace brique-jaune/code_inspector
```

Answer `y` to add the marketplace, then choose a scope.

From a shell:

```
claude plugin install pr-tracker --marketplace brique-jaune/code_inspector
```

In the desktop app, where `/plugin` does not run: click `+` next to the input
box, then Plugins, Add marketplace with `brique-jaune/code_inspector`, then
Add plugin.

## Limitations

- Two repositories may share the same two letters; the link tells them apart.
- The age shown is the one at the last redraw of the pane, not a live clock.
- The review state is GitHub's overall decision for the pull request: who
  approved or what was asked is on the pull request's page.
