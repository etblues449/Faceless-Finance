import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaptions, LIMITS } from '../src/captions.js';

const disclaimer = 'EDU ONLY. Not advice. Capital at risk.';
// hashtags arrive already normalised (parseScriptJson does that upstream).
const script = {
  title: 'How the ISA allowance works in 2025/26',
  caption: 'The £20k ISA allowance resets every April — here is what that means.',
  hashtags: ['#UKtax', '#ISA', '#SIPP'],
};

test('appends disclaimer and hashtags to every platform caption', () => {
  const c = buildCaptions({ script, disclaimer });
  for (const platform of ['tiktok', 'youtube', 'instagram']) {
    assert.ok(c[platform].caption.includes(disclaimer), `${platform} missing disclaimer`);
    assert.ok(c[platform].caption.includes('#UKtax'));
    assert.ok(c[platform].caption.includes('#SIPP'));
  }
});

test('only youtube gets a title, clipped to 100 chars', () => {
  const longTitle = 'x'.repeat(200);
  const c = buildCaptions({ script: { ...script, title: longTitle }, disclaimer });
  assert.equal(c.youtube.title.length, LIMITS.youtube.title);
  assert.equal(c.tiktok.title, undefined);
  assert.equal(c.instagram.title, undefined);
});

test('caption is clipped to the platform limit with an ellipsis', () => {
  const big = 'y'.repeat(5000);
  const c = buildCaptions({ script: { ...script, caption: big }, disclaimer });
  assert.ok(c.tiktok.caption.length <= LIMITS.tiktok.caption);
  assert.ok(c.tiktok.caption.endsWith('…'));
});

test('hashtags passed through already-normalised survive', () => {
  const c = buildCaptions({ script: { ...script, hashtags: ['#a', '#b'] }, disclaimer });
  assert.ok(c.tiktok.caption.includes('#a #b'));
});
