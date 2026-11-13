-- Mi Gym: perfil. Pegar en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.
-- "Sobre mí" del entrenador (lo ven los usuarios en la lista de entrenadores)
alter table public.profiles add column if not exists bio text;
