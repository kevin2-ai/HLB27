-- Autorise les validations et dévalidations à toute date.
create or replace function public.check_completion() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.tasks; me public.profiles;
begin
  select * into t from public.tasks where id = new.task_id;
  select * into me from public.profiles where id = new.user_id;
  if t.id is null or me.id is null then
    raise exception 'Séance ou profil introuvable';
  end if;
  if t.owner_member is not null and t.owner_member <> me.member_key then
    raise exception 'Cette séance appartient à un autre membre';
  end if;
  if t.kind = 'individual' and t.week >= 2 then
    if new.writeup_url is null or new.writeup_url !~* '^https://github\.com/[A-Za-z0-9-]+/[A-Za-z0-9._-]+/blob/[A-Za-z0-9._-]+/.+\.md([?#].*)?$' then
      raise exception 'Un lien GitHub vers un fichier Markdown est obligatoire pour cette séance';
    end if;
  else
    new.writeup_url := null;
  end if;
  new.completed_at := now();
  new.cancelled_at := null;
  new.cancelled_by := null;
  new.cancel_reason := null;
  return new;
end $$;

alter policy comp_delete_own on public.completions
  using (user_id = auth.uid() and cancelled_at is null);
