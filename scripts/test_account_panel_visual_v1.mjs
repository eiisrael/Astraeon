import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const markup = readFileSync(new URL('../src/multiplayer-v4.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/online-v4.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const functionalHooks = [
  'onlineAccountPanel',
  'onlineAccountClose',
  'onlineAuthGuest',
  'onlineLoginForm',
  'onlineLoginEmail',
  'onlineLoginPassword',
  'onlineRegisterForm',
  'onlineRegisterUsername',
  'onlineRegisterEmail',
  'onlineRegisterPassword',
  'onlineAuthMember',
  'onlineProfileAvatar',
  'onlineProfileName',
  'onlineProfileEmail',
  'onlineCloudPush',
  'onlineCloudPull',
  'onlineLogout',
  'onlineAuthMessage',
];

for (const hook of functionalHooks) {
  assert.ok(markup.includes(hook), `account hook missing: ${hook}`);
}

assert.ok(markup.includes('data-online-auth="login"'), 'login tab hook missing');
assert.ok(markup.includes('data-online-auth="register"'), 'register tab hook missing');
assert.match(styles, /#onlineAccountPanel \.online-account-card\{/);
assert.match(styles, /overflow:hidden!important/);
assert.match(styles, /@media\(max-width:760px\)/);
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
assert.ok(index.includes('src/online-v4.css?v=4.5.0'), 'account stylesheet cache version not updated');

console.log('Account panel visual contract: OK');
