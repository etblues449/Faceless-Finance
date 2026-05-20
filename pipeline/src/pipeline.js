// The orchestrator: topic -> script -> voiceover -> talking video -> captions
// -> publish. Each external dependency is injected so the flow is fully unit-
// testable, and every run writes its artifacts to disk for inspection/recovery.

import { buildCaptions } from './captions.js';

export function createPipeline({ config, deps, logger }) {
  const { scriptWriter, voice, heygen, postiz, fs } = deps;

  async function runOne({ topic, when, dryRun = false, outDir }) {
    if (!topic || !topic.trim()) throw new Error('runOne requires a non-empty topic');
    const dir = outDir || defaultOutDir(topic);
    await fs.mkdir(dir, { recursive: true });

    logger.info(`[1/5] Writing script for: ${topic}`);
    const script = await scriptWriter.generate(topic);
    await fs.writeFile(`${dir}/script.json`, JSON.stringify(script, null, 2));

    const captions = buildCaptions({ script, disclaimer: config.compliance.disclaimer });
    await fs.writeFile(`${dir}/captions.json`, JSON.stringify(captions, null, 2));

    if (dryRun) {
      logger.info('[dry-run] Stopping before voice/video/publish. Artifacts written to ' + dir);
      return { dryRun: true, dir, topic, script, captions };
    }

    logger.info('[2/5] Synthesising voiceover (ElevenLabs)');
    const audio = await voice.synthesize(script.script);
    await fs.writeFile(`${dir}/voiceover.mp3`, audio.bytes);

    logger.info('[3/5] Rendering talking video (HeyGen Avatar V)');
    const video = await heygen.renderTalkingVideo({ audio });
    await fs.writeFile(`${dir}/video.mp4`, video.bytes);
    logger.info(`[3/5] Video ready: ${video.videoUrl}`);

    if (!config.postiz.enabled) {
      logger.info('[4/5] Postiz disabled — skipping publish. Video at ' + dir + '/video.mp4');
      return { dir, topic, script, captions, video: { id: video.videoId, url: video.videoUrl }, published: false };
    }

    logger.info(`[4/5] Publishing via Postiz (${when?.date ? 'scheduled ' + when.date : 'now'})`);
    const { media, result } = await postiz.uploadAndPublish({
      captions,
      video: { bytes: video.bytes, contentType: video.contentType, filename: video.filename },
      when,
    });
    await fs.writeFile(`${dir}/publish.json`, JSON.stringify({ media, result }, null, 2));

    logger.info('[5/5] Done.');
    return {
      dir,
      topic,
      script,
      captions,
      video: { id: video.videoId, url: video.videoUrl },
      published: true,
      publish: { media, result },
    };
  }

  return { runOne };
}

export function defaultOutDir(topic) {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `output/${stamp}_${slug || 'video'}`;
}
