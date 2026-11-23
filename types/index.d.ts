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
  /** The tab the pane shows. */
  tab: Tab
  /** The name of the branch the change is diffed against, as shown. */
  base: string
  /** The last failure to show, or `''`. */
  error: string
}

export type Tab = 'summary' | 'code' | 'notes'

/** A choice Claude made on the way, or a point it pushed back on. */
export type Note = {
  /** `n1`, `n2`…: what Claude names the note by to update or close it. */
  id: string
  kind: 'pushback' | 'arbitrage'
  title: string
  /** What was decided, why, and what to do about it. */
  detail: string
  /** The file the note is about, when it is about one. */
  path?: string
  isClosed: boolean
}

/** What Claude wrote for the reviewer about one branch of one repository. */
export type Report = {
  /** The `$.store` key the report is kept under, or `''` before any is read. */
  key: string
  summary: string
  notes: Note[]
}

/** What a comment is being typed under, or `null` for nothing. */
export type CommentTarget =
  | {
      kind: 'line'
      path: string
      /** The line's index among the lines of the file's stored diff. */
      index: number
      /** The file's diff hash when the line was picked: a changed diff drops it. */
      hash: string
    }
  | { kind: 'note'; id: string }
  | null

/** What Claude passes the tool that writes the report. */
export type ReportInput = {
  action: string
  text?: string
  kind?: string
  title?: string
  detail?: string
  path?: string
  id?: string
}

declare module 'claude-code' {
  interface McpToolInputs {
    'mcp__code-inspector__inspect_report': ReportInput
  }
  interface PluginState {
    'code-inspector': {
      files: Shaped<FileChange[]>
      verdicts: Shaped<Record<string, Verdict>>
      /** Path to the diff hash the person marked as read. */
      readMarks: Shaped<Record<string, string>>
      expanded: Shaped<string[]>
      view: Shaped<View>
      commentTarget: Shaped<CommentTarget>
      report: Shaped<Report>
      /** The pane was opened once this session, by the person or unasked. */
      hasAutoOpened: Shaped<boolean>
    }
  }
}
