-- Vérifications structurelles à lancer après schema.sql et seed_tasks.sql.
-- Pour les tests d'inscription et d'accès, créer deux comptes d'essai et suivre le README.
do $$
declare
  task_count int;
  week_count int;
begin
  select count(*) into task_count from public.tasks;
  if task_count <> 644 then
    raise exception 'Attendu : 644 tâches ; trouvé : %', task_count;
  end if;

  select count(distinct week) into week_count from public.tasks;
  if week_count <> 24 then raise exception 'Le seed ne couvre pas les 24 semaines'; end if;
  if (select min(starts_on) from public.tasks) <> date '2026-11-23'
     or (select max(ends_on) from public.tasks) <> date '2027-05-09' then
    raise exception 'Les dates extrêmes du planning sont incorrectes';
  end if;
  if not exists (select 1 from public.tasks where id = 'S02-general-1' and level = 1 and presenter_member = 'kevin') then
    raise exception 'S2 doit être le cycle 1, avec Kevin comme premier présentateur';
  end if;
  if not exists (select 1 from public.tasks where id = 'S08-general-1' and level = 2)
     or not exists (select 1 from public.tasks where id = 'S14-general-1' and level = 3) then
    raise exception 'La rotation des niveaux S2/S8/S14 est incorrecte';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email') then
    raise exception 'profiles ne doit pas contenir d’adresse email';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leaderboard' and column_name = 'email') then
    raise exception 'leaderboard ne doit pas exposer d’adresse email';
  end if;
  if has_table_privilege('anon', 'public.invitations', 'SELECT')
     or has_table_privilege('anon', 'public.profiles', 'SELECT')
     or has_table_privilege('anon', 'public.completions', 'SELECT')
     or has_table_privilege('anon', 'public.point_adjustments', 'SELECT')
     or has_table_privilege('anon', 'public.team_score_events', 'SELECT')
     or has_table_privilege('anon', 'public.leaderboard', 'SELECT')
     or has_table_privilege('anon', 'public.team_score', 'SELECT') then
    raise exception 'Le rôle anon ne doit lire aucune donnée privée';
  end if;
  if not has_table_privilege('anon', 'public.tasks', 'SELECT')
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and ('anon' = any(roles) or 'public' = any(roles))) then
    raise exception 'Le ping anon doit avoir accès à zéro ligne de tâches via RLS';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.completions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.point_adjustments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.team_score_events', 'UPDATE') then
    raise exception 'Les écritures directes protégées doivent rester interdites';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.completions'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.invitations'::regclass) then
    raise exception 'RLS doit être activé sur les tables sensibles';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_cancel_completion(bigint,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_cancel_completion(bigint,text)', 'EXECUTE') then
    raise exception 'La fonction d’annulation doit être accessible uniquement aux utilisateurs connectés';
  end if;
end $$;

select 'Vérifications structurelles réussies' as résultat;
