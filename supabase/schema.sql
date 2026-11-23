-- HackerLab Bénin 2027 — schéma initial
-- À exécuter dans le SQL Editor d'un projet Supabase neuf.

-- ============ TABLES ============
create table public.invitations (
  email text primary key check (email = lower(email)),
  member_key text not null unique,
  pseudo text not null,
  main_spec text,
  second_spec text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  member_key text not null unique,
  pseudo text not null,
  main_spec text not null,
  second_spec text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  check (main_spec <> second_spec),
  created_at timestamptz not null default now()
);
-- Aucun email dans profiles : le classement ne l'expose jamais.

create table public.tasks (
  id text primary key,
  week int not null check (week between 1 and 24),
  kind text not null check (kind in ('general', 'individual', 'team')),
  owner_member text,
  title text not null,
  description text,
  topic text,
  level int check (level between 1 and 3),
  presenter_member text,
  starts_on date not null,
  ends_on date not null,
  sort_order int not null default 0,
  check (ends_on >= starts_on)
);

create table public.completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  unique (user_id, task_id)
);

create table public.point_adjustments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null check (delta <> 0 and delta between -500 and 500),
  reason text not null check (length(trim(reason)) >= 3),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Score d'équipe indépendant des points individuels.
create table public.team_score_events (
  id bigint generated always as identity primary key,
  points int not null check (points <> 0 and points between -5000 and 5000),
  reason text not null check (length(trim(reason)) >= 3),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============ FONCTIONS ============
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Inscription uniquement sur invitation.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv public.invitations;
  selected_main text;
  selected_second text;
begin
  select * into inv from public.invitations where email = lower(new.email);
  if not found then
    raise exception 'Inscription sur invitation uniquement';
  end if;

  selected_main := nullif(lower(trim(new.raw_user_meta_data ->> 'main_spec')), '');
  selected_second := nullif(lower(trim(new.raw_user_meta_data ->> 'second_spec')), '');
  if selected_main is null or selected_second is null then
    raise exception 'Choisis deux spécialités différentes';
  end if;
  if selected_main not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn') then
    raise exception 'Spécialité principale invalide';
  end if;
  if selected_second not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn') then
    raise exception 'Spécialité secondaire invalide';
  end if;
  if selected_main = selected_second then
    raise exception 'Les deux spécialités doivent être différentes';
  end if;

  insert into public.profiles (id, member_key, pseudo, main_spec, second_spec, role)
  values (new.id, inv.member_key, inv.pseudo, selected_main, selected_second, inv.role);
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Un membre peut modifier uniquement son pseudo, sans accès aux autres champs du profil.
create or replace function public.update_my_pseudo(p_pseudo text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare cleaned_pseudo text := trim(coalesce(p_pseudo, ''));
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if char_length(cleaned_pseudo) < 2 or char_length(cleaned_pseudo) > 24 then
    raise exception 'Le pseudo doit contenir entre 2 et 24 caractères';
  end if;
  update public.profiles set pseudo = cleaned_pseudo where id = auth.uid();
  if not found then raise exception 'Profil introuvable'; end if;
  return cleaned_pseudo;
end $$;
revoke all on function public.update_my_pseudo(text) from public, anon;
grant execute on function public.update_my_pseudo(text) to authenticated;

-- Chaque membre reçoit automatiquement quatre tâches individuelles par semaine.
create or replace function public.assign_personal_tasks(p_member_key text, p_main_spec text, p_second_spec text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.tasks (id, week, kind, owner_member, title, description, topic, level, presenter_member, starts_on, ends_on, sort_order)
  select
    'S' || lpad(w.week_no::text, 2, '0') || '-ind-' || p_member_key || '-' || slot.slot_no,
    w.week_no, 'individual', p_member_key,
    case
      when w.week_no = 1 then 'Séance individuelle : ' || (array['Installer et démarrer la VM Kali','Créer les comptes sur les plateformes d’entraînement','Bloquer les créneaux de préparation dans l’agenda','Rejoindre le groupe et préparer le dépôt de write-ups'])[slot.slot_no]
      when w.week_no between 2 and 19 and slot.slot_no = 1 then 'Séance individuelle — ' || case when w.week_no % 2 = 0 then p_main_spec else p_second_spec end || ' : Niveau ' || (floor((w.week_no - 2) / 6.0)::int + 1)
      when w.week_no between 20 and 23 and slot.slot_no = 1 then 'Travailler ma catégorie la plus faible'
      when w.week_no = 24 and slot.slot_no = 1 then 'Relire mes notes et préparer le premier jour'
      else 'Séance libre ' || (slot.slot_no - 1)
    end,
    case
      when w.week_no = 1 then (array['Installer et démarrer la VM Kali','Créer les comptes sur les plateformes d’entraînement','Bloquer les créneaux de préparation dans l’agenda','Rejoindre le groupe et préparer le dépôt de write-ups'])[slot.slot_no]
      when w.week_no between 2 and 19 and slot.slot_no = 1 then 'Étudier et pratiquer la spécialité choisie, puis rédiger un write-up.'
      when w.week_no between 20 and 23 and slot.slot_no = 1 then 'Choisir une épreuve de sa catégorie la moins maîtrisée, la résoudre et noter les points à revoir.'
      when w.week_no = 24 and slot.slot_no = 1 then 'Relire les notes et write-ups, vérifier le matériel et revoir le déroulé du premier jour.'
      else 'Créneau individuel libre pour pratiquer, résoudre une épreuve et compléter un write-up.'
    end,
    case when w.week_no between 2 and 19 and slot.slot_no = 1 then case when w.week_no % 2 = 0 then p_main_spec else p_second_spec end else null end,
    case when w.week_no between 2 and 19 then floor((w.week_no - 2) / 6.0)::int + 1 else null end,
    null,
    date '2026-11-23' + (w.week_no - 1) * 7,
    date '2026-11-29' + (w.week_no - 1) * 7,
    100 + slot.slot_no
  from generate_series(1, 24) as w(week_no)
  cross join generate_series(1, 4) as slot(slot_no)
  on conflict (id) do nothing;
$$;
revoke all on function public.assign_personal_tasks(text, text, text) from public, anon, authenticated;

create or replace function public.on_profile_created_assign_tasks() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assign_personal_tasks(new.member_key, new.main_spec, new.second_spec);
  return new;
end $$;

create trigger on_profile_created_assign_tasks
after insert on public.profiles
for each row execute function public.on_profile_created_assign_tasks();

-- La coche est limitée à la tâche du membre et à sa semaine (heure de Porto-Novo).
create or replace function public.check_completion() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.tasks; me public.profiles; today date;
begin
  select * into t from public.tasks where id = new.task_id;
  select * into me from public.profiles where id = new.user_id;
  if t.id is null or me.id is null then
    raise exception 'Séance ou profil introuvable';
  end if;
  today := (now() at time zone 'Africa/Porto-Novo')::date;

  if t.owner_member is not null and t.owner_member <> me.member_key then
    raise exception 'Cette séance appartient à un autre membre';
  end if;
  if today < t.starts_on then
    raise exception 'Cette séance n''est pas encore ouverte';
  end if;
  if today > t.ends_on then
    raise exception 'Séance terminée : impossible de la rattraper';
  end if;

  new.completed_at := now();
  new.cancelled_at := null;
  new.cancelled_by := null;
  new.cancel_reason := null;
  return new;
end $$;

create trigger completions_check
before insert on public.completions
for each row execute function public.check_completion();

create or replace function public.admin_cancel_completion(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''admin'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Motif obligatoire'; end if;
  update public.completions
     set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_id;
  if not found then raise exception 'Coche introuvable'; end if;
end $$;

create or replace function public.admin_restore_completion(p_id bigint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''admin'; end if;
  update public.completions
     set cancelled_at = null, cancelled_by = null, cancel_reason = null
   where id = p_id;
  if not found then raise exception 'Coche introuvable'; end if;
end $$;

revoke all on function public.admin_cancel_completion(bigint, text) from public, anon;
revoke all on function public.admin_restore_completion(bigint) from public, anon;
grant execute on function public.admin_cancel_completion(bigint, text) to authenticated;
grant execute on function public.admin_restore_completion(bigint) to authenticated;

-- ============ CLASSEMENT : les points sont calculés côté serveur ============
create or replace view public.leaderboard as
select user_id, pseudo, member_key, sessions_done, points,
       rank() over (order by points desc) as rank
from (
  select p.id as user_id, p.pseudo, p.member_key,
         coalesce(c.sessions, 0) as sessions_done,
         coalesce(c.pts, 0) + coalesce(a.pts, 0) as points
  from public.profiles p
  left join (
    select c.user_id, count(*) as sessions,
           sum(10 + case when t.presenter_member = p2.member_key then 5 else 0 end) as pts
    from public.completions c
    join public.tasks t on t.id = c.task_id
    join public.profiles p2 on p2.id = c.user_id
    where c.cancelled_at is null
    group by c.user_id
  ) c on c.user_id = p.id
  left join (
    select user_id, sum(delta) as pts
    from public.point_adjustments group by user_id
  ) a on a.user_id = p.id
) scores;

create or replace view public.team_score as
select coalesce(sum(points), 0)::int as total, count(*)::int as events
from public.team_score_events;

-- ============ RLS ET PRIVILÈGES ============
alter table public.invitations enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.completions enable row level security;
alter table public.point_adjustments enable row level security;
alter table public.team_score_events enable row level security;

create policy inv_admin on public.invitations for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy prof_read on public.profiles for select to authenticated using (true);
create policy tasks_read on public.tasks for select to authenticated using (true);
create policy comp_read on public.completions for select to authenticated using (true);
create policy comp_insert on public.completions for insert to authenticated
  with check (user_id = auth.uid());
create policy comp_delete_own on public.completions for delete to authenticated
  using (
    user_id = auth.uid()
    and cancelled_at is null
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (now() at time zone 'Africa/Porto-Novo')::date <= t.ends_on
    )
  );
-- Aucune policy UPDATE sur completions : seules les fonctions admin écrivent les annulations.

create policy adj_read on public.point_adjustments for select to authenticated using (true);
create policy adj_insert on public.point_adjustments for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy team_read on public.team_score_events for select to authenticated using (true);
create policy team_insert on public.team_score_events for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

revoke all on public.invitations, public.profiles, public.tasks, public.completions,
  public.point_adjustments, public.team_score_events from anon;
-- Le ping keepalive public ne renvoie aucune ligne : RLS reste sans policy anon.
grant select on public.tasks to anon;
grant select, insert, update, delete on public.invitations to authenticated;
grant select on public.profiles, public.tasks, public.completions,
  public.point_adjustments, public.team_score_events to authenticated;
grant insert, delete on public.completions to authenticated;
grant insert on public.point_adjustments, public.team_score_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on public.leaderboard, public.team_score from anon;
grant select on public.leaderboard, public.team_score to authenticated;
