// Instagram Graph API — publish a Reel from a hosted video URL.
// Two-step: create container → publish container.
// Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing

export async function publishInstagram(env, tokens, { video_url, caption, schedule_at }) {
  if (schedule_at) {
    return {
      success: false,
      platform: 'instagram',
      error: 'Instagram Graph API does not support post scheduling for Reels. Post immediately or use Buffer.',
    };
  }

  const igUserId = tokens.ig_user_id;
  const accessToken = tokens.page_access_token || tokens.access_token;

  // Step 1: create container
  const createResp = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'REELS',
      video_url,
      caption: (caption || '').slice(0, 2200),
      access_token: accessToken,
    }),
  });
  if (!createResp.ok) throw new Error(`IG container create ${createResp.status}: ${(await createResp.text()).slice(0, 400)}`);
  const createData = await createResp.json();
  const containerId = createData.id;
  if (!containerId) throw new Error('IG did not return container id');

  // Step 2: poll container status until ready (Instagram has to fetch + process the video)
  let status = 'IN_PROGRESS';
  for (let i = 0; i < 30 && status !== 'FINISHED'; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusResp = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`);
    const statusData = await statusResp.json();
    status = statusData.status_code || 'UNKNOWN';
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`IG container failed: ${status}`);
    }
  }
  if (status !== 'FINISHED') throw new Error(`IG container did not finish in time (last status: ${status})`);

  // Step 3: publish
  const pubResp = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: containerId, access_token: accessToken }),
  });
  if (!pubResp.ok) throw new Error(`IG publish ${pubResp.status}: ${(await pubResp.text()).slice(0, 400)}`);
  const pubData = await pubResp.json();

  return {
    success: true,
    platform: 'instagram',
    media_id: pubData.id,
    note: 'Reel published.',
  };
}
