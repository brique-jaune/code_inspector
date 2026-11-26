# jira-check

A Claude Code mod that audits a Jira ticket and its dependencies, and
publishes the result as an artifact: a tree of cards that tells, ticket by
ticket, whether it is ready to be developed.

The page is in French; this document quotes its labels as they appear on
screen.

## What the page shows

- **The tree**: the ticket at the top, its children below it, their own
  children on a rail under each of them. The tickets joined by a Jira link
  stand beside the root; the tickets only mentioned in the texts are listed
  under them with their status.
- **On each card**: the key (a link to Jira), the type, the status, the title
  and, for a child, the "Scope adressé": the part of its parent's scope it
  takes up. A pull request found for the ticket hangs under its card.
- **Three icons**, each opening its detail at the bottom of the card:
  - the comment icon, on the tickets that have comments: red when a question
    is left unanswered, green when all are answered;
  - the tree icon, on the tickets that have children: red when a point of the
    scope is taken up by no child, green when all are;
  - the verdict: a green check when the three criteria hold ("Commentaires",
    "Scope couvert", "Contradictions"), an amber mark for a reservation, a red
    cross otherwise. It opens the three criteria and the contradictions that
    touch the ticket.
- **A row of counts**: tickets "conformes", "avec réserve", "non conformes".

Open questions written in a description are not a criterion: they show as a
separate label on the card.

## Usage

```
/jira-check ABC-100
/jira-check ABC-100 ABC-101
```

A key may be typed bare or as the ticket's link. Each key gets its own
artifact, named "Cartographie <KEY>".

The command hands Claude the audit's rules (`assets/INSTRUCTIONS.md`) and the
page (`assets/template.html`). The page is the same file for every ticket: it
is copied as is and reads its content from a `data.json` published beside it,
so only the data changes from one audit to the next.

## Requirements

- Jira tools in the session: the
  [Atlassian MCP server](https://www.atlassian.com/platform/remote-mcp-server),
  connected and authorized. Without them nothing is published.
- The [GitHub CLI](https://cli.github.com), logged in, to look for the pull
  requests. Without it the cards carry none.
- The Artifact tool, to publish the page.

The audit is done by the model: it reads Jira and GitHub and writes nothing
to either.

## Installation

At the prompt of a terminal session:

```
/plugin install jira-check --marketplace brique-jaune/code_inspector
```

Answer `y` to add the marketplace, then choose a scope.

From a shell:

```
claude plugin install jira-check --marketplace brique-jaune/code_inspector
```

## Limitations

- The verdicts are the model's reading of the tickets: check a contradiction
  against its sources before acting on it.
- A ticket Jira does not return (deleted, no access) is reported as such, not
  audited.
- A pull request is found by the ticket key in its title, branch or body; one
  that names no key is missed.
- The "bloque" arrow is drawn only between two neighbouring children of the
  root; other blocking links show as labels.
