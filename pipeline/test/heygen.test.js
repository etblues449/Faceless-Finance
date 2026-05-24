import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeygen, aspectToDimension } from '../src/heygen.js';

function baseConfig(overrides = {}) {
  return {
    aspect: '9:16',
    heygen: {
      apiKey: () => 'hg-key',
      avatarId: () => 'elliot-v',
      avatarStyle: 'normal',
      apiBase: 'https://api.heygen.com',
      uploadBase: 'https://upload.heygen.com',
      pollIntervalMs: 1,
      pollTimeoutMs: 1000,
      ...overrides,
    },
  };
}

test('aspectToDimension maps 9:16 to portrait', () => {
  assert.deepEqual(aspectToDimension('9:16'), { width: 720, height: 1280 });
});

test('aspectToDimension maps 16:9 to landscape', () => {
  const d = aspectToDimension('16:9');
  assert.equal(d.height, 720);
  assert.equal(d.width, 1280);
});

test('uploadAudio posts bytes and returns the asset url', async () => {
  let captured;
  const http = {
    request: async (url, opts) => {
      captured = { url, opts };
      return { data: { id: 'asset1', url: 'https://cdn.heygen/asset1.mp3' } };
    },
  };
  const hg = createHeygen({ config: baseConfig(), http });
  const out = await hg.uploadAudio({ bytes: Buffer.from('x'), contentType: 'audio/mpeg' });
  assert.equal(out.audioUrl, 'https://cdn.heygen/asset1.mp3');
  assert.equal(captured.opts.headers['X-Api-Key'], 'hg-key');
  assert.match(captured.url, /\/v1\/asset$/);
});

test('generate sends avatar + audio voice input and returns video_id', async () => {
  let body;
  const http = {
    postJson: async (url, b) => {
      body = b;
      return { data: { video_id: 'vid123' } };
    },
  };
  const hg = createHeygen({ config: baseConfig(), http });
  const out = await hg.generate({ audioUrl: 'https://a/audio.mp3' });
  assert.equal(out.videoId, 'vid123');
  assert.equal(body.video_inputs[0].character.avatar_id, 'elliot-v');
  assert.equal(body.video_inputs[0].voice.type, 'audio');
  assert.equal(body.video_inputs[0].voice.audio_url, 'https://a/audio.mp3');
  assert.deepEqual(body.dimension, { width: 720, height: 1280 });
});

test('generate uses a talking_photo character when configured', async () => {
  let body;
  const http = {
    postJson: async (url, b) => {
      body = b;
      return { data: { video_id: 'vid456' } };
    },
  };
  const hg = createHeygen({ config: baseConfig({ characterType: 'talking_photo' }), http });
  await hg.generate({ audioUrl: 'https://a/audio.mp3' });
  assert.equal(body.video_inputs[0].character.type, 'talking_photo');
  assert.equal(body.video_inputs[0].character.talking_photo_id, 'elliot-v');
  assert.equal(body.video_inputs[0].character.avatar_id, undefined);
});

test('waitForCompletion polls through processing then completed', async () => {
  const states = ['processing', 'processing', 'completed'];
  let i = 0;
  const http = {
    getJson: async () => {
      const status = states[Math.min(i++, states.length - 1)];
      return { data: { status, video_url: status === 'completed' ? 'https://v/out.mp4' : undefined } };
    },
  };
  const hg = createHeygen({ config: baseConfig(), http });
  const out = await hg.waitForCompletion('vid123', { sleepFn: async () => {} });
  assert.equal(out.videoUrl, 'https://v/out.mp4');
  assert.equal(i, 3);
});

test('waitForCompletion throws on failed', async () => {
  const http = { getJson: async () => ({ data: { status: 'failed', error: { code: 'x' } } }) };
  const hg = createHeygen({ config: baseConfig(), http });
  await assert.rejects(() => hg.waitForCompletion('v', { sleepFn: async () => {} }), /render failed/);
});

test('waitForCompletion times out', async () => {
  const http = { getJson: async () => ({ data: { status: 'processing' } }) };
  const hg = createHeygen({ config: baseConfig({ pollTimeoutMs: 5 }), http });
  await assert.rejects(() => hg.waitForCompletion('v', { sleepFn: async () => {} }), /timed out/);
});
