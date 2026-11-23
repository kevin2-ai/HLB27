import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CompletionRow, ProfileRow, TaskRow } from '../lib/database.types'
import { useAuth } from './useAuth'

export function useTasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [completions, setCompletions] = useState<CompletionRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError('La connexion Supabase n’est pas configurée.')
      setLoading(false)
      return
    }
    setLoading(true)
    const [taskResult, completionResult, profileResult] = await Promise.all([
      supabase.from('tasks').select('*').order('week').order('sort_order'),
      supabase.from('completions').select('*'),
      supabase.from('profiles').select('*'),
    ])
    if (taskResult.error || completionResult.error || profileResult.error) {
      setError('Impossible de charger le planning. Vérifie ta connexion puis réessaie.')
    } else {
      setTasks(taskResult.data ?? [])
      setCompletions(completionResult.data ?? [])
      setProfiles(profileResult.data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh, profile?.main_spec, profile?.second_spec, profile?.third_spec])
  return { tasks, completions, setCompletions, profiles, loading, error, refresh }
}
