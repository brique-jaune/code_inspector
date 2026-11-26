import type { Register } from 'claude-code'

const COMMAND = 'jira-check'
const USAGE = 'Usage : /jira-check ABC-123 [ABC-456 …]'
// A Jira key, bare or at the end of a ticket's link.
const KEY = /[A-Za-z][A-Za-z0-9]+-\d+/g

/** The keys typed after the command, in order, each once. */
export function keysOf(args: string): string[] {
  const found = (args.match(KEY) ?? []).map(key => key.toUpperCase())

  return [...new Set(found)]
}

/**
 * What Claude is asked: the audit's rules and the page are files of the mod,
 * so every run follows the same steps and publishes the same page.
 */
export function promptOf(keys: readonly string[], root: string): string {
  const assets = `${root}/assets`
  const tickets = keys.length === 1 ? `le ticket Jira ${keys[0]}` : `les tickets Jira ${keys.join(', ')}`

  return [
    `Lance l'audit jira-check pour ${tickets}.`,
    `Lis d'abord ${assets}/INSTRUCTIONS.md et suis-le à la lettre.`,
    `Publie un artefact par ticket, à partir du gabarit ${assets}/template.html copié sans modification : seules les données de data.json changent.`,
  ].join(' ')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description:
        'Audite un ticket Jira et ses dépendances, puis publie la cartographie : commentaires, couverture du scope, contradictions, PR',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const keys = keysOf(e.args)

    if (keys.length === 0) {
      return { text: USAGE }
    }
    const text = promptOf(keys, $.plugin.root)

    // A prompt submitted from inside this hook would wait on the turn the hook
    // is holding, and the engine refuses it: it leaves from a timer, once the
    // command has answered.
    $.clock.after(0, () => {
      void $.prompt
        .submit({ text, asUser: true })
        .catch(() => $.ui.toast("jira-check : l'audit n'a pas pu être lancé, relance la commande."))
        .catch(() => undefined)
    })

    return { text: `Audit Jira lancé pour ${keys.join(', ')}.` }
  })
}
