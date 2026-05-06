// YouTube Data API v3 — resumable video upload from URL.
// Docs: https://developers.google.com/youtube/v3/docs/videos/insert
//
// We fetch the video URL into the worker, then stream it to YouTube via
// the resumable upload protocol. Note the worker has memory + time limits;
// for videos > ~50MB consider direct browser upload to a signed YouTube URL.

const UPLOAD_INIT = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

export async function publishYouTube(env, tokens, { video_url, caption, title, schedule_at }) {
  // 1. Fetch the video bytes (HeyGen CDN or wherever the user's MP4 lives)
  const videoResp = await fetch(video_url);
  if (!videoResp.ok) throw new Error(`Could not fetch video_url: ${videoResp.status}`);
  const contentType = videoResp.headers.get('content-type') || 'video/mp4';
  const contentLength = videoResp.headers.get('content-length');

  // 2. Initiate resumable upload
  const metadata = {
    snippet: {
      title: (title || caption || 'Untitled').slice(0, 100),
      description: caption || '',
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus: schedule_at ? 'private' : 'public',
      selfDeclaredMadeForKids: false,
      ...(schedule_at ? { publishAt: new Date(schedule_at).toISOString() } : {}),
    },
  };
  const init = await fetch(UPLOAD_INIT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      ...(contentLength ? { 'X-Upload-Content-Length': contentLength } : {}),
    },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) throw new Error(`YouTube upload init ${init.status}: ${(await init.text()).slice(0, 300)}`);
  const sessionUri = init.headers.get('location');
  if (!sessionUri) throw new Error('YouTube did not return resumable session URI');

  // 3. Upload bytes (single PUT — fine for short-form videos under ~50MB).
  const upload = await fetch(sessionUri, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: videoResp.body,
  });
  if (!upload.ok) throw new Error(`YouTube upload ${upload.status}: ${(await upload.text()).slice(0, 300)}`);
  const data = await upload.json();
  return {
    success: true,
    platform: 'youtube',
    video_id: data.id,
    url: `https://www.youtube.com/watch?v=${data.id}`,
    studio_url: `https://studio.youtube.com/video/${data.id}/edit`,
    note: schedule_at ? `Scheduled for ${new Date(schedule_at).toISOString()}` : 'Posted live.',
  };
}
