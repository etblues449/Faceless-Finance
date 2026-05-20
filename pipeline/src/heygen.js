// HeyGen Avatar V client. Flow:
//   1. Upload the ElevenLabs MP3 to HeyGen's asset endpoint (HeyGen needs a
//      reachable audio URL; uploading as an asset avoids hosting it ourselves).
//   2. POST /v2/video/generate with the Avatar V twin + that audio as the voice
//      input, so the avatar lip-syncs to OUR cloned voice.
//   3. Poll /v1/video_status.get until completed/failed.
//   4. Download the finished MP4 bytes.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function aspectToDimension(aspect, height = 1280) {
  const [w, h] = String(aspect).split(':').map(Number);
  if (!w || !h) return { width: 720, height: 1280 };
  if (w >= h) {
    // landscape/square: derive width from a 1280 long-edge
    return { width: Math.round((w / h) * 720), height: 720 };
  }
  return { width: Math.round((w / h) * height), height };
}

export function createHeygen({ config, http, logger }) {
  const key = () => config.heygen.apiKey();

  async function uploadAudio({ bytes, contentType }) {
    const data = await http.request(`${config.heygen.uploadBase}/v1/asset`, {
      method: 'POST',
      headers: { 'X-Api-Key': key(), 'Content-Type': contentType },
      body: bytes,
    });
    const url = data?.data?.url || data?.url;
    const id = data?.data?.id || data?.data?.asset_id || data?.id;
    if (!url) throw new Error('HeyGen asset upload returned no url: ' + JSON.stringify(data).slice(0, 200));
    return { assetId: id, audioUrl: url };
  }

  async function generate({ audioUrl }) {
    const dimension = aspectToDimension(config.aspect);
    const body = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: config.heygen.avatarId(),
            avatar_style: config.heygen.avatarStyle,
          },
          voice: { type: 'audio', audio_url: audioUrl },
        },
      ],
      dimension,
    };
    const data = await http.postJson(`${config.heygen.apiBase}/v2/video/generate`, body, {
      headers: { 'X-Api-Key': key() },
    });
    const videoId = data?.data?.video_id || data?.video_id;
    if (!videoId) throw new Error('HeyGen generate returned no video_id: ' + JSON.stringify(data).slice(0, 200));
    return { videoId };
  }

  async function getStatus(videoId) {
    const data = await http.getJson(
      `${config.heygen.apiBase}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      { headers: { 'X-Api-Key': key() } }
    );
    const d = data?.data || data;
    return { status: d.status, videoUrl: d.video_url, error: d.error };
  }

  async function waitForCompletion(videoId, { now = Date.now, sleepFn = sleep } = {}) {
    const deadline = now() + config.heygen.pollTimeoutMs;
    while (now() < deadline) {
      const { status, videoUrl, error } = await getStatus(videoId);
      logger?.debug(`heygen status ${videoId}: ${status}`);
      if (status === 'completed') {
        if (!videoUrl) throw new Error('HeyGen reported completed but no video_url');
        return { videoUrl };
      }
      if (status === 'failed') {
        throw new Error('HeyGen render failed: ' + JSON.stringify(error || {}));
      }
      await sleepFn(config.heygen.pollIntervalMs);
    }
    throw new Error(`HeyGen render timed out after ${config.heygen.pollTimeoutMs}ms`);
  }

  async function downloadVideo(videoUrl) {
    const res = await http.getRaw(videoUrl);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 10240) throw new Error(`HeyGen video download too small (${bytes.length} bytes)`);
    return { bytes, contentType: 'video/mp4', filename: 'video.mp4' };
  }

  async function renderTalkingVideo({ audio }) {
    const { audioUrl } = await uploadAudio(audio);
    const { videoId } = await generate({ audioUrl });
    logger?.info(`HeyGen render queued: ${videoId}`);
    const { videoUrl } = await waitForCompletion(videoId);
    const file = await downloadVideo(videoUrl);
    return { videoId, videoUrl, ...file };
  }

  return { uploadAudio, generate, getStatus, waitForCompletion, downloadVideo, renderTalkingVideo };
}
