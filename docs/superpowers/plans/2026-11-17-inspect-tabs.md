# Inspect Tabs (Summary / Code / Notes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Inspect pane three tabs — Summary, Code, Notes — over the whole branch's change, with Summary and Notes written by Claude through a tool.

**Architecture:** Still one hooks module. `refresh` diffs the working tree against the merge-base with a deduced (or forced) base branch. A `report` value (`$.state` for drawing, `$.store` per repository + branch) holds the summary and notes; Claude writes it through the tool `mcp__code-inspector__inspect_report`, told to by a `prompt.compose` section. The render hook draws a tab bar and one of three bodies.

**Tech Stack:** Claude Code mod API (`claude-code`), TSX, `claude plugin test` / `validate`, `tsc -p .`.

**Spec:** `docs/superpowers/specs/2026-11-17-inspect-tabs-design.md`

## Global Constraints

- One module, `hooks/register.tsx`; no DOM, no Node; everything through `$`.
- A render hook never writes state.
- Any stored value whose fields change gets a new `shape` tag.
- Text from the repository or from a note is `fenced()` in every prompt sent.
- UI copy in French; code comments in English, as the file has them.
- Version `0.3.0`.

## Review Focus

1. Tool called before the pane was ever opened (no refresh ran): the note must still land under the right repository + branch.
2. Tool called outside a git repository: an error Claude can read, nothing stored.
3. `update_note` / `close_note` with an unknown id: an error naming the id.
4. A value in `$.store` of the wrong form (older version, hand edit): read as an empty report, never a crash while drawing.
5. A repository with one branch only, or no commit: the pane behaves as today (diff against `HEAD` / the empty tree), base shown as `HEAD`.

---

### Task 1: Branch scope — base deduction, forced base, diff from the merge-base

**Files:**
- Modify: `hooks/register.tsx` (`refresh`, `parseStatus`, `command.run`), `types/index.d.ts` (`View`)
- Test: `tests/pane.test.tsx`

**Interfaces:**
- Produces:
  - `View` gains `tab: 'summary' | 'code' | 'notes'` (initial `'code'`) and `base: string` (the base's name as shown, `'HEAD'` on the fallback); `view` shape tag `view-3`.
  - `type Place = { top: string; branch: string }`; `locate($): Promise<Place | undefined>` — `git rev-parse --show-toplevel`, then `git rev-parse --abbrev-ref HEAD`; `undefined` outside a repository.
  - `baseOf($, place): Promise<{ name: string; rev: string }>` — the name shown and the revision to diff against.
  - `$.store` key `base:<top>:<branch>` → the forced base's name.
  - `parseNameStatus(stdout: string): { path: string; status: string }[]` for `git diff --name-status -z`.

**Decisions:**
- Candidates: `git for-each-ref --format=%(refname:short) refs/heads refs/remotes/origin`, minus the current branch, `origin/<current>`, `origin/HEAD`; first 30.
- For each: `git merge-base HEAD <c>` then `git rev-list --count <mb>..HEAD`. Smallest count wins; on a tie the first of `main`, `master`, `origin/main`, `origin/master`, else the first listed.
- No candidate, or no `HEAD`: `{ name: 'HEAD', rev: 'HEAD' }`, or the empty tree with no commit.
- Forced base: read from the store first; if it no longer resolves (`git rev-parse --verify --quiet <name>^{commit}`), deduce.
- File list: `git diff --name-status -z <rev>` (tracked, committed or not) plus the `??` entries of `git status --porcelain=v1 -z --untracked-files=all`. Per-file diff: `git diff --no-color <rev> -- <path>`; untracked as today.
- `/inspect <name>` forces the base (unknown name: `{ text: 'Branche inconnue : <name>' }`, nothing stored); `/inspect auto` clears it; `/inspect` opens only.

- [ ] **Step 1: Rework `fakeHost`** to answer the new git calls: `fakeHost(on, counts, { paths = ['src/a.ts', 'package-lock.json'], refs = 'main\n', untracked = '' })`; `--abbrev-ref` → `feature/x`, `for-each-ref` → `refs`, `merge-base` → `mb1`, `rev-list` → `2`, `--name-status` → `M\0<path>\0…`, `status` → `untracked`. Keep the four existing tests green in meaning (the third passes `paths`).

- [ ] **Step 2: Write the failing tests**

```tsx
test('diffs the branch against its nearest base, or a forced one', async ($, on) => {
  const argvs: string[][] = []
  const clock = fakeHost(on, { model: 0 }, { refs: 'main\ndevelop\n', log: argvs,
    counts: { main: 5, develop: 2 } })
  // store: an in-memory map behind store.get / store.set / store.delete
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'inspect', args: '' })
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /base : develop/ })).toBeDefined()
  expect(argvs.some(a => a[1] === 'diff' && a.includes('mb-develop'))).toBe(true)

  await $.command.run({ command: 'inspect', args: 'main' })
  expect(await ui.find({ type: 'Text', text: /base : main/ })).toBeDefined()
  const refused = await $.command.run({ command: 'inspect', args: 'nope' })
  expect(refused.text).toContain('Branche inconnue : nope')
  await $.command.run({ command: 'inspect', args: 'auto' })
  expect(await ui.find({ type: 'Text', text: /base : develop/ })).toBeDefined()
})

test('with no other branch the pane diffs against HEAD', async ($, on) => {
  // refs: '' → base : HEAD, diff argv includes 'HEAD'
})
```

- [ ] **Step 3: Run** `claude plugin test .` — the two new tests fail.
- [ ] **Step 4: Implement** `locate`, `baseOf`, `parseNameStatus`, the new `refresh`, the `command.run` arguments, `View` + `view-3`, and a `base : <name>` text (drawn on the tab bar's row in Task 3; for now above the list).
- [ ] **Step 5: Run** `claude plugin test .` — all pass.

### Task 2: Report — state, store, tool, system-prompt section

**Files:**
- Modify: `hooks/register.tsx`, `types/index.d.ts`
- Test: `tests/pane.test.tsx`

**Interfaces:**
- Consumes: `locate($)` (Task 1).
- Produces:
  - `type Note = { id: string; kind: 'pushback' | 'arbitrage'; title: string; detail: string; path?: string; isClosed: boolean }`
  - `type Report = { key: string; summary: string; notes: Note[] }`; atom `report`, initial `{ key: '', summary: '', notes: [] }`, shape `report-1`, declared in `PluginState`.
  - `loadReport($): Promise<string | undefined>` — locates, and when `report.key` differs from `report:<top>:<branch>` reads the store into the atom (a value of the wrong form reads as empty); returns the key, `undefined` outside a repository. Called by `refresh` and by the tool.
  - Tool `inspect_report`, `isDeferred: false`, registered at `session.start`, answered at `tool.call` (no permission prompt: it writes the mod's own store only). Input `{ action, text?, kind?, title?, detail?, path?, id? }`; `action` one of `set_summary`, `add_note`, `update_note`, `close_note`. Result: a string.
  - `prompt.compose` section `{ id: 'code-inspector:report', scope: 'session' }`, added last.

**Decisions:**
- Ids: `n<k>`, k = highest existing + 1.
- Limits: summary 8 000 chars, title 200, detail 4 000 (cut), 200 notes (refused beyond).
- Results: `Summary enregistré.`, `Note n3 ajoutée.`, `Note n3 mise à jour.`, `Note n3 close.`; errors `Erreur : note inconnue : n9`, `Erreur : pas un dépôt git`, `Erreur : action inconnue : <x>`, `Erreur : <champ> manquant`.
- Every write updates the atom, then `$.store.set(key, { summary, notes })`.
- Section text (exact copy):

```
# Panneau Inspect : summary et notes

Le dev relit ton travail dans le panneau Inspect. Tiens-le à jour avec l'outil
mcp__code-inspector__inspect_report, sans attendre qu'on te le demande :

- add_note, au moment où tu le fais : chaque pushback (désaccord avec une
  demande, mise en garde, demande que tu n'as pas suivie telle quelle) et
  chaque arbitrage (choix entre plusieurs options, compromis accepté, chose
  laissée de côté). Titre court ; dans detail, ce que tu as décidé, pourquoi,
  et ce que le dev doit faire s'il n'est pas d'accord. path si la note vise
  un fichier.
- set_summary, dès que le changement prend forme et à chaque fois qu'il
  change de nature : ce que la branche apporte, pour quelqu'un qui n'a pas
  suivi la conversation.
- update_note ou close_note quand un point est traité ou tranché, y compris
  après un commentaire du dev sur une note.

Une note par point. Pas de note pour un choix sans alternative réelle.
```

- [ ] **Step 1: Write the failing tests**

```tsx
const TOOL = 'mcp__code-inspector__inspect_report'

test('Claude writes the summary and notes; they persist per branch', async ($, on) => {
  const store = fakeStore(on)            // Map behind store.get/set/delete
  fakeHost(on, { model: 0 })
  on('tool.register', () => ({ value: { tool: TOOL } }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  // Before any refresh: the tool finds its own place.
  const added = await $.tool.call({ tool: TOOL, action: 'add_note',
    kind: 'arbitrage', title: 'Diff ligne à ligne', detail: 'Garde le clic.' })
  expect(added.result).toBe('Note n1 ajoutée.')
  await $.tool.call({ tool: TOOL, action: 'set_summary', text: 'Ajoute des onglets.' })
  await $.tool.call({ tool: TOOL, action: 'update_note', id: 'n1', detail: 'Autre.' })
  await $.tool.call({ tool: TOOL, action: 'close_note', id: 'n1' })
  expect(store.get('report:/repo:feature/x')).toEqual({
    summary: 'Ajoute des onglets.',
    notes: [{ id: 'n1', kind: 'arbitrage', title: 'Diff ligne à ligne',
      detail: 'Autre.', isClosed: true }],
  })
  const unknown = await $.tool.call({ tool: TOOL, action: 'close_note', id: 'n9' })
  expect(unknown.result).toBe('Erreur : note inconnue : n9')
})

test('the tool refuses outside a repository; a bad stored report reads as empty', …)
test('the system prompt tells Claude to keep the report', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose()
  expect(sections.at(-1)?.id).toBe('code-inspector:report')
  expect(sections.at(-1)?.text).toContain('inspect_report')
})
```

- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** the types, atom, `loadReport`, `applyReport(report, input): { report: Report; text: string }` (pure), the tool registration and answer, the section.
- [ ] **Step 4: Run** — pass.

### Task 3: Tabs, Summary tab, Notes tab with comments

**Files:**
- Modify: `hooks/register.tsx`, `types/index.d.ts` (`CommentTarget`)
- Test: `tests/pane.test.tsx`

**Interfaces:**
- Consumes: `view.tab`, `view.base`, `report`, `fenced`, `Note`.
- Produces:
  - `CommentTarget = { kind: 'line'; path; index; hash } | { kind: 'note'; id: string } | null`, shape `comment-target-2`.
  - Keys: `tab:summary`, `tab:code`, `tab:notes`, `note:<id>`, `ask-summary`; the Input keeps the key `comment`.
  - `noteQuestionOf(note: Note, asked: string): string`.

**Decisions:**
- Bar: `Summary`, `Code <shown files>`, `Notes <open notes>`; the active one bold, the rest dim; then `base : <name>` dim.
- Summary tab: the summary as `Markdown`; empty → `Pas encore de summary.` and the button `Demander le summary à Claude`, which submits `Écris le summary de cette branche avec l'outil inspect_report (set_summary), et consigne les pushbacks et arbitrages qui manquent (add_note).`
- Notes tab: open notes first, then closed ones dimmed and marked `✓ clos`. A row: `?` button, `pushback` or `arbitrage`, the title bold; under it the detail and `→ <path>`. Empty → `Aucune note.`
- Note prompt: `Commentaire sur la note <id> du panneau Inspect (<kind>) :`, the title, detail and path fenced, the data warning used for a line, the comment (empty → `Clarifie cette note : ce que tu as décidé, pourquoi, et ce que ça implique pour la suite.`), then `Réponds, puis mets la note à jour ou clos-la avec inspect_report (update_note / close_note, id <id>).`
- Filters, counters and the judge button are drawn in the Code tab only.

- [ ] **Step 1: Write the failing tests**

```tsx
test('tabs switch between summary, code and notes', …)
  // default: file list shown; press tab:summary → 'Pas encore de summary.' and
  // no file row; ask-summary submits a prompt containing 'set_summary';
  // after set_summary via the tool → the text shows, the button is gone;
  // press tab:notes → 'Aucune note.'; the bar reads 'Notes 1' after add_note.
test('a comment under a note goes to Claude with the note', …)
  // add two notes, close one: open first, closed shows '✓ clos';
  // press note:n1 → Input 'comment'; input 'Pas d'accord' →
  // sent[0] contains 'note n1', the fenced title, "Pas d'accord",
  // 'close_note'; Input gone. Empty input → 'Clarifie cette note'.
```

- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `claude plugin test .` — all pass.

### Task 4: Docs, version, checks

**Files:**
- Modify: `README.md`, `.claude-plugin/plugin.json` (version `0.3.0`, description), `.claude-plugin/marketplace.json` if it carries a version.

- [ ] **Step 1:** README: the three tabs, the branch scope and `/inspect <branche>` / `/inspect auto`, the tool and what Claude records, the limit (base deduction can pick a sibling branch).
- [ ] **Step 2: Run** `claude plugin validate .`, `tsc -p .`, `claude plugin test .` — all clean.
