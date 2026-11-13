-- Mi Gym: mensajes entre entrenador y alumno, y entrenos que manda el entrenador.
-- Pegar entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

-- ¿estoy en esa relación aceptada? (como alumno o como entrenador)
create or replace function public.in_link(lid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.coach_links l where l.id = lid and l.status = 'accepted' and auth.uid() in (l.user_id, l.trainer_id));
$$;
create or replace function public.is_link_trainer(lid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.coach_links l where l.id = lid and l.status = 'accepted' and l.trainer_id = auth.uid());
$$;
create or replace function public.is_link_user(lid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.coach_links l where l.id = lid and l.status = 'accepted' and l.user_id = auth.uid());
$$;

-- Mensajes
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_links (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists coach_messages_link on public.coach_messages (link_id, created_at);
alter table public.coach_messages enable row level security;
revoke all on public.coach_messages from authenticated;
grant select, insert on public.coach_messages to authenticated;
grant update (read_at) on public.coach_messages to authenticated;

drop policy if exists "leer mensajes" on public.coach_messages;
create policy "leer mensajes" on public.coach_messages for select using (public.in_link(link_id));
drop policy if exists "escribir mensajes" on public.coach_messages;
create policy "escribir mensajes" on public.coach_messages for insert with check (sender_id = auth.uid() and public.in_link(link_id));
drop policy if exists "marcar leido" on public.coach_messages;
create policy "marcar leido" on public.coach_messages for update using (public.in_link(link_id) and sender_id <> auth.uid()) with check (public.in_link(link_id));

-- Entrenos que manda el entrenador (el alumno decide si los añade a su plan)
create table if not exists public.coach_workouts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_links (id) on delete cascade,
  day jsonb not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists coach_workouts_link on public.coach_workouts (link_id, created_at);
alter table public.coach_workouts enable row level security;
revoke all on public.coach_workouts from authenticated;
grant select, insert, delete on public.coach_workouts to authenticated;
grant update (status, answered_at) on public.coach_workouts to authenticated;

drop policy if exists "ver entrenos enviados" on public.coach_workouts;
create policy "ver entrenos enviados" on public.coach_workouts for select using (public.in_link(link_id));
drop policy if exists "entrenador manda" on public.coach_workouts;
create policy "entrenador manda" on public.coach_workouts for insert with check (public.is_link_trainer(link_id) and status = 'pending');
drop policy if exists "alumno responde" on public.coach_workouts;
create policy "alumno responde" on public.coach_workouts for update using (public.is_link_user(link_id)) with check (public.is_link_user(link_id));
drop policy if exists "entrenador borra" on public.coach_workouts;
create policy "entrenador borra" on public.coach_workouts for delete using (public.is_link_trainer(link_id));
