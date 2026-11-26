# jira-check: audit a Jira ticket and publish its map

You were sent here by the `/jira-check` command with one or more Jira keys.
For **each key**, audit the ticket and its dependencies, then publish **one
artifact per key**. The page is `template.html`, in this folder: it is copied
as is and never edited. Only `data.json` changes from one ticket to the next.

Everything written in `data.json` is in **French**, in plain sentences.

## 1. Read Jira

Use the Jira tools of the session (the Atlassian MCP server). If there is
none, say so and stop: nothing is published from memory.

For the root key, read with their description, status, type, links and **all
comments**:

1. the root ticket;
2. its descendants, level by level (`parent in (...)`, sub-tasks included),
   until a level comes back empty;
3. the tickets joined to the root by a **Jira issue link** (relates, blocks,
   duplicates…);
4. the status and title only of the tickets that the descriptions or comments
   **mention** without a Jira link.

A ticket Jira does not return (deleted, no access) is not invented: say it in
the note of the ticket that cites it.

## 2. Look for pull requests

Search GitHub with `gh`, by ticket key, for every ticket of the tree
(`gh search prs "<KEY>" --owner <org>` with the organization of the current
repository or of the repositories the tickets name, then `gh pr view` on the
hits). Keep a pull request only when its title, branch or body really names
the key: a number that merely matches is not a hit. Read the body of the kept
ones, they are evidence for the contradictions. Without `gh`, or with nothing
found, the tickets simply carry no pull request.

## 3. Judge each ticket

Audited tickets: the root, all its descendants, and the tickets joined by a
Jira link. Mentioned tickets are listed with their status and are not judged.

Three criteria, each `ok`, `warn`, `ko`, or `na` when it does not apply:

- **Commentaires** (`comments`). Every question or pending point raised in a
  comment has its answer, in a later comment or in the description. No
  comment at all is `ok` ("Aucun commentaire."). One unanswered point is `ko`.
- **Scope couvert** (`coverage`). Every point of the ticket's scope is taken
  up by a child. `na` for a ticket without children. A point no child takes
  up is `ko`; a point taken up in part is `warn`.
- **Contradictions** (`contradictions`). No use case, rule, status code or
  payload of the ticket is contradicted by another ticket of the tree, by a
  linked ticket, or by a pull request. A contradiction to settle before
  coding is `ko`; a tension or a stale reference is `warn`.

The verdict of a ticket is the worst of its three criteria (`na` ignored):
all `ok` gives `ok`, the green check.

Open questions written in a description are **not** a criterion: count them
in `openQuestions`, they show as a separate label.

Only state what the tickets, the comments or the pull requests say. When a
claim of a ticket can be checked in code you can reach, check it before
calling it a contradiction.

## 4. Write `data.json`

```jsonc
{
  "root": "ABC-100",                       // the key given to the command
  "title": "Titre court du ticket racine", // without the [tags] of the summary
  "project": "ABC",
  "auditDate": "26/11/2026",               // today, DD/MM/YYYY
  "jiraBase": "https://<site>.atlassian.net/browse/",
  "summary": "l'epic, ses 2 stories, leurs 12 sous-tâches et l'epic liée ABC-90",

  // The hierarchy. Children go below their parent.
  "tree": {
    "key": "ABC-100",
    "children": [
      { "key": "ABC-101", "blocksNext": true,        // ABC-101 blocks ABC-102, its right-hand sibling
        "children": [ { "key": "ABC-103" }, { "key": "ABC-104" } ] },
      { "key": "ABC-102", "children": [ { "key": "ABC-105" } ] }
    ]
  },

  // Tickets joined to the root by a Jira link: audited, shown beside the root.
  "linked": [ { "key": "ABC-90", "relation": "relates to" } ],

  // Tickets only mentioned in the texts: status only, not audited.
  "mentions": [
    { "key": "ABC-12", "title": "Titre Jira", "status": "Terminé", "statusCategory": "done",
      "note": "Pourquoi il est cité, en une phrase." }
  ],

  // One entry per audited ticket: every key of `tree` and of `linked`.
  "tickets": {
    "ABC-101": {
      "kind": "Story",                     // label shown: Epic, Story, Tâche, Bug, Sous-tâche…
      "level": "story",                    // colour of the type square: epic | story | sub
      "status": "Backlog",                 // the Jira status, as Jira names it
      "statusCategory": "todo",            // todo | prog | done
      "title": "Le summary Jira, tel quel",
      "verdict": "ko",                     // ok | warn | ko
      "scope": "La part du scope du parent que ce ticket adresse.",   // children only, omitted on the root
      "checks": {
        "comments":       { "state": "ok",   "text": "Aucun commentaire." },
        "coverage":       { "state": "warn", "text": "Une phrase de synthèse." },
        "contradictions": { "state": "ko",   "text": "Une phrase de synthèse." }
      },
      "openQuestions": 6,                  // omitted when 0
      "tags": ["dépend de ABC-12 (À faire)"],        // short labels: dependencies, unassigned…

      // Only when the ticket HAS comments. One row per question or pending point.
      "comments": {
        "state": "ko",                     // ok when every row is answered, else ko
        "note": "Commentaire du 07/10/2026 (auteur). Aucun commentaire de réponse.",
        "rows": [
          { "point": "La question posée.", "answer": "La réponse trouvée, ou « Aucune. »",
            "state": "ko", "label": "Sans réponse" }   // ok: Répondu · warn: Partielle · ko: Sans réponse
        ]
      },

      // Only when the ticket HAS children. Rows are the gaps only.
      "coverage": {
        "state": "ko",                     // ok when rows is empty, else ko
        "rows": [
          { "point": "Le point de scope.", "detail": "Qui le prend en partie, ou personne.",
            "state": "warn", "label": "Partiel" }      // warn: Partiel · ko: Non couvert
        ],
        "note": "Les autres points du scope sont répartis sur ABC-103 à ABC-104."
      },

      "contradictions": [1, 2],            // ids of the entries below that touch this ticket

      "prs": [
        { "repo": "org/repo", "number": 12, "url": "https://github.com/org/repo/pull/12",
          "state": "Draft fermée sans merge, 25/11/2026" }
      ]
    }
  },

  // Each contradiction once, referenced by id from every ticket it touches.
  "contradictions": [
    { "id": 1, "subject": "Le sujet, en quelques mots",
      "tickets": "Ce que disent les tickets, avec leurs clés.",
      "against": "Ce qui le contredit, avec sa source.",
      "severity": "ko", "label": "Bloquant" }          // ko: Bloquant · warn: À arbitrer, À nettoyer…
  ]
}
```

The file itself is strict JSON, without the comments above.

Text values are plain text: no HTML, no Markdown, except backticks around
code words (`` `409` ``, `` `customerReference` ``), which the page renders as
code. Keep every text to one or two sentences.

## 5. Publish

With `<dir>` a new folder of your scratchpad named after the key
(`jira-check-ABC-100/`):

1. Copy `template.html` to `<dir>/cartographie-abc-100.html` with `cp`. Do
   not rewrite it, do not edit it, do not add a `<title>`.
2. Read the copy once before publishing it.
3. Write `<dir>/data.json`.
4. Publish with the Artifact tool: `file_path` the copy, `title`
   `Cartographie ABC-100`, `icon` `tree`, a one-sentence French `description`,
   and `files` `{ "data.json": "<dir>/data.json" }`.

To correct an audit already published in the conversation, rewrite
`data.json` and publish the same `file_path` again with the same `files`.
A request to change the look of the page is a change to `template.html` in
the plugin, not to a copy.

## 6. Report

For each key, in French: the link, the verdict in one sentence (how many
tickets conform, with reservations, do not conform), the blocking
contradictions, the pull requests found, and what could not be read.
