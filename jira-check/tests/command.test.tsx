import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const
const NOON = Date.parse('2026-11-26T12:00:00Z')

type On = Parameters<TestBody>[1]

/** `/jira-check <args>`, as the person types it at the prompt. */
const jiraCheck = (args: string) => ({
  command: 'jira-check',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 120 },
})

/** The host the mod talks to: the command registry and the prompts it sent. */
function fakeHost(on: On) {
  const host = { sent: [] as string[], clock: mock.clock(on, { now: NOON }) }

  on('command.register', () => ({ value: { command: 'jira-check' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => {
    host.sent.push(e.text)

    return { text: e.text }
  })

  return host
}

test('/jira-check with a key asks Claude for the audit, with the instructions and the template', async ($, on) => {
  const host = fakeHost(on)

  await $.session.start(START)
  const ran = await $.command.run(jiraCheck('ABC-100'))
  await host.clock.settle()

  expect(ran.text).toBe('Audit Jira lancé pour ABC-100.')
  expect(host.sent.length).toBe(1)
  expect(host.sent[0]).toMatch(/le ticket Jira ABC-100\./)
  expect(host.sent[0]).toMatch(/\/assets\/INSTRUCTIONS\.md/)
  expect(host.sent[0]).toMatch(/\/assets\/template\.html/)
})

test('several keys, as links or in lower case, are asked once each and in order', async ($, on) => {
  const host = fakeHost(on)

  await $.session.start(START)
  const ran = await $.command.run(
    jiraCheck('abc-100, https://acme.atlassian.net/browse/ABC-101 ABC-100'),
  )
  await host.clock.settle()

  expect(ran.text).toBe('Audit Jira lancé pour ABC-100, ABC-101.')
  expect(host.sent[0]).toMatch(/les tickets Jira ABC-100, ABC-101\./)
})

test('/jira-check without a key shows the usage and asks Claude nothing', async ($, on) => {
  const host = fakeHost(on)

  await $.session.start(START)
  const bare = await $.command.run(jiraCheck(''))
  const words = await $.command.run(jiraCheck('le ticket du bulk'))
  await host.clock.settle()

  expect(bare.text).toBe('Usage : /jira-check ABC-123 [ABC-456 …]')
  expect(words.text).toBe('Usage : /jira-check ABC-123 [ABC-456 …]')
  expect(host.sent).toEqual([])
})
