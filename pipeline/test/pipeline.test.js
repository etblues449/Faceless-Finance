import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPipeline, defaultOutDir } from '../src/pipeline.js';
import { createLogger } from '../src/logger.js';

const silent = createLogger('error');

function makeFs() {
  const writes = {};
  const dirs = [];
  return {
    writes,
    dirs,
    mkdir: async (d) => dirs.push(d),
    writeFile: async (p, data) => {
      writes[p] = data;
    },
  };
}

const script = {
  hook: 'h',
  script: 'spoken words',
  title: 't',
  caption: 'c',
  hashtags: ['#a'],
};

function makeConfig({ postizEnabled = true } = {}) {
  return {
    aspect: '9:16',
    compliance: { disclaimer: 'D' },
    postiz: { enabled: postizEnabled },
  };
}

test('dry-run stops before voice/video/publish and writes script + captions', async () => {
  const fs = makeFs();
  const deps = {
    scriptWriter: { generate: async () => script },
    voice: { synthesize: async () => assert.fail('should not synthesise in dry-run') },
    heygen: { renderTalkingVideo: async () => assert.fail('should not render in dry-run') },
    postiz: { uploadAndPublish: async () => assert.fail('should not publish in dry-run') },
    fs,
  };
  const pipeline = createPipeline({ config: makeConfig(), deps, logger: silent });
  const out = await pipeline.runOne({ topic: 'ISAs', dryRun: true, outDir: 'out/x' });
  assert.equal(out.dryRun, true);
  assert.ok(fs.writes['out/x/script.json']);
  assert.ok(fs.writes['out/x/captions.json']);
  assert.equal(fs.writes['out/x/voiceover.mp3'], undefined);
});

test('full run synthesises, renders, writes artifacts, and publishes', async () => {
  const fs = makeFs();
  const calls = [];
  const deps = {
    scriptWriter: { generate: async (t) => (calls.push(['script', t]), script) },
    voice: { synthesize: async (text) => (calls.push(['voice', text]), { bytes: Buffer.from('a'.repeat(2000)), contentType: 'audio/mpeg', filename: 'voiceover.mp3' }) },
    heygen: {
      renderTalkingVideo: async ({ audio }) => {
        calls.push(['heygen', audio.filename]);
        return { videoId: 'v1', videoUrl: 'https://v/out.mp4', bytes: Buffer.from('m'.repeat(20000)), contentType: 'video/mp4', filename: 'video.mp4' };
      },
    },
    postiz: {
      uploadAndPublish: async ({ captions, video }) => {
        calls.push(['postiz', video.filename, Object.keys(captions)]);
        return { media: { id: 'm1' }, result: { ok: true } };
      },
    },
    fs,
  };
  const pipeline = createPipeline({ config: makeConfig(), deps, logger: silent });
  const out = await pipeline.runOne({ topic: 'ISAs', outDir: 'out/y' });

  assert.equal(out.published, true);
  assert.equal(out.video.id, 'v1');
  assert.deepEqual(calls.map((c) => c[0]), ['script', 'voice', 'heygen', 'postiz']);
  assert.equal(calls[1][1], 'spoken words'); // voice got the spoken script, not the hook
  assert.ok(fs.writes['out/y/voiceover.mp3']);
  assert.ok(fs.writes['out/y/video.mp4']);
  assert.ok(fs.writes['out/y/publish.json']);
});

test('publish skipped when postiz disabled', async () => {
  const fs = makeFs();
  const deps = {
    scriptWriter: { generate: async () => script },
    voice: { synthesize: async () => ({ bytes: Buffer.from('a'.repeat(2000)), contentType: 'audio/mpeg', filename: 'voiceover.mp3' }) },
    heygen: { renderTalkingVideo: async () => ({ videoId: 'v1', videoUrl: 'u', bytes: Buffer.from('m'.repeat(20000)), contentType: 'video/mp4', filename: 'video.mp4' }) },
    postiz: { uploadAndPublish: async () => assert.fail('should not publish when disabled') },
    fs,
  };
  const pipeline = createPipeline({ config: makeConfig({ postizEnabled: false }), deps, logger: silent });
  const out = await pipeline.runOne({ topic: 'ISAs', outDir: 'out/z' });
  assert.equal(out.published, false);
});

test('runOne rejects an empty topic', async () => {
  const pipeline = createPipeline({ config: makeConfig(), deps: { fs: makeFs() }, logger: silent });
  await assert.rejects(() => pipeline.runOne({ topic: '   ' }), /non-empty topic/);
});

test('defaultOutDir slugifies the topic', () => {
  const d = defaultOutDir('How the ISA allowance works!');
  assert.match(d, /how-the-isa-allowance-works/);
  assert.match(d, /^output\//);
});
