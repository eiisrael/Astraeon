begin;

update public.item_configs
set name = 'Núcleo de Astraeon'
where item_id = 'astral_core'
  and name is distinct from 'Núcleo de Astraeon';

update public.system_messages
set body = 'Você entrou no mundo online de Astraeon.'
where kind = 'on_join'
  and body is distinct from 'Você entrou no mundo online de Astraeon.';

update public.world_places
set name = 'Astraeon'
where place_id in ('continent_astra', 'continent_astraeon')
  and name is distinct from 'Astraeon';

commit;
