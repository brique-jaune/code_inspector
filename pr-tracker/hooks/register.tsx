import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Board, PullRequest } from '../types'

const PANE = 'pr-tracker'
const TITLE = 'Suivi PR'
const COMMAND = 'prs'
const REFRESH_MS = 30 * 60_000
// How many pull requests GitHub is asked for, per list.
const MAX_LISTED = 50
const MAX_TITLE = 300

const FIELDS =
  'number title url isDraft updatedAt reviewDecision author{login} repository{nameWithOwner} commits(last:1){nodes{commit{statusCheckRollup{state}}}}'
const QUERY = `query($mine:String!,$asked:String!){
  mine:search(query:$mine,type:ISSUE,first:${MAX_LISTED}){issueCount nodes{...on PullRequest{${FIELDS}}}}
  asked:search(query:$asked,type:ISSUE,first:${MAX_LISTED}){issueCount nodes{...on PullRequest{${FIELDS}}}}
}`
const MINE = 'is:pr is:open author:@me archived:false sort:updated-desc'
const ASKED = 'is:pr is:open review-requested:@me archived:false sort:updated-desc'
const GH_HINT = 'Vérifie que GitHub CLI est installé et connecté (gh auth login).'

const NO_BOARD: Board = {
  mine: [],
  asked: [],
  mineTotal: 0,
  askedTotal: 0,
  fetchedAt: 0,
  isLoading: false,
  error: '',
}

// Change the tag when the value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const board = atom({ plugin: 'pr-tracker', key: 'board' } as const, NO_BOARD, {
  shape: 'board-1',
})

function reviewOf(decision: unknown): PullRequest['review'] {
  if (decision === 'APPROVED') return 'approved'

  return decision === 'CHANGES_REQUESTED' ? 'changes' : 'pending'
}

function checksOf(state: unknown): PullRequest['checks'] {
  if (state === 'SUCCESS') return 'success'
  if (state === 'FAILURE' || state === 'ERROR') return 'failure'

  return state === 'PENDING' || state === 'EXPECTED' ? 'pending' : 'none'
}

const recordOf = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/** Reads one node of the search; anything that is not a whole pull request is left out. */
function pullRequestOf(node: unknown): PullRequest | undefined {
  const { number, title, url, isDraft, updatedAt, reviewDecision, author, repository, commits } =
    recordOf(node)
  const repo = recordOf(repository).nameWithOwner
  const login = recordOf(author).login
  const nodes = recordOf(commits).nodes
  const last = Array.isArray(nodes) ? (nodes as unknown[])[0] : undefined
  const rollup = recordOf(recordOf(recordOf(last).commit).statusCheckRollup).state

  if (typeof number !== 'number' || typeof title !== 'string') return undefined
  if (typeof url !== 'string' || !url.startsWith('https://')) return undefined
  if (typeof repo !== 'string') return undefined
  const at = typeof updatedAt === 'string' ? Date.parse(updatedAt) : NaN

  return {
    repo,
    number,
    title: title.slice(0, MAX_TITLE),
    url,
    // A deleted account has no author.
    author: typeof login === 'string' ? login : 'ghost',
    isDraft: isDraft === true,
    updatedAt: Number.isFinite(at) ? at : 0,
    review: reviewOf(reviewDecision),
    checks: checksOf(rollup),
  }
}

type Listed = { list: PullRequest[]; total: number }

function listOf(search: unknown): Listed {
  const { issueCount, nodes } = recordOf(search)
  const list = (Array.isArray(nodes) ? (nodes as unknown[]) : [])
    .map(pullRequestOf)
    .filter((pr): pr is PullRequest => pr !== undefined)

  return { list, total: typeof issueCount === 'number' ? issueCount : list.length }
}

/** Reads what `gh api graphql` printed into the two lists. */
function listsOf(stdout: string): { mine: Listed; asked: Listed } {
  const data = recordOf(recordOf(JSON.parse(stdout)).data)

  return { mine: listOf(data.mine), asked: listOf(data.asked) }
}

/**
 * A repository's name in two letters: the initials of its first two words,
 * or its first two letters. A prefix before a dot (`org.name`) is left out.
 */
function shortOf(repo: string): string {
  const name = repo.slice(repo.lastIndexOf('/') + 1)
  const tail = name.slice(name.lastIndexOf('.') + 1) || name
  const words = tail
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(word => word !== '')
  const short =
    words.length >= 2
      ? `${(words[0] ?? '')[0] ?? ''}${(words[1] ?? '')[0] ?? ''}`
      : (words[0] ?? tail).slice(0, 2)

  return short.toUpperCase().padEnd(2)
}

/** How long ago, in the largest unit that fits: minutes, hours, days. */
function ageOf(now: number, then: number): string {
  if (then === 0) return ''
  const minutes = Math.floor(Math.max(0, now - then) / 60_000)

  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)

  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} j`
}

// The module's own count of refreshes: only the latest one writes its lists.
let refreshes = 0

async function refresh($: EngineInterface): Promise<void> {
  const mine = ++refreshes

  await update($, board, b => ({ ...b, isLoading: true }))

  try {
    const ran = await $.process.run(
      ['gh', 'api', 'graphql', '-f', `query=${QUERY}`, '-f', `mine=${MINE}`, '-f', `asked=${ASKED}`],
      { timeoutMs: 60_000 },
    )

    if (ran.exitCode !== 0) {
      throw new Error(ran.stderr.trim().split('\n')[0] || `code ${ran.exitCode}`)
    }
    const lists = listsOf(ran.stdout)
    const now = await $.clock.now()

    if (mine !== refreshes) return
    await update($, board, () => ({
      mine: lists.mine.list,
      asked: lists.asked.list,
      mineTotal: lists.mine.total,
      askedTotal: lists.asked.total,
      fetchedAt: now,
      isLoading: false,
      error: '',
    }))
  } catch (err) {
    if (mine !== refreshes) return
    const message = err instanceof Error ? err.message : String(err)

    await update($, board, b => ({
      ...b,
      isLoading: false,
      error: `gh : ${message.slice(0, 300)}. ${GH_HINT}`,
    }))
  }
}

async function isPaneOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE)
}

// The module's own timer: a reload stops it and `session.start` sets a new one.
let timer: Timer | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description:
        'Ouvre le panneau de suivi des pull requests GitHub : les tiennes et celles à reviewer',
    })
    // A reload starts the module over: a fetch it was running is gone.
    await update($, board, b => ({ ...b, isLoading: false }))
    timer?.cancel()
    timer = $.clock.every(REFRESH_MS, () => {
      // Nobody looks at a closed pane: GitHub is asked for nothing.
      void isPaneOpen($)
        .then(isOpen => (isOpen ? refresh($) : undefined))
        .catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    // Never awaited: the pane shows the fetch running, then its lists.
    void refresh($).catch(() => undefined)

    return { text: 'Panneau Suivi PR ouvert.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const state = await read($, board)
    const now = await $.clock.now()

    const ready = state.mine.filter(pr => !pr.isDraft)
    const approved = ready.filter(pr => pr.review === 'approved')
    const changes = ready.filter(pr => pr.review === 'changes')
    const waiting = ready.filter(pr => pr.review === 'pending')
    const drafts = state.mine.filter(pr => pr.isDraft)

    const dotOf = (pr: PullRequest) => {
      if (pr.checks === 'none') return <Text dimColor>○</Text>
      const color =
        pr.checks === 'success'
          ? 'text-success'
          : pr.checks === 'failure'
            ? 'text-danger'
            : 'text-warning'

      return <Text color={color}>●</Text>
    }
    const rowOf = (pr: PullRequest, width: number, hasAuthor: boolean) => (
      <Box flexDirection="row" columnGap={1}>
        {dotOf(pr)}
        <Text dimColor>{shortOf(pr.repo)}</Text>
        <Link href={pr.url} label={`#${pr.number}`.padEnd(width)} />
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate-end">{pr.title}</Text>
        </Box>
        {hasAuthor && (
          <Text dimColor wrap="truncate-end">
            {pr.author}
          </Text>
        )}
        <Text dimColor>{ageOf(now, pr.updatedAt).padStart(6)}</Text>
      </Box>
    )
    const sectionOf = (label: string, list: PullRequest[], hasAuthor = false) => {
      if (list.length === 0) return null
      const width = Math.max(...list.map(pr => `#${pr.number}`.length))

      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            {label} <Text dimColor>· {list.length}</Text>
          </Text>
          {list.map(pr => rowOf(pr, width, hasAuthor))}
        </Box>
      )
    }
    const cutOf = (shown: number, total: number, what: string) =>
      total > shown ? (
        <Text dimColor>
          … {total - shown} {what} de plus sur GitHub
        </Text>
      ) : null
    const hasFetched = state.fetchedAt > 0

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>
            {state.isLoading
              ? 'GitHub · lecture en cours…'
              : hasFetched
                ? `GitHub · lu il y a ${ageOf(now, state.fetchedAt)}`
                : 'GitHub · pas encore lu'}
          </Text>
          <Button key="refresh" onPress={() => refresh($)}>
            ↻ Rafraîchir
          </Button>
        </Box>
        {state.error !== '' && <Text color="text-danger">{state.error}</Text>}
        {hasFetched && (
          <Text>
            ✅ {approved.length}
            {'  '}⚠️ {changes.length}
            {'  '}👀 {waiting.length}
            {'  '}✏️ {drafts.length}
            {'  '}📄 {state.asked.length}
          </Text>
        )}
        {sectionOf('✅ Approuvées', approved)}
        {sectionOf('⚠️ Changements demandés', changes)}
        {sectionOf('👀 En attente de review', waiting)}
        {sectionOf('✏️ Draft', drafts)}
        {hasFetched && state.mine.length === 0 && (
          <Text dimColor>Aucune pull request ouverte à ton nom.</Text>
        )}
        {cutOf(state.mine.length, state.mineTotal, 'pull requests à toi')}
        {sectionOf('📄 À reviewer', state.asked, true)}
        {hasFetched && state.asked.length === 0 && (
          <Text dimColor>Aucune review demandée.</Text>
        )}
        {cutOf(state.asked.length, state.askedTotal, 'reviews demandées')}
      </Box>
    )
  })
}
