-- ASTRAEON INVENTORY 4.3 — slots do layout padrão do player
-- Mantém compatibilidade com os slots existentes e libera os novos espaços
-- do painel: Pet, Manto, Arma 2/Escudo, Calça e Colar.

alter table public.item_configs
  drop constraint if exists item_configs_slot_check;

alter table public.item_configs
  add constraint item_configs_slot_check
  check (
    slot is null or slot in (
      'pet',
      'head',
      'cloak',
      'weapon',
      'chest',
      'offhand',
      'hands',
      'legs',
      'boots',
      'necklace',
      'relic',
      'ring',
      'amulet'
    )
  );

-- O Manto do Caminhante ocupava o peitoral no catálogo anterior.
-- A partir do layout 4.3 ele usa o slot visual próprio de Manto.
update public.item_configs
set slot = 'cloak'
where item_id = 'wanderer_cloak'
  and slot = 'chest';
