-- Vérifie uniquement le préfixe du dépôt HackerLab et l'extension Markdown.
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
  if new.writeup_url is null
    or new.writeup_url !~ '^https://github\.com/kevin2-ai/HLB-write-up/.+\.md$' then
    raise exception 'Le lien doit commencer par https://github.com/kevin2-ai/HLB-write-up/ et se terminer par .md';
  end if;
  new.completed_at := now();
  new.cancelled_at := null;
  new.cancelled_by := null;
  new.cancel_reason := null;
  return new;
end $$;
