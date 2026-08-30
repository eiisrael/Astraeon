import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

await import('../src/realtime-security-v1.js');
const RT=globalThis.AstraeonRealtimeSecurityV1;
assert.ok(RT,'realtime security module must initialize');

const user='10000000-0000-4000-8000-000000000001';
const base=1780000000000;

{
  const guard=RT.createGuard();
  const first=guard.accept('state',user,{seq:1,client_ts:base,x:100,y:100,facing:1},base);
  assert.equal(first.accepted,true);
  assert.equal(guard.accept('state',user,{seq:1,client_ts:base+1,x:101,y:100},base+1).reason,'stale_seq');
  assert.equal(guard.accept('state',user,{seq:2,client_ts:base-20000,x:101,y:100},base).reason,'invalid_timestamp');
  assert.equal(guard.accept('state',user,{seq:2,client_ts:base+6000,x:101,y:100},base).reason,'invalid_timestamp');
  assert.equal(guard.accept('state','fake-user',{seq:2,client_ts:base+2,x:101,y:100},base+2).reason,'invalid_identity');
}

{
  const guard=RT.createGuard();
  assert.equal(guard.accept('state',user,{seq:1,client_ts:base,x:0,y:0,facing:1},base).accepted,true);
  const moved=guard.accept('state',user,{seq:2,client_ts:base+100,x:10000,y:0,facing:1},base+100);
  assert.equal(moved.accepted,true);
  assert.equal(moved.clamped,true);
  assert.ok(moved.value.x<=149,'impossible movement must be clamped near the previous position');
}

{
  const guard=RT.createGuard({statePerSecond:15});
  for(let index=1;index<=15;index++){
    assert.equal(guard.accept('state',user,{seq:index,client_ts:base+index,x:10,y:10,facing:1},base+index).accepted,true);
  }
  assert.equal(guard.accept('state',user,{seq:16,client_ts:base+16,x:10,y:10,facing:1},base+16).reason,'rate_limited');
}

{
  const guard=RT.createGuard({actionPerSecond:12});
  for(let index=1;index<=12;index++){
    assert.equal(guard.accept('action',user,{seq:index,client_ts:base+index,action_type:'attack',action_index:0},base+index).accepted,true);
  }
  assert.equal(guard.accept('action',user,{seq:13,client_ts:base+13,action_type:'skill',action_index:2},base+13).reason,'rate_limited');
}

{
  const effects=[];
  for(let index=0;index<800;index++)RT.pushBoundedEffect(effects,{index},300);
  assert.equal(effects.length,300);
  assert.equal(effects[0].index,500);
}

{
  const profile=RT.publicProfile({user_id:user,username:'Trusted_1',display_name:'Viajante',class_id:'Mage',level:999999,is_admin:false});
  assert.equal(profile.username,'Trusted_1');
  assert.equal(profile.classId,'Mage');
  assert.equal(profile.level,999);
}

const files={
  hardening:await readFile(new URL('../supabase/migrations/011_security_hardening.sql',import.meta.url),'utf8'),
  profiles:await readFile(new URL('../supabase/migrations/012_public_profiles.sql',import.meta.url),'utf8'),
  admin:await readFile(new URL('../supabase/migrations/013_admin_pagination.sql',import.meta.url),'utf8'),
  realtime:await readFile(new URL('../supabase/migrations/014_realtime_hardening.sql',import.meta.url),'utf8'),
  progression:await readFile(new URL('../supabase/migrations/015_server_authoritative_progression.sql',import.meta.url),'utf8'),
  multiplayer:await readFile(new URL('../src/multiplayer-v4.js',import.meta.url),'utf8'),
  characters:await readFile(new URL('../src/character-system-v6.js',import.meta.url),'utf8'),
  adminClient:await readFile(new URL('../src/admin-character-slots-v6.js',import.meta.url),'utf8'),
  vercel:await readFile(new URL('../vercel.json',import.meta.url),'utf8')
};

for(const needle of [
  'character_id_is_immutable','user_id_is_immutable','astraeon_require_online_access',
  'grant update (save_data, world_seed, updated_at)','pg_advisory_xact_lock',
  'chat_rate_limited_window','astraeon_is_admin_mfa','validate_astraeon_save'
])assert.ok(files.hardening.includes(needle),`hardening contract missing: ${needle}`);
assert.ok(files.profiles.includes('astraeon_profiles_read_own'));
assert.ok(files.profiles.includes('resolve_public_astraeon_profiles'));
assert.ok(!files.profiles.includes('using (true)'),'profiles must not restore global table reads');
const listFunction=files.admin.slice(files.admin.indexOf('create or replace function public.admin_list_characters_v6'),files.admin.indexOf('create or replace function public.admin_get_character_v6'));
assert.ok(!listFunction.includes('save_data jsonb'),'paginated return type must not expose save_data');
assert.ok(!listFunction.includes('\n    cs.save_data,'),'paginated query must not select raw save_data');
assert.ok(files.admin.includes('page_limit integer default 24'));
assert.ok(files.admin.includes('admin_get_character_v6'));
assert.ok(files.realtime.includes("realtime.messages.extension = 'presence'"));
assert.ok(files.realtime.includes('public.astraeon_has_online_access()'));
assert.ok(files.realtime.includes('publish_astraeon_player_state'));
assert.ok(files.realtime.includes('publish_astraeon_player_action'));
assert.ok(files.progression.includes('revoke all on public.character_progress'));
assert.ok(files.progression.includes('grant execute on function public.award_astraeon_xp(uuid,bigint,uuid) to service_role'));
assert.ok(files.progression.includes('select c.id, c.user_id, 0, c.level, 0'),'authoritative balances must not bootstrap from client save JSON');
assert.ok(!files.progression.includes("cs.save_data -> 'gold'"),'authoritative gold must not trust legacy save JSON');
assert.ok(files.multiplayer.includes('active_character_id'));
assert.ok(files.multiplayer.includes('resolve_public_astraeon_profiles'));
assert.ok(files.multiplayer.includes('publish_astraeon_player_state'));
assert.ok(!files.multiplayer.includes('cdn.jsdelivr.net'));
assert.ok(!files.characters.includes('active_character_id:state.activeCharacterId'));
assert.ok(files.characters.includes('save update'));
assert.ok(files.adminClient.includes('admin_get_character_v6'));
assert.ok(!files.vercel.includes('cdn.jsdelivr.net'));

console.log('ASTRAEON SECURITY CONTRACTS OK');
