import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'code-inspector',
  component: 'Pane',
  requestId: 'code-inspector',
  surface: 'terminal',
  props: {
    title: 'Inspect',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const DIFF = (path: string) =>
  `diff --git a/${path} b/${path}\nindex 1..2 100644\n--- a/${path}\n+++ b/${path}\n@@ -1,2 +1,3 @@\n context\n-old\n+new\n+more\n`

type On = Parameters<Parameters<typeof test>[1]>[1]

/** Stands for the engine: a repository with two changed files, a pane open. */
function fakeHost(on: On, counts: { model: number }) {
  on('command.register', () => ({ value: { command: 'inspect' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({
    value: [
      {
        id: 'code-inspector',
        title: 'Inspect',
        isShown: true,
        isFocused: false,
        isPlaced: true,
      },
    ],
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('process.run', (_, e) => {
    const argv = e.argv
    const ok = (stdout: string) => ({
      value: {
        exitCode: 0,
        stdout,
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    })

    if (argv.includes('--show-toplevel')) return ok('/repo\n')
    if (argv.includes('--verify')) return ok('abc\n')
    if (argv[1] === 'status') return ok(' M src/a.ts\0 M package-lock.json\0')

    return ok(DIFF(argv[argv.length - 1] ?? ''))
  })
  on('model.complete', () => {
    counts.model++

    return {
      value: {
        isAnswered: true,
        text: '[{"i":0,"review":true,"reason":"logique modifiée"},{"i":1,"review":false,"reason":"lockfile"}]',
        usage: {},
      },
    }
  })
}

test('lists changes, hides what needs no review, marks a file read', async ($, on) => {
  const counts = { model: 0 }

  fakeHost(on, counts)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /src\/a\.ts/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /package-lock/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\+2 −1/ })).toBeDefined()

  // One press, one model call: the lockfile leaves the list.
  await ui.press({ key: 'judge' })
  expect(counts.model).toBe(1)
  expect(await ui.find({ type: 'Text', text: /package-lock/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /1 masqués/ })).toBeDefined()

  // Showing all and hiding again judges nothing anew.
  await ui.press({ key: 'show-all' })
  expect(await ui.find({ type: 'Text', text: /package-lock/ })).toBeDefined()
  await ui.press({ key: 'judge' })
  expect(counts.model).toBe(1)

  // The diff opens on a press of the name, and a read mark strikes it.
  await ui.press({ key: 'open:src/a.ts' })
  expect(await ui.find({ type: 'Code' })).toBeDefined()
  await ui.press({ key: 'read:src/a.ts' })
  const name = await ui.find({ type: 'Text', text: /src\/a\.ts/ })

  expect(name?.props.strikethrough).toBe(true)
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
  await ui.unmount()
})

test('no judging while a turn runs', async ($, on) => {
  const counts = { model: 0 }

  fakeHost(on, counts)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.start({ text: 'go', turnId: 't1' })

  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /src\/a\.ts/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'judge' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Tour en cours/ })).toBeDefined()
  await ui.unmount()
})
