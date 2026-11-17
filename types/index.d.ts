/** One changed file of the working tree, as the pane lists it. */
export type FileChange = {
  path: string
  /** `M` modified, `A` added, `D` deleted, `R` renamed, `?` untracked. */
  status: string
  added: number
  removed: number
  /** The file's unified-diff hunks, cut to a stored length. */
  diff: string
  isDiffCut: boolean
  /** A hash of the whole diff: a verdict or a read mark holds for it alone. */
  hash: string
}

/** What the model said of one file's diff. */
export type Verdict = { hash: string; needsReview: boolean; reason: string }

export type View = {
  /** A turn of the main loop is running: no judging until it completes. */
  isBusy: boolean
  isJudging: boolean
  /** Files judged as needing no review are hidden. */
  isHiding: boolean
  isRepo: boolean
  /** The last failure to show, or `''`. */
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    'code-inspector': {
      files: Shaped<FileChange[]>
      verdicts: Shaped<Record<string, Verdict>>
      /** Path to the diff hash the person marked as read. */
      readMarks: Shaped<Record<string, string>>
      expanded: Shaped<string[]>
      view: Shaped<View>
    }
  }
}
