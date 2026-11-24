-- Remplace le planning par 168 validations journalières et ajoute les équipes.
-- Les anciennes séances déjà validées restent archivées afin de conserver
-- l'historique, les points et les possibilités de contrôle de l'administrateur.

-- ---------- Planning journalier ----------
drop trigger if exists on_profile_created_assign_tasks on public.profiles;
drop function if exists public.on_profile_created_assign_tasks();
drop function if exists public.assign_personal_tasks(text, text, text);
drop trigger if exists on_profile_specialties_changed_update_tasks on public.profiles;
drop function if exists public.on_profile_specialties_changed_update_tasks();

alter table public.tasks drop constraint if exists tasks_kind_check;
alter table public.tasks add constraint tasks_kind_check
  check (kind in ('general', 'individual', 'team', 'daily', 'archived'));

update public.tasks t
set kind = 'archived'
where t.kind in ('general', 'individual', 'team')
  and exists (select 1 from public.completions c where c.task_id = t.id);

delete from public.tasks t
where t.kind in ('general', 'individual', 'team')
  and not exists (select 1 from public.completions c where c.task_id = t.id);

insert into public.tasks (id, week, kind, owner_member, title, description, topic, level, presenter_member, starts_on, ends_on, sort_order)
select
  'D' || lpad(d.day_no::text, 3, '0'),
  ((d.day_no - 1) / 7) + 1,
  'daily', null,
  'Jour ' || d.day_no,
  'Séance quotidienne de préparation HackerLab.',
  null, null, null,
  date '2026-11-23' + (d.day_no - 1),
  date '2026-11-23' + (d.day_no - 1),
  d.day_no
from generate_series(1, 168) as d(day_no)
on conflict (id) do update set
  week = excluded.week,
  kind = excluded.kind,
  owner_member = null,
  title = excluded.title,
  description = excluded.description,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  sort_order = excluded.sort_order;

create or replace function public.check_completion() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.tasks; me public.profiles; today date;
begin
  select * into t from public.tasks where id = new.task_id;
  select * into me from public.profiles where id = new.user_id;
  today := (now() at time zone 'Africa/Porto-Novo')::date;
  if t.id is null or me.id is null then
    raise exception 'Jour ou profil introuvable';
  end if;
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Tu ne peux valider que ta propre journée';
  end if;
  if t.kind <> 'daily' then
    raise exception 'Cette ancienne séance ne peut plus être validée';
  end if;
  if t.starts_on <> today then
    raise exception 'Seule la case du jour actuel peut être validée';
  end if;
  if new.writeup_url is null or new.writeup_url !~* '^https://github\.com/[A-Za-z0-9-]+/[A-Za-z0-9._-]+/blob/[A-Za-z0-9._-]+/.+\.md([?#].*)?$' then
    raise exception 'Un lien GitHub vers un fichier Markdown est obligatoire';
  end if;
  new.completed_at := now();
  new.cancelled_at := null;
  new.cancelled_by := null;
  new.cancel_reason := null;
  return new;
end $$;

drop policy if exists comp_delete_own on public.completions;
create policy comp_delete_own on public.completions for delete to authenticated
  using (
    user_id = auth.uid()
    and cancelled_at is null
    and exists (
      select 1 from public.tasks t
      where t.id = public.completions.task_id and t.kind = 'daily'
        and t.starts_on = (now() at time zone 'Africa/Porto-Novo')::date
    )
  );

-- ---------- Équipes et scores ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  captain_id uuid not null references public.profiles(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists teams_name_lower_unique on public.teams (lower(name));

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

alter table public.team_score_events
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create or replace view public.team_scores as
select t.id as team_id, t.name, t.captain_id,
       coalesce(sum(e.points), 0)::int as points,
       count(e.id)::int as events
from public.teams t
left join public.team_score_events e on e.team_id = t.id
group by t.id, t.name, t.captain_id;

create or replace function public.admin_create_team(
  p_name text,
  p_captain_id uuid,
  p_member_ids uuid[] default '{}'::uuid[]
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cleaned_name text := trim(coalesce(p_name, ''));
  new_team_id uuid;
  requested_members uuid[] := array_append(coalesce(p_member_ids, '{}'::uuid[]), p_captain_id);
begin
  if not public.is_admin() then raise exception 'Réservé à l''admin'; end if;
  if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 40 then
    raise exception 'Le nom de l''équipe doit contenir entre 2 et 40 caractères';
  end if;
  if p_captain_id is null or not exists (select 1 from public.profiles where id = p_captain_id) then
    raise exception 'Choisis un capitaine existant';
  end if;
  if exists (
    select 1 from unnest(requested_members) as requested(profile_id)
    left join public.profiles p on p.id = requested.profile_id
    where p.id is null
  ) then raise exception 'Un membre sélectionné est introuvable'; end if;
  if exists (
    select 1 from unnest(requested_members) as requested(profile_id)
    join public.team_members tm on tm.profile_id = requested.profile_id
  ) then raise exception 'Un membre appartient déjà à une équipe'; end if;

  insert into public.teams (name, captain_id, created_by)
  values (cleaned_name, p_captain_id, auth.uid())
  returning id into new_team_id;

  insert into public.team_members (team_id, profile_id)
  select new_team_id, requested.profile_id
  from (select distinct unnest(requested_members) as profile_id) requested;

  return new_team_id;
end $$;

revoke all on function public.admin_create_team(text, uuid, uuid[]) from public, anon;
grant execute on function public.admin_create_team(text, uuid, uuid[]) to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to authenticated using (true);
drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated using (true);

revoke all on public.teams, public.team_members from anon, authenticated;
grant select on public.teams, public.team_members to authenticated;
revoke all on public.team_scores from anon;
grant select on public.team_scores to authenticated;
