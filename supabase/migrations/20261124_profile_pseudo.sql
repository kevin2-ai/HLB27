-- Permet à chaque membre de créer ou modifier son pseudo sans autoriser
-- la modification des autres champs du profil.
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
