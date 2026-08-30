import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

await import('../src/realtime-security-v1.js');
globalThis.window=globalThis;
await import('../src/admin-mfa-v1.js');
const progressionAuthority=await import('../api/progression-authority.js');
const {normalizeProgressionEvent}=progressionAuthority;
const RT=globalThis.AstraeonRealtimeSecurityV1;
assert.ok(RT,'realtime security module must initialize');
const MFA=globalThis.AstraeonAdminMfaV1;
assert.ok(MFA,'admin MFA helper must initialize');

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

{
  const mfaClient={auth:{mfa:{
    getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal2'},error:null}),
    listFactors:async()=>({data:{all:[{id:'factor-a',status:'verified',factor_type:'totp',friendly_name:'Admin'}]},error:null}),
    challenge:async({factorId})=>({data:{id:`challenge-${factorId}`},error:null}),
    verify:async({factorId,challengeId,code})=>({data:{factorId,challengeId,code},error:null})
  }}};
  const inspection=await MFA.inspect(mfaClient);
  assert.equal(inspection.state,'challenge','aal1 session with verified factor must require a challenge');
  await assert.rejects(()=>MFA.verifyCode(mfaClient,'factor-a','abc123'),/seis dígitos/);
  const verified=await MFA.verifyCode(mfaClient,'factor-a','123456');
  assert.equal(verified.code,'123456','MFA verification must send the six-digit code only after a challenge');
}

{
  const xp=normalizeProgressionEvent({kind:'award_xp',characterId:user,operationId:'50000000-0000-4000-8000-000000000005',amount:35});
  assert.equal(xp.event_kind,'award_xp');
  assert.equal(xp.event_amount,35);
  const drop=normalizeProgressionEvent({kind:'grant_drop',characterId:user,operationId:'60000000-0000-4000-8000-000000000006',itemId:'potion_minor',quantity:2,metadata:{source:'mob'}});
  assert.equal(drop.event_item,'potion_minor');
  assert.throws(()=>normalizeProgressionEvent({kind:'award_xp',characterId:user,operationId:'not-a-uuid',amount:1}),/invalid_identifier/);
  assert.throws(()=>normalizeProgressionEvent({kind:'grant_drop',characterId:user,operationId:'60000000-0000-4000-8000-000000000006',itemId:'potion_minor',quantity:0}),/invalid_quantity/);
}

{
  const previousEnvironment=process.env.VERCEL_ENV;
  process.env.VERCEL_ENV='preview';
  const response={statusCode:0,body:null,setHeader(){return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await progressionAuthority.default({method:'POST',headers:{},body:{}},response);
  assert.equal(response.statusCode,404,'progression authority must stay unavailable in Preview');
  assert.equal(response.body.error,'not_found');
  if(previousEnvironment===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previousEnvironment;
}

const files={
  hardening:await readFile(new URL('../supabase/migrations/011_security_hardening.sql',import.meta.url),'utf8'),
  profiles:await readFile(new URL('../supabase/migrations/012_public_profiles.sql',import.meta.url),'utf8'),
  admin:await readFile(new URL('../supabase/migrations/013_admin_pagination.sql',import.meta.url),'utf8'),
  realtime:await readFile(new URL('../supabase/migrations/014_realtime_hardening.sql',import.meta.url),'utf8'),
  progression:await readFile(new URL('../supabase/migrations/015_server_authoritative_progression.sql',import.meta.url),'utf8'),
  authority:await readFile(new URL('../supabase/migrations/016_progression_authority_gateway.sql',import.meta.url),'utf8'),
  reconciliation:await readFile(new URL('../supabase/migrations/017_progression_idempotency_and_reconciliation.sql',import.meta.url),'utf8'),
  multiplayer:await readFile(new URL('../src/multiplayer-v4.js',import.meta.url),'utf8'),
  characters:await readFile(new URL('../src/character-system-v6.js',import.meta.url),'utf8'),
  adminClient:await readFile(new URL('../src/admin-character-slots-v6.js',import.meta.url),'utf8'),
  adminAuth:await readFile(new URL('../src/admin-auth-v4.js',import.meta.url),'utf8'),
  authorityApi:await readFile(new URL('../api/progression-authority.js',import.meta.url),'utf8'),
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
assert.ok(files.authority.includes('apply_astraeon_progression_event'));
assert.ok(files.authority.includes("event_kind not in ('award_xp', 'grant_drop')"));
assert.ok(files.authority.includes('to service_role'));
assert.ok(files.reconciliation.includes('bootstrap_astraeon_character_progress'));
assert.ok(files.reconciliation.includes('operation_id_conflict'));
assert.ok(files.reconciliation.includes('reconcile_astraeon_progression'));
assert.ok(files.multiplayer.includes('active_character_id'));
assert.ok(files.multiplayer.includes('resolve_public_astraeon_profiles'));
assert.ok(files.multiplayer.includes('publish_astraeon_player_state'));
assert.ok(!files.multiplayer.includes('cdn.jsdelivr.net'));
assert.ok(!files.characters.includes('active_character_id:state.activeCharacterId'));
assert.ok(files.characters.includes('save update'));
assert.ok(files.adminClient.includes('admin_get_character_v6'));
assert.ok(files.adminAuth.includes('AstraeonAdminMfaV1'));
assert.ok(files.adminAuth.includes('MFA · AAL2'));
assert.ok(files.authorityApi.includes('timingSafeEqual'));
assert.ok(files.authorityApi.includes('ASTRAEON_AUTHORITY_TOKEN'));
assert.ok(files.authorityApi.includes('ASTRAEON_AUTHORITY_ALLOW_NONPRODUCTION'));
assert.ok(!files.authorityApi.includes('SUPABASE_PUBLISHABLE_KEY'),'authority endpoint must not use a browser key');
assert.ok(!files.vercel.includes('cdn.jsdelivr.net'));

console.log('ASTRAEON SECURITY CONTRACTS OK');
