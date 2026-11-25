/** One open pull request, as the pane lists it. */
export type PullRequest = {
  /** `owner/name`. */
  repo: string
  number: number
  title: string
  url: string
  /** The author's login. */
  author: string
  isDraft: boolean
  /** When it last changed, in milliseconds since the epoch. */
  updatedAt: number
  /** Where its review stands: approved, changes requested, or still waited on. */
  review: 'approved' | 'changes' | 'pending'
  /** Its last commit's checks, rolled up; `none` when it has no check. */
  checks: 'success' | 'failure' | 'pending' | 'none'
}

/** What GitHub last answered, and how the fetch went. */
export type Board = {
  /** The open pull requests the person wrote. */
  mine: PullRequest[]
  /** The open pull requests whose review is asked of the person. */
  asked: PullRequest[]
  /** How many GitHub counts, which may be more than it listed. */
  mineTotal: number
  askedTotal: number
  /** When the lists were read, in milliseconds since the epoch; 0 for never. */
  fetchedAt: number
  isLoading: boolean
  /** The last failure to show, or `''`. */
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    'pr-tracker': {
      board: Shaped<Board>
    }
  }
}
