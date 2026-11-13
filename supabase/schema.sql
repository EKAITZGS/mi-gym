-- Mi Gym: cuentas y datos en la nube (Supabase).
-- Pegar entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

-- Perfil de cada cuenta. role: 'user' o 'trainer' (lo de entrenadores se usará más adelante).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  role text not null default 'user' check (role in ('user', 'trainer')),
  created_at timestamptz not null default now()
);

-- Todos los datos de la app de cada usuario (lo mismo que guarda el móvil), en un solo documento.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  device text
);

-- Seguridad: cada uno solo ve y cambia lo suyo.
alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "datos propios" on public.user_data;
create policy "datos propios" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Permisos de la API para usuarios con sesión (por si el proyecto no expone las tablas nuevas solo).
-- Aun así, las reglas de arriba hacen que cada uno solo toque lo suyo.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;

-- Al registrarse se crea su perfil con el nombre que puso.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
