#!/usr/bin/env node
// CLI entry point. Commands:
//   run   --topic "..." [--schedule <ISO>] [--dry-run] [--out <dir>]
//   ideas [--count N] [--theme "..."]
// Wires config + http + provider clients into the pipeline.

import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createHttp } from './http.js';
import { createScriptWriter } from './anthropic.js';
import { createVoice } from './elevenlabs.js';
import { createHeygen } from './heygen.js';
import { createPostiz } from './postiz.js';
import { createIdeaGenerator } from './ideas.js';
import { createPipeline } from './pipeline.js';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    }
  }
  return { command, flags };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const http = createHttp({ logger });

  if (command === 'ideas') {
    const ideas = createIdeaGenerator({ config, http });
    const list = await ideas.generate({ count: Number(flags.count) || 6, theme: flags.theme });
    list.forEach((idea, i) => process.stdout.write(`${i + 1}. ${idea}\n`));
    return;
  }

  if (command === 'run') {
    const topic = flags.topic;
    if (!topic || topic === true) throw new Error('run requires --topic "your topic"');
    const deps = {
      scriptWriter: createScriptWriter({ config, http }),
      voice: createVoice({ config, http }),
      heygen: createHeygen({ config, http, logger }),
      postiz: createPostiz({ config, http, logger }),
      fs: { mkdir, writeFile },
    };
    const pipeline = createPipeline({ config, deps, logger });
    const result = await pipeline.runOne({
      topic,
      dryRun: Boolean(flags['dry-run']),
      when: flags.schedule && flags.schedule !== true ? { date: flags.schedule } : undefined,
      outDir: flags.out && flags.out !== true ? flags.out : undefined,
    });
    process.stdout.write('\n' + JSON.stringify({ ok: true, dir: result.dir, published: result.published || false }, null, 2) + '\n');
    return;
  }

  process.stderr.write(
    [
      'Faceless Finance pipeline',
      '',
      'Usage:',
      '  fincast run --topic "How the ISA allowance works in 2025/26" [--dry-run] [--schedule <ISO>] [--out <dir>]',
      '  fincast ideas [--count 6] [--theme "pensions"]',
      '',
    ].join('\n')
  );
  process.exitCode = command ? 1 : 0;
}

main().catch((err) => {
  process.stderr.write(`\nERROR: ${err.message}\n`);
  if (process.env.LOG_LEVEL === 'debug') process.stderr.write((err.stack || '') + '\n');
  process.exitCode = 1;
});
