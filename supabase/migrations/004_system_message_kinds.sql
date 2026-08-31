-- ASTRAEON ONLINE 4.4 — system message kinds
-- Execute after 003_system_messages.sql.

alter table public.system_messages
  add column if not exists message_kind text not null default 'periodic';

alter table public.system_messages
  drop constraint if exists system_messages_message_kind_check;

alter table public.system_messages
  add constraint system_messages_message_kind_check
  check (message_kind in ('periodic','on_join'));

create index if not exists system_messages_kind_enabled_idx
  on public.system_messages(message_kind, enabled, sort_order, id);

comment on column public.system_messages.message_kind is
  'periodic = scheduled chat message; on_join = shown once when the player enters the online world.';

insert into public.system_messages(body, interval_minutes, enabled, sort_order, message_kind)
select 'Você entrou no mundo online de Astraeon.', 10, true, 0, 'on_join'
where not exists (
  select 1
  from public.system_messages
  where message_kind = 'on_join'
    and body = 'Você entrou no mundo online de Astraeon.'
);
