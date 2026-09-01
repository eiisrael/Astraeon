import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../src/character-system-v6.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/022_character_data_isolation.sql', import.meta.url), 'utf8');

assert.match(client, /:character:\$\{uid\}:\$\{id\}/, 'browser cache must be namespaced by user and character');
assert.match(client, /clearCharacterLocal\(c\.id,\{mirror:true\}\)/, 'fresh character must clear the shared legacy cache before start');
assert.match(client, /g\.startNew\(\);[\s\S]*g\.save\(\);[\s\S]*saveCharacterNow/, 'new character must serialize its fresh runtime before cloud persistence');
assert.match(client, /identityMismatch/, 'remote save identity mismatch must be detected');
assert.match(client, /delete save\.skillsV1/, 'legacy embedded skills must not be used as cloud authority');
assert.match(migration, /insert into public\.character_saves\(character_id,user_id,save_data,world_seed\)/, 'character creation must create a dedicated save row');
assert.match(migration, /display_name = coalesce\(fallback\.name/, 'deletion must synchronize fallback profile identity');
assert.match(migration, /'initialized',[\s\S]*false/, 'cross-character contamination must be marked for clean rebuild');
console.log('Character isolation contracts: OK');
