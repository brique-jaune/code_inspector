# code-inspector

A Claude Code mod that opens a review pane for the current branch, to the right
of the conversation: what the branch brings, its code, and the choices Claude
made along the way. It lets you review what Claude wrote, with the context and
the follow-ups, without leaving the session or rereading the whole
conversation.

## What the pane shows

Everything is about the branch: what it changes compared to the branch it was
created from, committed or not. There are three tabs, with the diff base shown
next to them.

The pane's interface is in French; this document quotes its labels as they
appear on screen.

### Summary

What the branch brings, written by Claude and kept up to date as the work goes
on. Until there is one, a button asks Claude for it.

### Code

- **List of changed files**: status (`M`, `A`, `D`, `R`, `?`), path, and number
  of lines added and removed. The list refreshes after each write by Claude and
  at the end of each turn.
- **Diff on click**: clicking a file name expands its diff, clicking again
  collapses it.
- **Read checkbox**: ticking `[ ]` strikes through the file name, to mark that
  its diff has been read in full. If the file changes afterwards, the tick is
  cleared.
- **Question on a line**: in an expanded diff, clicking the `?` of a line opens
  a field below it. Enter sends the question to Claude, with the path, the line
  number and the surrounding hunk; with an empty field, Claude explains the
  line. The answer arrives in the conversation. During a turn, the question is
  sent as soon as the session is free.
- **"Masquer les tests" and "Masquer les lus" buttons** (hide tests, hide read
  files): remove from the list the test files (recognised by their path:
  `tests/`, `__tests__/`, `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.py`,
  `*Test.php`…) and the files ticked as read. A second click brings them back.
- **"Masquer le sans-intérêt" button** (hide what is not worth reviewing): a
  model judges each diff and hides the files that do not deserve a review
  (lockfiles, generated files, formatting, mechanical renames…). "Tout
  afficher" (show all) brings them back.

The button only appears once Claude's turn is over, so once the changes are
done. One click makes a single model call (`haiku`), for all files at once. A
verdict stays valid as long as the file's diff does not change: clicking again
without any new change costs nothing.

### Notes

One note per **pushback** (a disagreement, a warning, a request Claude did not
follow as given) and per **trade-off** (a choice between several options, a
compromise, something left aside): what Claude decided, why, and the file
concerned if there is one.

Clicking the `?` of a note opens a field below it, as on a diff line: Enter
sends the comment to Claude along with the note, to address the point or ask
for a clarification; with an empty field, Claude clarifies the note. It answers
in the conversation, then updates the note or closes it. Closed notes stay at
the bottom, greyed out.

### Where the summary and the notes come from

The mod gives Claude a tool, `inspect_report`, and an instruction in its system
prompt: record each pushback and each trade-off when it makes it, and keep the
summary up to date. The tool only writes to the mod's storage: no permission is
requested. Summary and notes are kept per repository and per branch, from one
session to the next.

## Usage

In a git repository, type `/inspect` to open the pane.

Git does not record where a branch was created from: the mod picks the branch
(local or `origin/*`) whose divergence point is closest to `HEAD`, and `main`
or `master` in case of a tie. On `main` or `master` itself, it shows the
working tree against `HEAD`. When it gets it wrong:

```
/inspect develop    # sets the diff base for this branch
/inspect auto       # goes back to automatic detection
```

## Installation

At the prompt of a terminal session:

```
/plugin install code-inspector --marketplace brique-jaune/code_inspector
```

Answer `y` to add the marketplace, then choose a scope.

From a shell:

```
claude plugin install code-inspector --marketplace brique-jaune/code_inspector
```

In the desktop app, where `/plugin` does not run: click `+` next to the input
box, then Plugins, Add marketplace with `brique-jaune/code_inspector`, then
Add plugin.

### Opening the pane automatically

A `/inspect` typed while Claude is working waits for the turn to end, so the
pane shows up late. With the `autoOpen` option on, the mod opens the pane by
itself, during the turn, right after the first file Claude writes.

- Off by default. Turn it on in `/config`, on the row "Ouvrir à la première
  écriture".
- A successful `Edit`, `Write` or `NotebookEdit` opens the pane, from Claude
  or from a subagent. `Bash` does not: a command may write nothing.
- Once per session: a pane you closed stays closed, and opening it yourself
  with `/inspect` counts as that once.
- Only a file inside the repository counts: a plan or a note written
  elsewhere opens nothing, and nothing opens outside a git repository.
- A terminal draws a pane opened this way from 144 columns, or from 110 once
  you have opened it yourself and not closed it by hand since. Below that the
  pane waits, and a toast says so: widen the terminal or type `/inspect`.

## Development

```
claude --plugin-dir .        # loads the mod from this folder
claude plugin validate .     # checks the manifest and the module
claude plugin test .         # runs tests/*.test.tsx
```

## Limitations

- The diff is drawn line by line to stay clickable (click on the `?` at the
  start of a line). Each line is coloured on its own: a string or a comment
  spanning several lines may be coloured wrongly.
- The detected base may be a sibling branch, created from this one or at the
  same point: `/inspect <branch>` fixes it. With no other branch, the diff is
  made against `HEAD`.
- The notes are only as good as what Claude records: a choice it did not see as
  a trade-off is not listed.
- The thread of a comment is not kept under the note: the answer is in the
  conversation, and the note carries the final state.
- The judgement is made per file, not per hunk.
- Very long diffs are truncated, both on screen and in the request to the
  model; a file too large to be judged stays listed.
- Beyond 150 changed files, only the first 150 are listed.
