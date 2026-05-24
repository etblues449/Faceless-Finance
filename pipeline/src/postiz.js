// Postiz client (self-hosted, open-source). Uploads the rendered MP4 then
// creates a post per connected channel. Postiz direct-publishes via the
// platforms' official APIs, so "now" posts go straight to TikTok / YouTube /
// Instagram.
//
// Integration ids are supplied as "id" or "id:platform" (e.g. "abc123:youtube")
// so we can attach the right per-platform caption + title.

export function parseIntegrations(entries) {
  return entries.map((e) => {
    const [id, platform] = e.split(':');
    return { id: id.trim(), platform: (platform || '').trim().toLowerCase() || undefined };
  });
}

export function createPostiz({ config, http, logger }) {
  const headers = () => ({ Authorization: config.postiz.apiKey() });
  const base = () => config.postiz.baseUrl().replace(/\/$/, '');

  async function uploadMedia({ bytes, contentType, filename }) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: contentType }), filename);
    const data = await http.request(`${base()}/public/v1/upload`, {
      method: 'POST',
      headers: headers(),
      body: form,
    });
    const id = data?.id || data?.[0]?.id || data?.data?.id;
    const path = data?.path || data?.[0]?.path || data?.data?.path;
    if (!id) throw new Error('Postiz upload returned no media id: ' + JSON.stringify(data).slice(0, 200));
    return { id, path };
  }

  function captionFor(captions, platform) {
    if (platform && captions[platform]) return captions[platform];
    return captions.tiktok || Object.values(captions)[0];
  }

  function buildPayload({ captions, media, when }) {
    const integrations = parseIntegrations(config.postiz.integrationIds());
    const image = [{ id: media.id, ...(media.path ? { path: media.path } : {}) }];
    const posts = integrations.map(({ id, platform }) => {
      const c = captionFor(captions, platform);
      // Postiz requires a per-provider `__type` on settings; YouTube also takes a title.
      const settings = {
        ...(platform ? { __type: platform } : {}),
        ...(platform === 'youtube' && c.title ? { title: c.title } : {}),
      };
      return {
        integration: { id },
        value: [{ content: c.caption, image }],
        settings,
      };
    });
    // Postiz expects a `date` even for immediate posts.
    const date = when?.date || new Date().toISOString();
    return { type: when?.date ? 'schedule' : 'now', date, posts };
  }

  async function publish({ captions, media, when }) {
    const payload = buildPayload({ captions, media, when });
    logger?.info(`Postiz publishing to ${payload.posts.length} channel(s) (${payload.type})`);
    return http.postJson(`${base()}/public/v1/posts`, payload, { headers: headers() });
  }

  async function uploadAndPublish({ captions, video, when }) {
    const media = await uploadMedia(video);
    const result = await publish({ captions, media, when });
    return { media, result };
  }

  return { uploadMedia, buildPayload, publish, uploadAndPublish };
}
