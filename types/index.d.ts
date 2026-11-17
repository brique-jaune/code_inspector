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
  /** Test files, told by their path, are hidden. */
  isHidingTests: boolean
  /** Files the person marked as read are hidden. */
  isHidingRead: boolean
  isRepo: boolean
  /** The last failure to show, or `''`. */
  error: string
}

/** The diff line a question is being typed under, or `null` for none. */
export type CommentTarget = {
  path: string
  /** The line's index among the lines of the file's stored diff. */
  index: number
  /** The file's diff hash when the line was picked: a changed diff drops it. */
  hash: string
} | null

declare module 'claude-code' {
  interface PluginState {
    'code-inspector': {
      files: Shaped<FileChange[]>
      verdicts: Shaped<Record<string, Verdict>>
      /** Path to the diff hash the person marked as read. */
      readMarks: Shaped<Record<string, string>>
      expanded: Shaped<string[]>
      view: Shaped<View>
      commentTarget: Shaped<CommentTarget>
    }
  }
}
