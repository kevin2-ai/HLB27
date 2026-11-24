import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compartments = readFileSync(resolve(root, 'scripts/compartments.source.json'), 'utf8')
mkdirSync(resolve(root, 'src/data'), { recursive: true })
mkdirSync(resolve(root, 'supabase'), { recursive: true })
writeFileSync(resolve(root, 'src/data/compartments.json'), `${JSON.stringify(JSON.parse(compartments), null, 2)}\n`)

const sql = (value: string | number) => `'${String(value).replaceAll("'", "''")}'`
const start = Date.UTC(2026, 10, 23)
const values = Array.from({ length: 168 }, (_, index) => {
  const day = index + 1
  const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10)
  const week = Math.floor(index / 7) + 1
  return `(${[
    sql(`D${String(day).padStart(3, '0')}`), String(week), sql('daily'), 'null',
    sql(`Jour ${day}`), sql('Séance quotidienne de préparation HackerLab.'),
    'null', 'null', 'null', sql(date), sql(date), String(day),
  ].join(', ')})`
}).join(',\n')

const seed = `-- Généré par scripts/generate-tasks.ts après la migration journalière.\ninsert into public.tasks (id, week, kind, owner_member, title, description, topic, level, presenter_member, starts_on, ends_on, sort_order)\nvalues\n${values}\non conflict (id) do update set\n  week = excluded.week, kind = excluded.kind, owner_member = null,\n  title = excluded.title, description = excluded.description, topic = null, level = null,\n  presenter_member = null, starts_on = excluded.starts_on, ends_on = excluded.ends_on,\n  sort_order = excluded.sort_order;\n`
writeFileSync(resolve(root, 'supabase/seed_tasks.sql'), seed)
