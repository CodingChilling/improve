-- Ascenso · modo en línea · esquema inicial
--
-- Se ejecuta una vez en el proyecto de Supabase: panel → SQL Editor → pegar todo → Run.
-- Se puede volver a ejecutar sin peligro (no borra datos).
--
-- Todo el contenido llega ya cifrado desde el dispositivo: aquí solo hay texto cifrado, etiquetas opacas
-- y lo mínimo para repartirlo (de quién es, en qué orden llegó y desde qué dispositivo).
-- Cada persona solo puede ver y añadir sus propias filas (RLS).

-- ---------------------------------------------------------------- perfiles: la clave de datos, envuelta
create table if not exists public.perfiles (
  user_id                      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  clave_envuelta               text not null,   -- clave de datos cifrada con la clave derivada de la contraseña
  clave_envuelta_anterior      text,            -- la anterior, mientras se completa un cambio de contraseña
  clave_recuperacion_envuelta  text not null,   -- clave de datos cifrada con la clave de recuperación
  version_cifrado              integer not null default 1,
  creado                       timestamptz not null default now(),
  constraint perfiles_tamano check (length(clave_envuelta) < 1000 and length(clave_recuperacion_envuelta) < 1000
                                    and (clave_envuelta_anterior is null or length(clave_envuelta_anterior) < 1000))
);

-- ---------------------------------------------------------------- cambios: una fila por cada versión de un registro
create table if not exists public.cambios (
  seq          bigserial primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dispositivo  text not null,                   -- identificador al azar del dispositivo que lo envió
  registro     text not null,                   -- HMAC(clave de datos, tabla:id): no revela ni la tabla ni el id
  datos        text not null,                   -- AES-256-GCM de {tabla, id, actualizado, borrado, valores}
  creado       timestamptz not null default now(),
  constraint cambios_tamano check (length(dispositivo) <= 40 and length(registro) <= 64 and length(datos) <= 8000000)
);
create index if not exists cambios_por_usuario on public.cambios (user_id, seq);
create index if not exists cambios_por_registro on public.cambios (user_id, registro, seq);

-- El número de orden (seq) se da con las inserciones de cada persona puestas en fila: así, quien pide
-- «los cambios posteriores al último que tengo» nunca se salta uno que se estuviera guardando a la vez.
-- De paso, el dueño de la fila es siempre quien la inserta.
create or replace function public.cambios_antes_de_insertar() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.user_id := auth.uid();
  new.creado := now();
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  new.seq := nextval('public.cambios_seq_seq'::regclass);
  return new;
end $$;
drop trigger if exists cambios_antes_de_insertar on public.cambios;
create trigger cambios_antes_de_insertar before insert on public.cambios
  for each row execute function public.cambios_antes_de_insertar();

-- ---------------------------------------------------------------- dispositivos: la lista que se ve en «Cuenta»
create table if not exists public.dispositivos (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dispositivo  text not null,
  nombre       text not null,                   -- cifrado, como todo lo demás
  creado       timestamptz not null default now(),
  visto        timestamptz not null default now(),
  primary key (user_id, dispositivo),
  constraint dispositivos_tamano check (length(dispositivo) <= 40 and length(nombre) <= 1000)
);

-- ---------------------------------------------------------------- permisos y RLS
alter table public.perfiles     enable row level security;
alter table public.cambios      enable row level security;
alter table public.dispositivos enable row level security;

-- Sin sesión no se puede nada
revoke all on public.perfiles, public.cambios, public.dispositivos from anon;
revoke all on public.perfiles, public.cambios, public.dispositivos from authenticated;
grant select, insert on public.perfiles to authenticated;
grant update (clave_envuelta, clave_envuelta_anterior, clave_recuperacion_envuelta, version_cifrado) on public.perfiles to authenticated;
-- Los cambios solo se leen y se añaden: nunca se modifican ni se borran desde un dispositivo
grant select, insert on public.cambios to authenticated;
grant usage, select on sequence public.cambios_seq_seq to authenticated;
grant select, insert, update, delete on public.dispositivos to authenticated;

drop policy if exists perfiles_ver on public.perfiles;
drop policy if exists perfiles_crear on public.perfiles;
drop policy if exists perfiles_cambiar on public.perfiles;
create policy perfiles_ver     on public.perfiles for select to authenticated using ((select auth.uid()) = user_id);
create policy perfiles_crear   on public.perfiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy perfiles_cambiar on public.perfiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists cambios_ver on public.cambios;
drop policy if exists cambios_crear on public.cambios;
create policy cambios_ver   on public.cambios for select to authenticated using ((select auth.uid()) = user_id);
create policy cambios_crear on public.cambios for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists dispositivos_ver on public.dispositivos;
drop policy if exists dispositivos_crear on public.dispositivos;
drop policy if exists dispositivos_cambiar on public.dispositivos;
drop policy if exists dispositivos_quitar on public.dispositivos;
create policy dispositivos_ver     on public.dispositivos for select to authenticated using ((select auth.uid()) = user_id);
create policy dispositivos_crear   on public.dispositivos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy dispositivos_cambiar on public.dispositivos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy dispositivos_quitar  on public.dispositivos for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- Realtime: aviso de cambios nuevos
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cambios') then
    alter publication supabase_realtime add table public.cambios;
  end if;
end $$;

-- ---------------------------------------------------------------- Storage: imágenes de las libretas y libros (cifrados)
-- Cada archivo va en <user_id>/<etiqueta opaca>. El bucket es privado y con un tope de 16 MB por archivo
-- (los libros más grandes se quedan en el dispositivo donde se añadieron).
insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 16777216)
on conflict (id) do update set public = false, file_size_limit = 16777216;

drop policy if exists adjuntos_ver on storage.objects;
drop policy if exists adjuntos_subir on storage.objects;
drop policy if exists adjuntos_quitar on storage.objects;
create policy adjuntos_ver    on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy adjuntos_subir  on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy adjuntos_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- opcional: compactar el historial de cambios
-- Con el tiempo, «cambios» acumula versiones antiguas de cada registro. Esta función deja solo la última de
-- cada uno, y únicamente borra versiones con más de 30 días (margen para que todos los dispositivos se pongan
-- al día). No se ejecuta sola. Para programarla una vez por semana (extensión pg_cron, en Database → Extensions):
--
--   select cron.schedule('ascenso-compactar', '0 4 * * 0', 'select public.compactar_cambios()');
--
-- El servidor no puede saber qué versión «vale» (la fecha de cada cambio va cifrada): se queda con la última
-- que llegó. Los dispositivos lo tienen en cuenta: si reciben una versión más antigua que la suya, vuelven a
-- enviar la suya, de modo que la última en llegar es siempre la que vale.
create or replace function public.compactar_cambios() returns bigint
language sql security definer set search_path = '' as $$
  with borradas as (
    delete from public.cambios c
    where c.creado < now() - interval '30 days'
      and exists (select 1 from public.cambios n where n.user_id = c.user_id and n.registro = c.registro and n.seq > c.seq)
    returning 1
  )
  select count(*) from borradas;
$$;
revoke all on function public.compactar_cambios() from public, anon, authenticated;
