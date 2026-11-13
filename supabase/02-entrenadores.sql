-- Mi Gym: entrenadores y alumnos. Pegar entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez. Necesita haber ejecutado antes schema.sql.

-- ¿es entrenador? (función segura para usarla dentro de las reglas sin bucles)
create or replace function public.is_trainer(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and role = 'trainer');
$$;

-- Al registrarse: nombre y rol que eligió (usuario o entrenador)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'trainer' then 'trainer' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Solicitudes de entrenamiento: el usuario pide, el entrenador acepta o rechaza
create table if not exists public.coach_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trainer_id)
);
alter table public.coach_links enable row level security;
grant select, insert, update, delete on public.coach_links to authenticated;

drop policy if exists "ver mis solicitudes" on public.coach_links;
create policy "ver mis solicitudes" on public.coach_links
  for select using (auth.uid() = user_id or auth.uid() = trainer_id);

drop policy if exists "pedir entrenador" on public.coach_links;
create policy "pedir entrenador" on public.coach_links
  for insert with check (auth.uid() = user_id and status = 'pending' and user_id <> trainer_id and public.is_trainer(trainer_id));

drop policy if exists "entrenador responde" on public.coach_links;
create policy "entrenador responde" on public.coach_links
  for update using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

drop policy if exists "cancelar o dejar" on public.coach_links;
create policy "cancelar o dejar" on public.coach_links
  for delete using (auth.uid() = user_id or auth.uid() = trainer_id);

-- Perfiles: cualquiera con sesión ve a los entrenadores; el entrenador ve a quien le ha pedido
drop policy if exists "ver entrenadores" on public.profiles;
create policy "ver entrenadores" on public.profiles
  for select to authenticated using (role = 'trainer');

drop policy if exists "entrenador ve a sus alumnos" on public.profiles;
create policy "entrenador ve a sus alumnos" on public.profiles
  for select using (exists (select 1 from public.coach_links l where l.trainer_id = auth.uid() and l.user_id = profiles.id));

-- Datos: el entrenador solo lee los de sus alumnos aceptados
drop policy if exists "entrenador lee a sus alumnos" on public.user_data;
create policy "entrenador lee a sus alumnos" on public.user_data
  for select using (exists (select 1 from public.coach_links l where l.trainer_id = auth.uid() and l.user_id = user_data.user_id and l.status = 'accepted'));
