import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const game = fs.readFileSync(new URL('src/game-v2.js', root), 'utf8');
const world = fs.readFileSync(new URL('src/world-v2.js', root), 'utf8');
const orc = fs.readFileSync(new URL('Assets/Mob/Orc.png', root));

assert(/Orc:\s*\{\s*sprite:\s*'Orc\.png'/.test(world), 'o catálogo deve apontar para Orc.png');
assert(orc.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'Orc.png deve ser um PNG válido');
assert(game.includes('this.mobSpritePaths.get(m.type)'), 'mobs devem manter o caminho canônico do sprite');
assert(game.includes('img.onerror = () =>'), 'sprites devem recuperar falhas transitórias de carregamento');
assert(/drawPlayer\(ctx\)[\s\S]*?drawImage\(img, -24, -39, 48, 48\)[\s\S]*?arc\(0,-15,23\.5/.test(game), 'o contorno deve ser desenhado após o retrato e no mesmo centro visual');

console.log('ASTRAEON RENDER ASSETS V1 validation OK');
