-- À exécuter sur un projet déjà créé pour permettre le choix des spécialités à l'inscription.
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

  if lower(coalesce(new.raw_user_meta_data ->> 'specialties_selected', 'false')) = 'true' then
    selected_main := nullif(lower(trim(new.raw_user_meta_data ->> 'main_spec')), '');
    selected_second := nullif(lower(trim(new.raw_user_meta_data ->> 'second_spec')), '');
    if (selected_main is null and selected_second is not null)
       or (selected_main is not null and selected_second is null) then
      raise exception 'Choisis les deux spécialités ou rejoins sans plan personnel';
    end if;
    if selected_main is not null and selected_main not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn') then
      raise exception 'Spécialité principale invalide';
    end if;
    if selected_second is not null and selected_second not in ('reverse','stegano','web','reseau_ad','osint','forensics','crypto','pwn') then
      raise exception 'Spécialité secondaire invalide';
    end if;
    if selected_main is not null and selected_main = selected_second then
      raise exception 'Les deux spécialités doivent être différentes';
    end if;
  else
    selected_main := inv.main_spec;
    selected_second := inv.second_spec;
  end if;

  insert into public.profiles (id, member_key, pseudo, main_spec, second_spec, role)
  values (new.id, inv.member_key, inv.pseudo, selected_main, selected_second, inv.role);
  return new;
end $$;
