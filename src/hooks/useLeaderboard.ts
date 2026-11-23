import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LeaderboardRow } from '../lib/database.types'
import { SCORES_CHANGED_EVENT } from '../lib/events'

export function useLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [teamScore, setTeamScore] = useState<{ total: number; events: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError('La connexion Supabase n’est pas configurée.')
      setLoading(false)
      return
    }
    const [leaderboardResult, teamResult] = await Promise.all([
      supabase.from('leaderboard').select('*').order('rank').order('pseudo'),
      supabase.from('team_score').select('*').maybeSingle(),
    ])
    if (leaderboardResult.error || teamResult.error) setError('Impossible de charger les scores pour le moment.')
    else {
      setRows(leaderboardResult.data ?? [])
      setTeamScore(teamResult.data ?? null)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener(SCORES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SCORES_CHANGED_EVENT, refresh)
  }, [refresh])
  return { rows, teamScore, loading, error, refresh }
}
