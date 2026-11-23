export const SCORES_CHANGED_EVENT = 'hackerlab:scores-changed'

export function notifyScoresChanged() {
  window.dispatchEvent(new Event(SCORES_CHANGED_EVENT))
}
