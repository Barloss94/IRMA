begin;
do $test$
declare first_user uuid := gen_random_uuid(); second_user uuid := gen_random_uuid(); affected integer;
begin
  insert into auth.users(id,email) values(first_user,first_user||'@irma-test.invalid'),(second_user,second_user||'@irma-test.invalid');
  insert into public.profiles(user_id,full_name,email) values(first_user,'Origineel',first_user||'@irma-test.invalid'),(second_user,'Andere persoon',second_user||'@irma-test.invalid') on conflict(user_id) do update set full_name=excluded.full_name;
  perform set_config('request.jwt.claims',json_build_object('sub',first_user,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.profiles(user_id,full_name,email) values(first_user,'Nieuwe naam',first_user||'@irma-test.invalid') on conflict(user_id) do update set full_name=excluded.full_name;
  if (select full_name from public.profiles where user_id=first_user) != 'Nieuwe naam' then raise exception 'Own profile update failed'; end if;
  update public.profiles set full_name='Niet toegestaan' where user_id=second_user;
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'Another profile could be changed'; end if;
  begin
    insert into public.profiles(user_id,full_name) values(second_user,'Niet toegestaan') on conflict(user_id) do update set full_name=excluded.full_name;
    raise exception 'Another profile could be upserted';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$test$;
rollback;
select 'PASS: own profile saved; changing another user profile blocked; test data rolled back' as result;
