-- Tous les profils doivent choisir deux spécialités distinctes.
with normalized as (
  select p.id,
    coalesce(nullif(p.main_spec, ''), nullif(i.main_spec, ''), 'web') as main_spec,
    coalesce(nullif(p.second_spec, ''), nullif(i.second_spec, '')) as candidate_second
  from public.profiles p
  left join public.invitations i on i.member_key = p.member_key
)
update public.profiles p
set main_spec = n.main_spec,
    second_spec = case when n.candidate_second is null or n.candidate_second = n.main_spec
      then case when n.main_spec = 'crypto' then 'web' else 'crypto' end
      else n.candidate_second end
from normalized n
where n.id = p.id
  and (p.main_spec is null or p.second_spec is null or p.main_spec = p.second_spec);

alter table public.profiles alter column main_spec set not null;
alter table public.profiles alter column second_spec set not null;
alter table public.profiles add constraint profiles_distinct_specialties check (main_spec <> second_spec);

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

-- Création automatique des quatre tâches de chaque semaine pour tout nouveau profil.
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

drop trigger if exists on_profile_created_assign_tasks on public.profiles;
create trigger on_profile_created_assign_tasks
after insert on public.profiles
for each row execute function public.on_profile_created_assign_tasks();

-- Complète aussi le planning des membres déjà inscrits, sans écraser les séances existantes.
select public.assign_personal_tasks(member_key, main_spec, second_spec) from public.profiles;
