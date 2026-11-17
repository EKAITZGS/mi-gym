-- MI-GYM: panel de administración (solo lectura).
-- Pegar entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.
-- Necesita haber ejecutado antes schema.sql, 02-entrenadores.sql y 05-privacidad.sql.
--
-- Quién es administrador lo decide esta tabla (no la app). Nadie puede leerla ni cambiarla desde la API:
-- solo desde el SQL Editor de Supabase. El administrador ve lo mismo que un entrenador (plan, entrenos,
-- peso y cintura, pulso del reloj y ejercicios propios); nunca la dieta, el sueño ni las fotos.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- ¿la cuenta con sesión es administradora?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Lista de usuarios con su actividad (vacía si no eres administrador)
create or replace function public.admin_users()
returns table (
  id uuid,
  email text,
  name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  updated_at timestamptz,
  sessions int,
  last_session text,
  sessions_30d int,
  plan_days int,
  has_polar boolean,
  admin boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    p.name,
    p.role,
    u.created_at,
    u.last_sign_in_at,
    d.updated_at,
    case when jsonb_typeof(d.data -> 'sessions') = 'array' then jsonb_array_length(d.data -> 'sessions') else 0 end,
    (select max(x.v ->> 'date')
       from jsonb_array_elements(case when jsonb_typeof(d.data -> 'sessions') = 'array' then d.data -> 'sessions' else '[]'::jsonb end) as x(v)),
    (select count(*)::int
       from jsonb_array_elements(case when jsonb_typeof(d.data -> 'sessions') = 'array' then d.data -> 'sessions' else '[]'::jsonb end) as x(v)
      where x.v ->> 'date' >= to_char(now() - interval '30 days', 'YYYY-MM-DD')),
    case when jsonb_typeof(d.data -> 'plan') = 'array' then jsonb_array_length(d.data -> 'plan') else 0 end,
    coalesce(d.data ? 'polar', false),
    exists (select 1 from public.admins a where a.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_data d on d.user_id = u.id
  where public.is_admin()
  order by d.updated_at desc nulls last, u.created_at desc;
$$;
revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

-- Datos de entreno de un usuario (lo mismo que ve un entrenador). Vacío si no eres administrador.
create or replace function public.admin_user_data(uid uuid)
returns table (data jsonb, updated_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select
    jsonb_strip_nulls(jsonb_build_object(
      'plan', u.data -> 'plan',
      'sessions', u.data -> 'sessions',
      'myExercises', u.data -> 'myExercises',
      'uniEx', u.data -> 'uniEx',
      'body', case when u.data ? 'body' then jsonb_build_object('weight', u.data -> 'body' -> 'weight', 'waist', u.data -> 'body' -> 'waist') end,
      'polar', case when u.data ? 'polar' then jsonb_build_object('lastSync', u.data -> 'polar' -> 'lastSync', 'exercises', u.data -> 'polar' -> 'exercises') end
    )) as data,
    u.updated_at
  from public.user_data u
  where u.user_id = uid
    and public.is_admin();
$$;
revoke all on function public.admin_user_data(uuid) from public;
grant execute on function public.admin_user_data(uuid) to authenticated;

-- Hacerte administrador: cambia el email por el de tu cuenta y ejecuta esta línea (una vez).
-- insert into public.admins (user_id) select id from auth.users where email = 'TU_EMAIL' on conflict do nothing;
