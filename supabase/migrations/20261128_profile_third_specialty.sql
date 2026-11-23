-- Ajoute une troisième spécialité facultative et répartit les séances futures
-- entre deux ou trois spécialités sans réécrire les séances terminées.
alter table public.profiles add column if not exists third_spec text;

alter table public.profiles drop constraint if exists profiles_third_specialty_distinct;
alter table public.profiles add constraint profiles_third_specialty_distinct
  check (third_spec is null or (third_spec <> main_spec and third_spec <> second_spec));

drop function if exists public.update_my_specialties(text, text);
create or replace function public.update_my_specialties(
  p_main_spec text,
  p_second_spec text,
  p_third_spec text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_main text := lower(trim(coalesce(p_main_spec, '')));
  selected_second text := lower(trim(coalesce(p_second_spec, '')));
  selected_third text := nullif(lower(trim(coalesce(p_third_spec, ''))), '');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if selected_main not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn')
    or selected_second not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn')
    or (selected_third is not null and selected_third not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn')) then
    raise exception 'Spécialité invalide';
  end if;
  if selected_main = selected_second or selected_third in (selected_main, selected_second) then
    raise exception 'Les spécialités doivent être différentes';
  end if;

  update public.profiles
  set main_spec = selected_main, second_spec = selected_second, third_spec = selected_third
  where id = auth.uid();
  if not found then raise exception 'Profil introuvable'; end if;
end;
$$;
revoke all on function public.update_my_specialties(text, text, text) from public, anon;
grant execute on function public.update_my_specialties(text, text, text) to authenticated;

create or replace function public.on_profile_specialties_changed_update_tasks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.main_spec is not distinct from old.main_spec
    and new.second_spec is not distinct from old.second_spec
    and new.third_spec is not distinct from old.third_spec then
    return new;
  end if;

  update public.tasks t
  set topic = case
        when new.third_spec is null then case when t.week % 2 = 0 then new.main_spec else new.second_spec end
        else (array[new.main_spec, new.second_spec, new.third_spec])[((t.week - 2) % 3) + 1]
      end,
      title = 'Séance individuelle — ' || case
        when new.third_spec is null then case when t.week % 2 = 0 then new.main_spec else new.second_spec end
        else (array[new.main_spec, new.second_spec, new.third_spec])[((t.week - 2) % 3) + 1]
      end || ' : Niveau ' || t.level,
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
after update of main_spec, second_spec, third_spec on public.profiles
for each row execute function public.on_profile_specialties_changed_update_tasks();
