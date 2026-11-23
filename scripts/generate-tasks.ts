import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

type Member = { key: string; pseudo: string; main: string; second: string }
type Presenter = { member: string; topic: string; label: string }
type Resource = { name: string; url: string }
type LevelCompartment = { label: string; objectives: string[]; resources: Resource[] }
type Compartment = { name: string; optional?: boolean; levels: Record<string, LevelCompartment> }
type Task = {
  id: string; week: number; kind: 'general' | 'individual' | 'team'; owner: string | null
  title: string; description: string | null; topic: string | null; level: number | null
  presenter: string | null; order: number
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compartments = JSON.parse(readFileSync(resolve(root, 'scripts/compartments.source.json'), 'utf8')) as Record<string, Compartment>
mkdirSync(resolve(root, 'src/data'), { recursive: true })
mkdirSync(resolve(root, 'supabase'), { recursive: true })
writeFileSync(resolve(root, 'src/data/compartments.json'), `${JSON.stringify(compartments, null, 2)}\n`)

const members: Member[] = [
  { key: 'kevin', pseudo: 'H4ck4tsuk1', main: 'reverse', second: 'stegano' },
  { key: 'achille', pseudo: 'Sn@k3w3b', main: 'web', second: 'reseau_ad' },
  { key: 'brave', pseudo: 'BlackGod-br', main: 'osint', second: 'forensics' },
  { key: 'olayinka', pseudo: 'Dark_m3dv', main: 'osint', second: 'forensics' },
  { key: 'moucharaf', pseudo: 'Ghostwire', main: 'crypto', second: 'forensics' },
  { key: 'josias', pseudo: 'Josias', main: 'web', second: 'crypto' },
]

const presentationRotation: Presenter[][] = [
  [{ member: 'kevin', topic: 'reverse', label: 'Reverse engineering' }, { member: 'achille', topic: 'web', label: 'Web (côté serveur)' }],
  [{ member: 'brave', topic: 'osint', label: 'OSINT' }, { member: 'olayinka', topic: 'forensics', label: 'Forensics' }],
  [{ member: 'moucharaf', topic: 'crypto', label: 'Cryptographie' }, { member: 'josias', topic: 'web', label: 'Web (côté client et logique)' }],
  [{ member: 'kevin', topic: 'stegano', label: 'Stéganographie' }, { member: 'achille', topic: 'reseau_ad', label: 'Réseau et Active Directory' }],
  [{ member: 'brave', topic: 'forensics', label: 'Forensics' }, { member: 'olayinka', topic: 'osint', label: 'OSINT' }],
  [{ member: 'moucharaf', topic: 'forensics', label: 'Forensics' }, { member: 'josias', topic: 'crypto', label: 'Cryptographie' }],
]

const teamContent: Record<number, string> = {
  1: 'Mise en place : groupe de discussion, dépôt de write-ups, VM Kali, comptes sur les plateformes et créneaux bloqués dans les agendas.',
  2: 'Cycle 1 — épreuves faciles résolues en équipe (picoCTF, Root-Me), puis revue des write-ups.',
  3: 'Cycle 1 — épreuves faciles résolues en équipe (picoCTF, Root-Me), puis revue des write-ups.',
  4: 'Cycle 1 — épreuves faciles résolues en équipe (picoCTF, Root-Me), puis revue des write-ups.',
  5: 'Cycle 1 — épreuves faciles résolues en équipe (picoCTF, Root-Me), puis revue des write-ups.',
  6: 'Cycle 1 — épreuves faciles résolues en équipe (picoCTF, Root-Me), puis revue des write-ups.',
  7: 'Cycle 1 — épreuves faciles résolues en équipe (picoCTF, Root-Me), puis revue des write-ups.',
  8: 'Cycle 2 — épreuves moyennes chronométrées (Root-Me, Hackropole) : chacun mène sa catégorie.',
  9: 'Cycle 2 — épreuves moyennes chronométrées (Root-Me, Hackropole) : chacun mène sa catégorie.',
  10: 'Cycle 2 — épreuves moyennes chronométrées (Root-Me, Hackropole) : chacun mène sa catégorie.',
  11: 'Cycle 2 — épreuves moyennes chronométrées (Root-Me, Hackropole) : chacun mène sa catégorie.',
  12: 'Cycle 2 — épreuves moyennes chronométrées (Root-Me, Hackropole) : chacun mène sa catégorie.',
  13: 'Cycle 2 — épreuves moyennes chronométrées (Root-Me, Hackropole) : chacun mène sa catégorie.',
  14: 'Cycle 3 — un CTF en ligne toutes les deux semaines (CTFtime), puis débrief.',
  15: 'Cycle 3 — un CTF en ligne toutes les deux semaines (CTFtime), puis débrief.',
  16: 'Cycle 3 — un CTF en ligne toutes les deux semaines (CTFtime), puis débrief.',
  17: 'Cycle 3 — un CTF en ligne toutes les deux semaines (CTFtime), puis débrief.',
  18: 'Cycle 3 — un CTF en ligne toutes les deux semaines (CTFtime), puis débrief.',
  19: 'Cycle 3 — un CTF en ligne toutes les deux semaines (CTFtime), puis débrief.',
  20: 'Simulation : préparation des rôles et du déroulé de la simulation de 48 h.',
  21: 'Simulation 1 : exercice de 48 h en conditions réelles, rôles fixés et point toutes les 4 h.',
  22: 'Simulation : débrief et préparation des rôles pour la prochaine simulation de 48 h.',
  23: 'Simulation 2 : exercice de 48 h en conditions réelles, rôles fixés et point toutes les 4 h.',
  24: 'Affûtage : relecture des notes, vérification du matériel et des dates officielles, déroulé du premier jour.',
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const weekStart = (week: number) => {
  const date = new Date(Date.UTC(2026, 10, 23 + (week - 1) * 7))
  return isoDate(date)
}
const weekEnd = (week: number) => {
  const date = new Date(Date.UTC(2026, 10, 29 + (week - 1) * 7))
  return isoDate(date)
}
const sql = (value: string | number | null) => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const tasks: Task[] = []

function addTask(week: number, id: string, kind: Task['kind'], owner: string | null, title: string,
  description: string | null, topic: string | null, level: number | null, presenter: string | null, order: number) {
  tasks.push({ id, week, kind, owner, title, description, topic, level, presenter, order })
}

for (let week = 1; week <= 24; week += 1) {
  const prefix = `S${String(week).padStart(2, '0')}`
  const level = week >= 2 && week <= 19 ? Math.floor((week - 2) / 6) + 1 : null
  const rotationIndex = week >= 2 && week <= 19 ? (week - 2) % 6 : -1
  const presenters = rotationIndex >= 0 ? presentationRotation[rotationIndex] : []

  if (presenters.length) {
    presenters.forEach((presenter, index) => {
      const cap = compartments[presenter.topic].levels[String(level)]
      const presenterPseudo = members.find((member) => member.key === presenter.member)?.pseudo ?? presenter.member
      addTask(week, `${prefix}-general-${index + 1}`, 'general', null,
        `Séance générale : ${presenterPseudo} présente ${presenter.label} (Niveau ${level})`,
        JSON.stringify({ objectives: cap.objectives, resources: cap.resources }), presenter.topic, level, presenter.member, index + 1)
    })
  } else if (week >= 20 && week <= 23) {
    for (let index = 1; index <= 2; index += 1) {
      addTask(week, `${prefix}-general-${index}`, 'general', null, `Séance générale : Revue croisée des erreurs (${index}/2)`,
        'Reprendre les erreurs des dernières épreuves, partager les corrections et améliorer les write-ups.', null, null, null, index)
    }
  }

  const teamDescription = teamContent[week]
  addTask(week, `${prefix}-team-1`, 'team', null, `Séance d'équipe : ${teamDescription.split(' : ')[0]}`,
    teamDescription, null, null, null, 3)

  for (const member of members) {
    let officialTitle
    let topic = null
    let taskLevel = level
    let description = ''

    if (week === 1) {
      const setup = ['Installer et démarrer la VM Kali', 'Créer les comptes sur les plateformes d’entraînement', 'Bloquer les créneaux de préparation dans l’agenda', 'Rejoindre le groupe et préparer le dépôt de write-ups']
      officialTitle = setup[0]
      description = setup[0]
      taskLevel = null
    } else if (week >= 2 && week <= 19) {
      const presentation = presenters.find((item) => item.member === member.key)
      if (presentation) {
        topic = presentation.topic
        const cap = compartments[topic].levels[String(level)]
        officialTitle = `Préparer ma présentation — ${presentation.label} (Niveau ${level})`
        description = JSON.stringify({ objectives: cap.objectives, resources: cap.resources })
      } else {
        const firstWeekOfCycle = 2 + Math.floor((week - 2) / 6) * 6
        const allWeeks = Array.from({ length: 6 }, (_, index) => firstWeekOfCycle + index)
        const nonPresentationWeeks = allWeeks.filter((candidate) => {
          const candidateRotation = (candidate - 2) % 6
          return !presentationRotation[candidateRotation].some((item) => item.member === member.key)
        })
        const position = nonPresentationWeeks.indexOf(week)
        topic = [member.main, member.main, member.second, member.main][position]
        const cap = compartments[topic].levels[String(level)]
        officialTitle = `Séance individuelle — ${compartments[topic].name} : Niveau ${level}`
        description = JSON.stringify({ objectives: cap.objectives, resources: cap.resources })
      }
    } else if (week >= 20 && week <= 23) {
      officialTitle = 'Travailler ma catégorie la plus faible'
      description = 'Choisir une épreuve de sa catégorie la moins maîtrisée, la résoudre et noter les points à revoir.'
      taskLevel = null
    } else {
      officialTitle = 'Relire mes notes et préparer le premier jour'
      description = 'Relire les notes et write-ups, vérifier le matériel et revoir le déroulé du premier jour.'
      taskLevel = null
    }

    if (week === 1) {
      const setup = ['Installer et démarrer la VM Kali', 'Créer les comptes sur les plateformes d’entraînement', 'Bloquer les créneaux de préparation dans l’agenda', 'Rejoindre le groupe et préparer le dépôt de write-ups']
      setup.forEach((title, index) => addTask(week, `${prefix}-ind-${member.key}-${index + 1}`, 'individual', member.key,
        `Séance individuelle : ${title}`, title, null, null, null, 10 + members.indexOf(member) * 4 + index))
      continue
    }

    addTask(week, `${prefix}-ind-${member.key}-1`, 'individual', member.key, officialTitle,
      description, topic, taskLevel, null, 10 + members.indexOf(member) * 4)
    for (let slot = 2; slot <= 4; slot += 1) {
      addTask(week, `${prefix}-ind-${member.key}-${slot}`, 'individual', member.key, `Séance libre ${slot - 1}`,
        'Créneau individuel libre pour pratiquer, résoudre une épreuve et compléter un write-up.', null, taskLevel, null,
        10 + members.indexOf(member) * 4 + slot - 1)
    }
  }
}

const values = tasks.map((task) => `(${[
  sql(task.id), String(task.week), sql(task.kind), sql(task.owner), sql(task.title), sql(task.description),
  sql(task.topic), task.level === null ? 'null' : String(task.level), sql(task.presenter),
  sql(weekStart(task.week)), sql(weekEnd(task.week)), String(task.order),
].join(', ')})`).join(',\n')
const seed = `-- Généré par scripts/generate-tasks.ts. Ne pas modifier manuellement.\ninsert into public.tasks (id, week, kind, owner_member, title, description, topic, level, presenter_member, starts_on, ends_on, sort_order)\nvalues\n${values}\non conflict (id) do update set\n  week = excluded.week, kind = excluded.kind, owner_member = excluded.owner_member,\n  title = excluded.title, description = excluded.description, topic = excluded.topic,\n  level = excluded.level, presenter_member = excluded.presenter_member,\n  starts_on = excluded.starts_on, ends_on = excluded.ends_on, sort_order = excluded.sort_order;\n`
writeFileSync(resolve(root, 'supabase/seed_tasks.sql'), seed)
console.log(`Généré : ${tasks.length} séances sur 24 semaines (${weekStart(1)} → ${weekEnd(24)}).`)
