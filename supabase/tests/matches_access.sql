begin;
do $test$
declare
  coordinator uuid := gen_random_uuid(); referee uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  club uuid := gen_random_uuid(); other_club uuid := gen_random_uuid(); game uuid := gen_random_uuid(); appointment uuid := gen_random_uuid();
  affected integer;
begin
  insert into auth.users(id,email) values(coordinator, coordinator||'@irma-test.invalid'), (referee,referee||'@irma-test.invalid'), (outsider,outsider||'@irma-test.invalid');
  insert into public.profiles(user_id,email) values(coordinator,coordinator||'@irma-test.invalid'),(referee,referee||'@irma-test.invalid'),(outsider,outsider||'@irma-test.invalid') on conflict(user_id) do nothing;
  insert into public.organizations(id,name,primary_coordinator_user_id) values(club,'IRMA rollback test',coordinator),(other_club,'IRMA rollback other club',outsider);
  insert into public.memberships(org_id,user_id,role) values(club,coordinator,'coordinator'),(club,referee,'referee'),(other_club,outsider,'coordinator');
  perform set_config('request.jwt.claims',json_build_object('sub',coordinator,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.matches(id,org_id,kind,starts_at,home_team,away_team,created_by) values(game,club,'regular',now(),'Thuis','Uit',coordinator);
  update public.matches set location='Veld 1' where id=game;
  get diagnostics affected = row_count;
  if affected != 1 then raise exception 'Coordinator could not update match'; end if;
  insert into public.assignments(id,org_id,match_id,referee_user_id,assigned_by) values(appointment,club,game,referee,coordinator);
  begin
    insert into public.assignments(org_id,match_id,referee_user_id,assigned_by) values(club,game,outsider,coordinator);
    raise exception 'Cross-club referee allowed';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.assignments(org_id,match_id,referee_user_id,assigned_by) values(club,game,referee,coordinator);
    raise exception 'Duplicate assignment allowed';
  exception when unique_violation then null;
  end;
  perform set_config('request.jwt.claims',json_build_object('sub',referee,'role','authenticated')::text,true);
  if (select count(*) from public.assignments where referee_user_id=referee and match_id=game) != 1 then raise exception 'Referee cannot read own assignment'; end if;
  update public.assignments set assigned_by=referee where id=appointment;
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'Referee could change assignment'; end if;
  delete from public.matches where id=game;
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'Referee could delete match'; end if;
  begin
    insert into public.matches(org_id,kind,starts_at,created_by) values(club,'regular',now(),referee);
    raise exception 'Referee could create match';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
  if (select count(*) from public.matches where id=game) != 0 then raise exception 'Other club can read match'; end if;
  if (select count(*) from public.assignments where match_id=game) != 0 then raise exception 'Other club can read assignments'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',coordinator,'role','authenticated')::text,true);
  delete from public.assignments where id=appointment;
  get diagnostics affected = row_count;
  if affected != 1 then raise exception 'Coordinator cannot remove assignment'; end if;
  insert into public.assignments(org_id,match_id,referee_user_id,assigned_by) values(club,game,referee,coordinator);
  delete from public.matches where id=game;
  get diagnostics affected = row_count;
  if affected != 1 then raise exception 'Coordinator cannot delete match'; end if;
  if (select count(*) from public.assignments where match_id=game) != 0 then raise exception 'Assignments not cascaded'; end if;
  reset role;
end;
$test$;
rollback;
select 'PASS: CRUD, assignments, duplicate protection, club isolation, referee read-only, cascading deletion; test data rolled back' as result;
