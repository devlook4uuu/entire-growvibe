-- ============================================================
-- Migration: support_tickets + support_ticket_replies
-- 20260421190000_create_support_tickets.sql
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
create type public.support_ticket_status   as enum ('open', 'closed');
create type public.support_ticket_priority as enum ('low', 'medium', 'high');

-- ── support_tickets ───────────────────────────────────────────────────────────
create table public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)   on delete cascade,
  created_by  uuid not null references public.profiles(id)  on delete cascade,
  role        text not null,
  title       text not null,
  message     text not null,
  priority    public.support_ticket_priority not null default 'medium',
  status      public.support_ticket_status   not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

-- Creator can read their own tickets
create policy "support_tickets: creator read own"
  on public.support_tickets for select
  using (created_by = auth.uid());

-- Creator can insert (school_id + created_by enforced below via check)
create policy "support_tickets: creator insert"
  on public.support_tickets for insert
  with check (created_by = auth.uid());

-- Admin can read all
create policy "support_tickets: admin all"
  on public.support_tickets for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── support_ticket_replies ────────────────────────────────────────────────────
create table public.support_ticket_replies (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  school_id  uuid not null references public.schools(id)         on delete cascade,
  sent_by    uuid not null references public.profiles(id)        on delete cascade,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.support_ticket_replies enable row level security;

-- Ticket creator can read replies on their own tickets
create policy "support_ticket_replies: creator read"
  on public.support_ticket_replies for select
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.created_by = auth.uid()
    )
  );

-- Ticket creator can insert replies only if ticket is open
create policy "support_ticket_replies: creator insert if open"
  on public.support_ticket_replies for insert
  with check (
    sent_by = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.created_by = auth.uid()
        and t.status = 'open'
    )
  );

-- Admin can read + insert all replies
create policy "support_ticket_replies: admin all"
  on public.support_ticket_replies for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index support_tickets_created_by_idx  on public.support_tickets(created_by);
create index support_tickets_school_id_idx   on public.support_tickets(school_id);
create index support_ticket_replies_ticket_idx on public.support_ticket_replies(ticket_id);
