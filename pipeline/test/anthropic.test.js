import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScriptJson, createScriptWriter, buildSystemPrompt } from '../src/anthropic.js';

const valid = {
  hook: 'Your ISA resets in April.',
  script: 'Your ISA allowance resets every April and any unused part is gone for good.',
  title: 'ISA allowance 2025/26',
  caption: 'Use it or lose it.',
  hashtags: ['#ISA', 'UKtax'],
};

test('parses clean JSON and normalises hashtags with leading #', () => {
  const out = parseScriptJson(JSON.stringify(valid));
  assert.equal(out.hashtags[0], '#ISA');
  assert.equal(out.hashtags[1], '#UKtax');
});

test('extracts JSON from a ```json fenced block', () => {
  const out = parseScriptJson('Sure!\n```json\n' + JSON.stringify(valid) + '\n```\n');
  assert.equal(out.title, valid.title);
});

test('extracts JSON when wrapped in prose without fences', () => {
  const out = parseScriptJson('Here you go: ' + JSON.stringify(valid) + ' Hope that helps!');
  assert.equal(out.hook, valid.hook);
});

test('throws on missing required field', () => {
  const bad = { ...valid };
  delete bad.script;
  assert.throws(() => parseScriptJson(JSON.stringify(bad)), /missing\/empty string field: script/);
});

test('throws when no JSON object present', () => {
  assert.throws(() => parseScriptJson('no json here'), /did not return JSON/);
});

test('system prompt encodes compliance + tone', () => {
  const sp = buildSystemPrompt({ tonePreset: { label: 'Neutral', style: 'clear and balanced' } });
  assert.match(sp, /EDUCATION, NOT ADVICE/);
  assert.match(sp, /2025\/26/);
  assert.match(sp, /Neutral/);
  assert.match(sp, /STRICT JSON/);
});

test('createScriptWriter sends correct headers/body and returns parsed script', async () => {
  let captured;
  const http = {
    postJson: async (url, body, opts) => {
      captured = { url, body, opts };
      return { content: [{ type: 'text', text: JSON.stringify(valid) }] };
    },
  };
  const config = {
    tonePreset: { label: 'Neutral', style: 's' },
    anthropic: { apiKey: () => 'sk-test', model: 'claude-x', baseUrl: 'https://api.anthropic.com' },
  };
  const writer = createScriptWriter({ config, http });
  const out = await writer.generate('ISAs');
  assert.match(captured.url, /\/v1\/messages$/);
  assert.equal(captured.opts.headers['x-api-key'], 'sk-test');
  assert.equal(captured.opts.headers['anthropic-version'], '2023-06-01');
  assert.equal(captured.body.model, 'claude-x');
  assert.equal(out.title, valid.title);
});
