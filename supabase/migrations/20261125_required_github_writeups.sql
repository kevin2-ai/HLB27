-- Les coches des tâches individuelles à partir du cycle 1 doivent conserver
-- un lien vers un fichier Markdown GitHub réel (vérification API côté app).
alter table public.completions add column if not exists writeup_url text;

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
