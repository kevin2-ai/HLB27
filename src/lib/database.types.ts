type TableShape<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type TaskRow = {
  id: string
  week: number
  kind: 'general' | 'individual' | 'team'
  owner_member: string | null
  title: string
  description: string | null
  topic: string | null
  level: number | null
  presenter_member: string | null
  starts_on: string
  ends_on: string
  sort_order: number
}

export type CompletionRow = {
  id: number
  user_id: string
  task_id: string
  completed_at: string
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
}

export type ProfileRow = {
  id: string
  member_key: string
  pseudo: string
  main_spec: string | null
  second_spec: string | null
  role: 'member' | 'admin'
  created_at: string
}

export type LeaderboardRow = {
  user_id: string
  pseudo: string
  member_key: string
  sessions_done: number
  points: number
  rank: number
}

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow>
      tasks: TableShape<TaskRow>
      completions: TableShape<CompletionRow, { user_id: string; task_id: string }>
      invitations: TableShape<{ email: string; member_key: string; pseudo: string; main_spec: string | null; second_spec: string | null; role: 'member' | 'admin'; created_at: string }, { email: string; member_key: string; pseudo: string; main_spec?: string | null; second_spec?: string | null; role?: 'member' | 'admin' }>
      point_adjustments: TableShape<{ id: number; user_id: string; delta: number; reason: string; created_by: string; created_at: string }, { user_id: string; delta: number; reason: string; created_by: string }>
      team_score_events: TableShape<{ id: number; points: number; reason: string; created_by: string; created_at: string }, { points: number; reason: string; created_by: string }>
    }
    Views: {
      leaderboard: { Row: LeaderboardRow; Relationships: [] }
      team_score: { Row: { total: number; events: number }; Relationships: [] }
    }
    Functions: {
      admin_cancel_completion: { Args: { p_id: number; p_reason: string }; Returns: undefined }
      admin_restore_completion: { Args: { p_id: number }; Returns: undefined }
      update_my_pseudo: { Args: { p_pseudo: string }; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
