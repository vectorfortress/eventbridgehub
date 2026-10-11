-- EventBridge Hub: closed-pilot schema. Apply to a NEW Supabase project.
-- Admins are promoted manually in the SQL editor; no signup can grant admin.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer','planner','vendor','admin')),
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (char_length(category) between 2 and 60),
  city text not null check (char_length(city) between 2 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  starting_price numeric(12,2) not null default 0 check (starting_price >= 0),
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  planner_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  kind text not null check (char_length(kind) between 2 and 80),
  event_date date not null,
  city text not null check (char_length(city) between 2 and 100),
  guests integer not null check (guests between 1 and 10000),
  budget numeric(12,2) not null default 0 check (budget >= 0),
  services text not null default '' check (char_length(services) <= 400),
  notes text not null default '' check (char_length(notes) <= 2000),
  status text not null default 'new' check (status in ('new','sourcing','proposal_sent')),
  created_at timestamptz not null default now()
);

create table public.event_vendor_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(event_id, business_id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.event_vendor_requests(id) on delete cascade,
  status text not null check (status in ('quoted','declined')),
  amount numeric(12,2),
  inclusions text not null default '' check (char_length(inclusions) <= 1500),
  expires_at date,
  created_at timestamptz not null default now(),
  constraint quote_amount_valid check ((status='quoted' and amount > 0 and expires_at is not null) or (status='declined' and amount is null))
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  planner_id uuid not null references public.profiles(id),
  planner_fee numeric(12,2) not null default 0 check (planner_fee >= 0),
  status text not null default 'draft' check (status in ('draft','sent')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  quote_id uuid not null unique references public.quotes(id),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index on public.businesses (owner_id);
create index on public.businesses (status);
create index on public.events (customer_id);
create index on public.events (planner_id);
create index on public.event_vendor_requests (business_id);
create index on public.event_vendor_requests (event_id);
create index on public.quotes (request_id);
create index on public.proposals (planner_id);
create index on public.proposal_items (proposal_id);

-- Create a profile automatically. Account role is ALWAYS restricted at signup.
create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare claimed_role text;
begin
  claimed_role := coalesce(new.raw_user_meta_data ->> 'role','customer');
  if claimed_role not in ('customer','planner','vendor') then claimed_role := 'customer'; end if;
  insert into public.profiles(id,full_name,role)
  values(new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name',''),100),claimed_role);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();

-- Auth checks run with the privileges of this schema's owner, not the end user.
create or replace function private.has_role(wanted text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = wanted);
$$;
create or replace function private.plans_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.events where id = eid and planner_id = (select auth.uid()));
$$;
create or replace function private.owns_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.events where id = eid and customer_id = (select auth.uid()));
$$;
create or replace function private.owns_business(bid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.businesses where id = bid and owner_id = (select auth.uid()));
$$;
create or replace function private.owns_request(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.event_vendor_requests r join public.businesses b on r.business_id = b.id
                where r.id = rid and b.owner_id = (select auth.uid()));
$$;
create or replace function private.plans_request(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.event_vendor_requests r join public.events e on r.event_id=e.id
                where r.id=rid and e.planner_id=(select auth.uid()));
$$;
create or replace function private.vendor_on_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.event_vendor_requests r join public.businesses b on b.id=r.business_id
                where r.event_id=eid and b.owner_id=(select auth.uid()));
$$;
create or replace function private.plans_proposal(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.proposals p where p.id=pid and p.planner_id=(select auth.uid())
      and q.expires_at >= current_date);
$$;
create or replace function private.customer_sees_proposal(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.proposals p join public.events e on e.id=p.event_id
                where p.id=pid and p.status='sent' and e.customer_id=(select auth.uid()));
$$;
create or replace function private.quote_for_proposal(qid uuid, pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.quotes q
    join public.event_vendor_requests r on r.id=q.request_id
    join public.proposals p on p.event_id=r.event_id
    where q.id=qid and p.id=pid and p.status='draft' and q.status='quoted'
      and p.planner_id=(select auth.uid())
      and q.expires_at >= current_date
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function private.has_role(text), private.plans_event(uuid), private.owns_event(uuid),
 private.owns_business(uuid), private.owns_request(uuid), private.plans_request(uuid),
 private.vendor_on_event(uuid), private.plans_proposal(uuid), private.customer_sees_proposal(uuid),
 private.quote_for_proposal(uuid,uuid) to authenticated;

-- Freeze the event and source amount for every proposal item. No fake vendor quote totals.
create or replace function private.validate_proposal_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare found_amount numeric(12,2); found_name text;
begin
  select q.amount, b.name into found_amount, found_name
  from public.quotes q join public.event_vendor_requests r on q.request_id=r.id
  join public.businesses b on b.id=r.business_id
  join public.proposals p on p.event_id=r.event_id
  where q.id=new.quote_id and p.id=new.proposal_id and q.status='quoted' and p.status='draft';
  if found_amount is null then raise exception 'Quote is not eligible for this proposal'; end if;
  new.amount := found_amount;
  new.description := found_name;
  return new;
end;
$$;
create trigger validate_proposal_item before insert on public.proposal_items
for each row execute function private.validate_proposal_item();

create or replace function private.validate_proposal_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.event_id is distinct from new.event_id or old.planner_id is distinct from new.planner_id then
    raise exception 'Proposal ownership is immutable';
  end if;
  if old.status='sent' then raise exception 'Sent proposals are immutable'; end if;
  if old.status='draft' and new.status='sent' then
    if not exists(select 1 from public.proposal_items where proposal_id=new.id) then
      raise exception 'Add at least one supplier quote before sharing';
    end if;
    new.sent_at := now();
    update public.events set status='proposal_sent' where id=new.event_id;
  end if;
  return new;
end;
$$;
create trigger validate_proposal_update before update on public.proposals
for each row execute function private.validate_proposal_update();

-- The event trigger permits a draft-with-items -> shared-proposal transition.
-- All other status transitions are restricted.
create or replace function private.validate_event_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.customer_id is distinct from new.customer_id then
    raise exception 'Cannot reassign an event customer';
  end if;
  if old.planner_id is distinct from new.planner_id then
    if not private.has_role('admin') then raise exception 'Only admins can assign planners'; end if;
    if new.planner_id is not null and not exists(select 1 from public.profiles where id=new.planner_id and role='planner') then
      raise exception 'Planner account required';
    end if;
  end if;
  if old.status is distinct from new.status and not private.has_role('admin') then
    if not (old.status='new' and new.status='sourcing') and not
       (old.status='sourcing' and new.status='proposal_sent' and
        exists(select 1 from public.proposals p where p.event_id=new.id and p.status='draft' and
          exists(select 1 from public.proposal_items where proposal_id=p.id))) then
      raise exception 'Invalid event status transition';
    end if;
  end if;
  return new;
end;
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.events enable row level security;
alter table public.event_vendor_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

-- Lock down table grants independently from RLS.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.businesses to anon;
grant select on public.profiles, public.businesses, public.events, public.event_vendor_requests,
  public.quotes, public.proposals, public.proposal_items to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert on public.businesses, public.events, public.event_vendor_requests, public.quotes,
  public.proposals, public.proposal_items to authenticated;
grant update (name,category,city,description,starting_price,status) on public.businesses to authenticated;
grant update (planner_id,status) on public.events to authenticated;
grant update (status,planner_fee,sent_at) on public.proposals to authenticated;

create policy profiles_read on public.profiles for select to authenticated
 using (id=(select auth.uid()) or (select private.has_role('admin')));
create policy profiles_edit_name on public.profiles for update to authenticated
 using(id=(select auth.uid())) with check(id=(select auth.uid()));

create policy public_approved_businesses on public.businesses for select to anon, authenticated
 using(status='approved');
create policy business_owner_or_admin_read on public.businesses for select to authenticated
 using(owner_id=(select auth.uid()) or (select private.has_role('admin')));
create policy business_owner_insert on public.businesses for insert to authenticated
 with check(owner_id=(select auth.uid()) and status='pending' and (select private.has_role('vendor')));
create policy business_owner_or_admin_edit on public.businesses for update to authenticated
 using(owner_id=(select auth.uid()) or (select private.has_role('admin')))
 with check((select private.has_role('admin')) or
   (owner_id=(select auth.uid()) and status='pending' and (select private.has_role('vendor'))));

create policy events_read on public.events for select to authenticated
 using(customer_id=(select auth.uid()) or planner_id=(select auth.uid()) or
   (select private.has_role('admin')) or (select private.vendor_on_event(id)));
create policy events_customer_insert on public.events for insert to authenticated
 with check(customer_id=(select auth.uid()) and planner_id is null and status='new' and
   (select private.has_role('customer')));
create policy events_admin_or_planner_update on public.events for update to authenticated
 using((select private.has_role('admin')) or (planner_id=(select auth.uid()) and (select private.has_role('planner'))))
 with check((select private.has_role('admin')) or (planner_id=(select auth.uid()) and (select private.has_role('planner'))));

create policy requests_read on public.event_vendor_requests for select to authenticated
 using((select private.plans_event(event_id)) or (select private.owns_business(business_id)) or
       (select private.has_role('admin')));
create policy requests_insert_by_planner on public.event_vendor_requests for insert to authenticated
 with check((select private.has_role('planner')) and (select private.plans_event(event_id)) and
   exists(select 1 from public.businesses b where b.id=business_id and b.status='approved'));

create policy quotes_read on public.quotes for select to authenticated
 using((select private.owns_request(request_id)) or (select private.plans_request(request_id)) or
  (select private.has_role('admin')));
create policy quotes_vendor_insert on public.quotes for insert to authenticated
 with check((select private.has_role('vendor')) and (select private.owns_request(request_id)));

create policy proposals_read on public.proposals for select to authenticated
 using(planner_id=(select auth.uid()) or (status='sent' and (select private.owns_event(event_id))) or
  (select private.has_role('admin')));
create policy proposals_planner_insert on public.proposals for insert to authenticated
 with check((select private.has_role('planner')) and planner_id=(select auth.uid()) and status='draft'
   and (select private.plans_event(event_id)));
create policy proposals_planner_update on public.proposals for update to authenticated
 using((select private.has_role('planner')) and planner_id=(select auth.uid()))
 with check((select private.has_role('planner')) and planner_id=(select auth.uid())) ;

create policy proposal_items_read on public.proposal_items for select to authenticated
 using((select private.plans_proposal(proposal_id)) or (select private.customer_sees_proposal(proposal_id)) or
   (select private.has_role('admin')));
create policy proposal_items_planner_insert on public.proposal_items for insert to authenticated
 with check((select private.plans_proposal(proposal_id)) and
   (select private.quote_for_proposal(quote_id,proposal_id)));

-- Admin bootstrap AFTER a real account signs up:
-- update public.profiles set role='admin' where id = 'VERIFIED_USER_UUID';

-- Atomic proposal creation: ensures draft + items either all succeed or all roll back.
create or replace function public.create_proposal_for_event(
  p_event_id uuid, p_planner_fee numeric, p_quote_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_pid uuid; quote_id uuid;
begin
  if not private.has_role('planner') or not private.plans_event(p_event_id) then
    raise exception 'Not assigned to this event';
  end if;
  if p_quote_ids is null or coalesce(array_length(p_quote_ids,1),0) < 1
      or array_length(p_quote_ids,1) > 25 then
    raise exception 'Choose between 1 and 25 vendor quotes';
  end if;
  if p_planner_fee is null or p_planner_fee < 0 or p_planner_fee > 1000000 then
    raise exception 'Invalid planner fee';
  end if;
  insert into public.proposals(event_id,planner_id,planner_fee)
    values(p_event_id,(select auth.uid()),p_planner_fee) returning id into new_pid;
  foreach quote_id in array p_quote_ids loop
    if not private.quote_for_proposal(quote_id,new_pid) then
      raise exception 'Quote does not belong to this event';
    end if;
    insert into public.proposal_items(proposal_id,quote_id,description,amount)
      values(new_pid,quote_id,'pending',1);
  end loop;
  return new_pid;
end;
$$;
revoke all on function public.create_proposal_for_event(uuid,numeric,uuid[]) from public,anon;
grant execute on function public.create_proposal_for_event(uuid,numeric,uuid[]) to authenticated;
