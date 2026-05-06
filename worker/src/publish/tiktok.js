// TikTok Content Posting API — pull-from-URL flow.
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post

export async function publishTikTok(env, tokens, { video_url, caption, schedule_at }) {
  const initBody = {
    post_info: {
      title: (caption || '').slice(0, 2200),
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url,
    },
  };
  const init = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(initBody),
  });
  if (!init.ok) {
    const t = await init.text();
    throw new Error(`TikTok publish init ${init.status}: ${t.slice(0, 400)}`);
  }
  const initData = await init.json();
  if (initData.error?.code && initData.error.code !== 'ok') {
    throw new Error(`TikTok publish init: ${JSON.stringify(initData.error)}`);
  }
  const publishId = initData.data?.publish_id;
  if (!publishId) throw new Error('TikTok did not return publish_id');

  // Note: scheduling is not supported by the Direct Post pull-from-URL endpoint
  // for most apps; if scheduled is requested we just publish now and warn.
  return {
    success: true,
    platform: 'tiktok',
    publish_id: publishId,
    note: schedule_at
      ? 'TikTok Content Posting API does not support scheduling — posted immediately.'
      : 'Submitted to TikTok. Check status at https://www.tiktok.com/@yourhandle.',
    status_url: `https://open.tiktokapis.com/v2/post/publish/status/fetch/?publish_id=${encodeURIComponent(publishId)}`,
  };
}
