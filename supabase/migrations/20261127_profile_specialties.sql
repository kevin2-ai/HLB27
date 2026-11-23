-- Autorise chaque membre à modifier ses spécialités depuis son profil.
-- Les séances futures non terminées suivent automatiquement les nouveaux choix.
create or replace function public.update_my_specialties(p_main_spec text, p_second_spec text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_main text := lower(trim(coalesce(p_main_spec, '')));
  selected_second text := lower(trim(coalesce(p_second_spec, '')));
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if selected_main not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn')
    or selected_second not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn') then
    raise exception 'Spécialité invalide';
  end if;
  if selected_main = selected_second then
    raise exception 'Choisis deux spécialités différentes';
  end if;

  update public.profiles
  set main_spec = selected_main, second_spec = selected_second
  where id = auth.uid();
  if not found then raise exception 'Profil introuvable'; end if;
end;
$$;
revoke all on function public.update_my_specialties(text, text) from public, anon;
grant execute on function public.update_my_specialties(text, text) to authenticated;

create or replace function public.on_profile_specialties_changed_update_tasks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.main_spec is not distinct from old.main_spec
    and new.second_spec is not distinct from old.second_spec then
    return new;
  end if;

  update public.tasks t
  set topic = case when t.week % 2 = 0 then new.main_spec else new.second_spec end,
      title = 'Séance individuelle — ' || case when t.week % 2 = 0 then new.main_spec else new.second_spec end
        || ' : Niveau ' || t.level,
      description = 'Étudier et pratiquer la spécialité choisie, puis rédiger un write-up.'
  where t.kind = 'individual'
    and t.owner_member = new.member_key
    and t.week between 2 and 19
    and t.sort_order = 101
    and t.starts_on >= (now() at time zone 'Africa/Porto-Novo')::date
    and not exists (select 1 from public.completions c where c.task_id = t.id);

  return new;
end;
$$;

drop trigger if exists on_profile_specialties_changed_update_tasks on public.profiles;
create trigger on_profile_specialties_changed_update_tasks
after update of main_spec, second_spec on public.profiles
for each row execute function public.on_profile_specialties_changed_update_tasks();
