-- MI-GYM 2.0: privacidad del alumno y borrado de cuenta.
-- Pegar entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.
-- Necesita haber ejecutado antes schema.sql y 02-entrenadores.sql.

-- 1) El entrenador solo recibe lo que necesita del alumno (plan, entrenos, cuerpo, pulso del reloj y ejercicios propios).
--    Dieta, objetivos de kcal, sueño, avisos y preferencias se quedan fuera.
create or replace function public.student_data(uid uuid)
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
    and exists (
      select 1 from public.coach_links l
      where l.trainer_id = auth.uid() and l.user_id = uid and l.status = 'accepted'
    );
$$;
revoke all on function public.student_data(uuid) from public;
grant execute on function public.student_data(uuid) to authenticated;

-- La lectura directa de user_data por el entrenador deja de hacer falta (mínimo privilegio).
drop policy if exists "entrenador lee a sus alumnos" on public.user_data;

-- 2) Borrar mi cuenta (datos, perfil, relaciones y el usuario de Auth). Lo llama la app desde Ajustes.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;
  delete from public.user_data where user_id = uid;
  delete from public.coach_links where user_id = uid or trainer_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
