import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync(new URL('../src/game-v2.js', import.meta.url), 'utf8');

assert.match(game, /const TERRAIN_CHUNK_TILES = 12/, 'O terreno detalhado deve ser cacheado em blocos pequenos.');
assert.match(game, /terrainVisualCache = \{ world: null, chunks: new Map\(\) \}/, 'O cache visual deve ser isolado por mundo.');
assert.match(game, /drawTerrainTexture\(ctx, tile, biome, x, y, size\)/, 'O terreno deve possuir textura e relevo determinísticos.');
assert.match(game, /drawShoreline\(ctx, tile, x, y, size, style\)/, 'Água e terreno devem possuir transição de margem.');
assert.match(game, /performance\.now\(\) \* \.0014/, 'Somente a superfície da água deve receber animação temporal.');
assert.match(game, /createRadialGradient\(cx-5,baseY-31/, 'Copas de árvores devem receber volume por iluminação radial.');
assert.match(game, /tile\.object === 'crystal'[\s\S]*shadowBlur=10/, 'Cristais devem manter brilho volumétrico próprio.');
assert.match(game, /for \(let cy=chunkStartY;cy<chunkEndY;cy\+\+\)/, 'O frame deve desenhar chunks cacheados, não reconstruir todo o chão.');
assert.doesNotMatch(game, /setInterval\([^)]*drawTerrain/, 'O aprimoramento do mapa não pode criar polling de renderização.');

console.log('ASTRAEON MAP VISUALS V1 terrain, water, relief and objects validation OK');
