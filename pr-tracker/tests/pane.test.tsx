import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const PANE = {
  plugin: 'pr-tracker',
  component: 'Pane',
  requestId: 'pr-tracker',
  surface: 'terminal',
  props: {
    title: 'Suivi PR',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const
const NOON = Date.parse('2026-11-25T12:00:00Z')
const HALF_HOUR = 30 * 60_000

type On = Parameters<TestBody>[1]

/** `/prs`, as the person types it at the prompt. */
const prs = () => ({
  command: 'prs',
  args: '',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 120 },
})

type Node = {
  number: number
  title: string
  repo?: string
  author?: string
  isDraft?: boolean
  updatedAt?: string
  reviewDecision?: string | null
  /** The roll-up of the last commit's checks; none when unsaid. */
  checks?: string
}

/** A pull request as GitHub's search answers it. */
const nodeOf = (node: Node) => {
  const repo = node.repo ?? 'acme/acme.client-lib'

  return {
    number: node.number,
    title: node.title,
    url: `https://github.com/${repo}/pull/${node.number}`,
    isDraft: node.isDraft ?? false,
    updatedAt: node.updatedAt ?? '2026-11-25T11:57:00Z',
    reviewDecision: node.reviewDecision ?? 'REVIEW_REQUIRED',
    author: { login: node.author ?? 'me' },
    repository: { nameWithOwner: repo },
    commits: {
      nodes: [
        { commit: { statusCheckRollup: node.checks === undefined ? null : { state: node.checks } } },
      ],
    },
  }
}

const MINE: Node[] = [
  { number: 17930, title: 'feat: tag lenses', checks: 'FAILURE' },
  { number: 89, title: 'feat: store tags', repo: 'acme/workspace', checks: 'SUCCESS', updatedAt: '2026-11-25T08:00:00Z' },
  { number: 12, title: 'fix: approved one', reviewDecision: 'APPROVED', checks: 'SUCCESS' },
  { number: 13, title: 'fix: to rework', reviewDecision: 'CHANGES_REQUESTED' },
  { number: 17712, title: 'ci: measure the build', isDraft: true, checks: 'PENDING', updatedAt: '2026-11-23T11:00:00Z' },
]
const ASKED: Node[] = [
  { number: 76206, title: 'chore: grant access', repo: 'acme/apiServer', author: 'OgmaJ' },
]

type HostOptions = {
  mine?: Node[]
  asked?: Node[]
  /** The reviews asked of the person by name; all of `asked` when unsaid. */
  direct?: Node[]
  /** What the store holds before the mod writes to it. */
  stored?: Record<string, unknown>
  /** How many pull requests GitHub counts as the person's; the list's length when unsaid. */
  mineTotal?: number
  /** No pane is open until the mod opens one. */
  isClosed?: boolean
}

/**
 * Stands for the engine: `gh` answering the two searches, a pane open, the
 * clock at noon. `host.gh` is how `gh` answers next, for a test to change.
 */
function fakeHost(on: On, options: HostOptions = {}) {
  const { mine = MINE, asked = ASKED, direct = asked, mineTotal, isClosed = false } = options
  const store = new Map(Object.entries(options.stored ?? {}))
  const host = {
    /** Every argv the mod ran. */
    log: [] as string[][],
    opens: [] as string[],
    gh: { exitCode: 0, stderr: '', mine, asked, direct },
    store,
    clock: mock.clock(on, { now: NOON }),
  }

  on('command.register', () => ({ value: { command: 'prs' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('ui.open', (_, e) => {
    host.opens.push(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('ui.panes', () => ({
    value:
      isClosed && host.opens.length === 0
        ? []
        : [{ id: 'pr-tracker', title: 'Suivi PR', isShown: true, isFocused: false, isPlaced: true }],
  }))
  on('process.run', (_, e) => {
    host.log.push([...e.argv])

    return {
      value: {
        exitCode: host.gh.exitCode,
        stdout: JSON.stringify({
          data: {
            mine: {
              issueCount: mineTotal ?? host.gh.mine.length,
              nodes: host.gh.mine.map(nodeOf),
            },
            asked: { issueCount: host.gh.asked.length, nodes: host.gh.asked.map(nodeOf) },
            direct: { issueCount: host.gh.direct.length, nodes: host.gh.direct.map(nodeOf) },
          },
        }),
        stderr: host.gh.stderr,
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  return host
}

test('/prs opens the pane and lists the pull requests by state', async ($, on) => {
  const host = fakeHost(on)

  await $.session.start(START)
  const ran = await $.command.run(prs())
  await host.clock.settle()

  expect(ran.text).toBe('Panneau Suivi PR ouvert.')
  expect(host.opens).toEqual(['pr-tracker'])
  // One command, by its argument vector: the three searches in one request.
  expect(host.log.length).toBe(1)
  expect(host.log[0]?.slice(0, 3)).toEqual(['gh', 'api', 'graphql'])
  expect(host.log[0]).toContain('mine=is:pr is:open author:@me archived:false sort:updated-desc')
  expect(host.log[0]).toContain(
    'asked=is:pr is:open review-requested:@me archived:false sort:updated-desc',
  )
  expect(host.log[0]).toContain(
    'direct=is:pr is:open user-review-requested:@me archived:false sort:updated-desc',
  )

  const ui = await $.ui.mount(PANE)
  const has = async (text: RegExp) => (await ui.find({ type: 'Text', text })) !== undefined

  expect(await has(/Approuvées · 1/)).toBe(true)
  expect(await has(/Changements demandés · 1/)).toBe(true)
  expect(await has(/En attente de review · 2/)).toBe(true)
  expect(await has(/Draft · 1/)).toBe(true)
  expect(await has(/À reviewer · 1/)).toBe(true)
  expect(await has(/✅ 1\s+⚠️ 1\s+👀 2\s+✏️ 1\s+📄 1/)).toBe(true)
  expect(await has(/^feat: tag lenses$/)).toBe(true)
  expect(await has(/^OgmaJ$/)).toBe(true)
  // Ages count from the clock: three minutes, four hours, two days.
  expect(await has(/^ *3 min$/)).toBe(true)
  expect(await has(/^ *4 h$/)).toBe(true)
  expect(await has(/^ *2 j$/)).toBe(true)
  // A repository in two letters: the words after the dot, a lone word, camel case.
  expect(await has(/^CL$/)).toBe(true)
  expect(await has(/^WO$/)).toBe(true)
  expect(await has(/^AS$/)).toBe(true)

  const links = await ui.findAll({ type: 'Link' })

  expect(links.map(link => link.props.href)).toContain(
    'https://github.com/acme/workspace/pull/89',
  )
  // The checks' colour: failed, passed, running, and none.
  expect((await ui.findAll({ type: 'Text', text: /^●$/ })).map(dot => dot.props.color)).toEqual([
    'text-success',
    'text-danger',
    'text-success',
    'text-warning',
  ])
  expect((await ui.findAll({ type: 'Text', text: /^○$/ })).length).toBe(2)
  await ui.unmount()
})

test('the refresh button reads GitHub again', async ($, on) => {
  const host = fakeHost(on)

  await $.session.start(START)
  await $.command.run(prs())
  await host.clock.settle()
  const ui = await $.ui.mount(PANE)

  host.gh.mine = [{ number: 5, title: 'feat: brand new' }]
  await ui.press({ key: 'refresh' })
  await host.clock.settle()

  expect(host.log.length).toBe(2)
  expect(await ui.find({ type: 'Text', text: /brand new/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /tag lenses/ })).toBeUndefined()
  await ui.unmount()
})

test('a failing gh shows its error and keeps the lists already read', async ($, on) => {
  const host = fakeHost(on)

  await $.session.start(START)
  await $.command.run(prs())
  await host.clock.settle()
  const ui = await $.ui.mount(PANE)

  host.gh.exitCode = 1
  host.gh.stderr = 'HTTP 401: Bad credentials\nmore'
  await ui.press({ key: 'refresh' })
  await host.clock.settle()

  const error = await ui.find({ type: 'Text', text: /^gh : / })

  expect(error?.text).toBe(
    'gh : HTTP 401: Bad credentials. Vérifie que GitHub CLI est installé et connecté (gh auth login).',
  )
  expect(await ui.find({ type: 'Text', text: /tag lenses/ })).toBeDefined()
  await ui.unmount()
})

test('the timer reads GitHub every half hour, only while the pane is open', async ($, on) => {
  const closed = fakeHost(on, { isClosed: true })

  await $.session.start(START)
  await closed.clock.advance(HALF_HOUR)
  expect(closed.log.length).toBe(0)

  await $.command.run(prs())
  await closed.clock.settle()
  expect(closed.log.length).toBe(1)
  await closed.clock.advance(HALF_HOUR)
  expect(closed.log.length).toBe(2)
})

test('says so when there is nothing, and when GitHub holds more than it listed', async ($, on) => {
  const host = fakeHost(on, { mine: [{ number: 1, title: 'only one' }], asked: [], mineTotal: 64 })

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Text', text: /^GitHub/ }))?.text).toBe('GitHub · pas encore lu')
  await ui.press({ key: 'refresh' })
  await host.clock.settle()

  expect((await ui.find({ type: 'Text', text: /^GitHub/ }))?.text).toBe(
    'GitHub · lu il y a <1 min',
  )
  expect(await ui.find({ type: 'Text', text: /Aucune review demandée/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /63 pull requests à toi de plus/ })).toBeDefined()
  await ui.unmount()
})

const TEAM: Node = { number: 300, title: 'feat: asked of a team', author: 'teammate' }
const BY_NAME: Node = { number: 301, title: 'fix: asked of me', author: 'OgmaJ' }

test('the button hides the reviews asked of a team, and the choice is kept', async ($, on) => {
  const host = fakeHost(on, { asked: [TEAM, BY_NAME], direct: [BY_NAME] })

  await $.session.start(START)
  await $.command.run(prs())
  await host.clock.settle()
  const ui = await $.ui.mount(PANE)
  const has = async (text: RegExp) => (await ui.find({ type: 'Text', text })) !== undefined

  expect(await has(/À reviewer · 2/)).toBe(true)
  expect(await has(/asked of a team/)).toBe(true)
  expect((await ui.find({ type: 'Button', key: 'direct-only' }))?.text).toBe('Masquer équipes')

  await ui.press({ key: 'direct-only' })

  expect(await has(/À reviewer · 1/)).toBe(true)
  expect(await has(/asked of a team/)).toBe(false)
  expect(await has(/asked of me/)).toBe(true)
  expect(await has(/📄 1$/)).toBe(true)
  expect((await ui.find({ type: 'Button', key: 'direct-only' }))?.text).toBe('Afficher équipes')
  expect(host.store.get('isDirectOnly')).toBe(true)
  // The filter reads what was fetched: GitHub is not asked again.
  expect(host.log.length).toBe(1)

  await ui.press({ key: 'direct-only' })

  expect(await has(/asked of a team/)).toBe(true)
  expect(host.store.get('isDirectOnly')).toBe(false)
  await ui.unmount()
})

test('a choice stored by an earlier session hides the team reviews from the start', async ($, on) => {
  const host = fakeHost(on, { asked: [TEAM], direct: [], stored: { isDirectOnly: true } })

  await $.session.start(START)
  await $.command.run(prs())
  await host.clock.settle()
  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /asked of a team/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Aucune review demandée à toi directement/ })).toBeDefined()
  // The button stays, to show them again.
  expect((await ui.find({ type: 'Button', key: 'direct-only' }))?.text).toBe('Afficher équipes')
  await ui.unmount()
})

test('a value an earlier version stored is declined', async ($, on) => {
  fakeHost(on)
  on('state.get', () => ({ value: { value: { prs: ['old'] }, version: 1 } }))

  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Text', text: /^GitHub/ }))?.text).toBe('GitHub · pas encore lu')
  await ui.unmount()
})
