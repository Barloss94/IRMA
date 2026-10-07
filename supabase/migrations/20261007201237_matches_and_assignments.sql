-- Reuse IRMA's existing tables and scope all writes to the club's coordinators.
alter table public.matches enable row level security;
alter table public.assignments enable row level security;

alter table public.matches add constraint matches_id_org_unique unique (id, org_id);
alter table public.assignments add constraint assignments_match_org_fkey
  foreign key (match_id, org_id) references public.matches(id, org_id) on delete cascade;
alter table public.assignments add constraint assignments_member_org_fkey
  foreign key (org_id, referee_user_id) references public.memberships(org_id, user_id) on delete cascade;

create index if not exists matches_org_starts_at_idx on public.matches(org_id, starts_at);
create index if not exists assignments_org_referee_idx on public.assignments(org_id, referee_user_id);

drop policy "matches manage" on public.matches;
create policy "matches manage" on public.matches for insert to authenticated
  with check (public.is_coordinator(org_id) and created_by = (select auth.uid()));
create policy "matches delete by coordinator" on public.matches for delete to authenticated
  using (public.is_coordinator(org_id));

drop policy "assignments insert by coordinator" on public.assignments;
create policy "assignments insert by coordinator" on public.assignments for insert to authenticated
  with check (public.is_coordinator(org_id) and assigned_by = (select auth.uid()));
drop policy "assignments update by coordinator OR referee sees" on public.assignments;
create policy "assignments update by coordinator" on public.assignments for update to authenticated
  using (public.is_coordinator(org_id)) with check (public.is_coordinator(org_id));
create policy "assignments delete by coordinator" on public.assignments for delete to authenticated
  using (public.is_coordinator(org_id));

grant select, insert, update, delete on public.matches, public.assignments to authenticated;
