import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPostiz, parseIntegrations } from '../src/postiz.js';

function config(ids) {
  return {
    postiz: {
      apiKey: () => 'pk',
      baseUrl: () => 'https://postiz.example.com/',
      integrationIds: () => ids,
    },
  };
}

const captions = {
  tiktok: { caption: 'tt caption #x\n\nDISCLAIMER' },
  youtube: { title: 'YT Title', caption: 'yt caption #x\n\nDISCLAIMER' },
  instagram: { caption: 'ig caption #x\n\nDISCLAIMER' },
};

test('parseIntegrations handles bare ids and id:platform', () => {
  const out = parseIntegrations(['abc', 'def:youtube', 'ghi:instagram']);
  assert.deepEqual(out, [
    { id: 'abc', platform: undefined },
    { id: 'def', platform: 'youtube' },
    { id: 'ghi', platform: 'instagram' },
  ]);
});

test('buildPayload picks the per-platform caption + youtube title and attaches media', () => {
  const p = createPostiz({ config: config(['t1:tiktok', 'y1:youtube']), http: {} });
  const payload = p.buildPayload({ captions, media: { id: 'm1' } });
  assert.equal(payload.type, 'now');
  assert.equal(payload.posts.length, 2);
  const yt = payload.posts.find((x) => x.integration.id === 'y1');
  assert.match(yt.value[0].content, /yt caption/);
  assert.deepEqual(yt.settings, { __type: 'youtube', title: 'YT Title' });
  assert.deepEqual(yt.value[0].image, [{ id: 'm1' }]);
  const tt = payload.posts.find((x) => x.integration.id === 't1');
  assert.match(tt.value[0].content, /tt caption/);
  assert.deepEqual(tt.settings, { __type: 'tiktok' });
});

test('buildPayload sets a date even for immediate (now) posts', () => {
  const p = createPostiz({ config: config(['t1:tiktok']), http: {} });
  const payload = p.buildPayload({ captions, media: { id: 'm1' } });
  assert.equal(payload.type, 'now');
  assert.match(payload.date, /^\d{4}-\d{2}-\d{2}T/);
});

test('buildPayload includes media path in the image when present', () => {
  const p = createPostiz({ config: config(['t1:tiktok']), http: {} });
  const payload = p.buildPayload({ captions, media: { id: 'm1', path: 'https://u/m1.mp4' } });
  assert.deepEqual(payload.posts[0].value[0].image, [{ id: 'm1', path: 'https://u/m1.mp4' }]);
});

test('buildPayload schedules when a date is given', () => {
  const p = createPostiz({ config: config(['t1:tiktok']), http: {} });
  const payload = p.buildPayload({ captions, media: { id: 'm1' }, when: { date: '2026-06-01T09:00:00Z' } });
  assert.equal(payload.type, 'schedule');
  assert.equal(payload.date, '2026-06-01T09:00:00Z');
});

test('buildPayload falls back to tiktok caption for unknown platform', () => {
  const p = createPostiz({ config: config(['x1']), http: {} });
  const payload = p.buildPayload({ captions, media: { id: 'm1' } });
  assert.match(payload.posts[0].value[0].content, /tt caption/);
});

test('uploadMedia returns id from various response shapes', async () => {
  const http = { request: async () => ({ id: 'media9', path: '/u/media9.mp4' }) };
  const p = createPostiz({ config: config(['t1']), http });
  const out = await p.uploadMedia({ bytes: Buffer.from('x'), contentType: 'video/mp4', filename: 'v.mp4' });
  assert.equal(out.id, 'media9');
});
