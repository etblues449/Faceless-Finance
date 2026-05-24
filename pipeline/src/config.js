// Loads + validates configuration from environment variables. Keeps a single
// source of truth for which keys are required for which stage, so the CLI can
// fail fast with a clear message instead of a 401 deep inside a provider call.

const TONES = {
  mat: {
    label: 'Mat-style (QuidSquid)',
    style:
      'Punchy. 6-10 word sentences. Brutal hook in the first line. Show the £-saved figure early. TikTok-length 15-22 seconds, ~40-55 spoken words MAX.',
  },
  rebecca: {
    label: 'Rebecca-style (chartered accountant)',
    style:
      'Warm, technical-but-clear. Define any jargon in plain English. Educational. TikTok-length 25-35 seconds, ~55-75 spoken words MAX.',
  },
  neutral: {
    label: 'Neutral',
    style:
      'Clear, mid-pace, balanced. No clickbait. TikTok-length 18-25 seconds, ~45-60 spoken words MAX.',
  },
};

function req(env, key) {
  const v = env[key];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return String(v).trim();
}

function opt(env, key, fallback) {
  const v = env[key];
  return v && String(v).trim() ? String(v).trim() : fallback;
}

export function loadConfig(env = process.env) {
  const tone = opt(env, 'CHANNEL_TONE', 'rebecca');
  if (!TONES[tone]) {
    throw new Error(`CHANNEL_TONE must be one of: ${Object.keys(TONES).join(', ')}`);
  }

  const heygenCharacterType = opt(env, 'HEYGEN_CHARACTER_TYPE', 'avatar');
  if (!['avatar', 'talking_photo'].includes(heygenCharacterType)) {
    throw new Error("HEYGEN_CHARACTER_TYPE must be 'avatar' or 'talking_photo'");
  }

  return {
    logLevel: opt(env, 'LOG_LEVEL', 'info'),
    aspect: opt(env, 'VIDEO_ASPECT', '9:16'),
    tone,
    tonePreset: TONES[tone],

    anthropic: {
      apiKey: () => req(env, 'ANTHROPIC_API_KEY'),
      model: opt(env, 'ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
      baseUrl: opt(env, 'ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
    },

    elevenlabs: {
      apiKey: () => req(env, 'ELEVENLABS_API_KEY'),
      voiceId: () => req(env, 'ELEVENLABS_VOICE_ID'),
      modelId: opt(env, 'ELEVENLABS_MODEL', 'eleven_multilingual_v2'),
      baseUrl: opt(env, 'ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io'),
    },

    heygen: {
      apiKey: () => req(env, 'HEYGEN_API_KEY'),
      // The Avatar V "twin" you create in the HeyGen dashboard (the walking,
      // talk-to-camera Elliot). Its id goes here.
      avatarId: () => req(env, 'HEYGEN_AVATAR_ID'),
      // 'avatar' = a HeyGen studio avatar; 'talking_photo' = a photo-built twin
      // (Avatar IV), which is what a face built from reference photos usually is.
      characterType: heygenCharacterType,
      avatarStyle: opt(env, 'HEYGEN_AVATAR_STYLE', 'normal'),
      apiBase: opt(env, 'HEYGEN_API_BASE', 'https://api.heygen.com'),
      uploadBase: opt(env, 'HEYGEN_UPLOAD_BASE', 'https://upload.heygen.com'),
      pollIntervalMs: Number(opt(env, 'HEYGEN_POLL_INTERVAL_MS', '10000')),
      pollTimeoutMs: Number(opt(env, 'HEYGEN_POLL_TIMEOUT_MS', '1200000')),
    },

    postiz: {
      enabled: opt(env, 'POSTIZ_ENABLED', 'true') !== 'false',
      baseUrl: () => req(env, 'POSTIZ_URL'),
      apiKey: () => req(env, 'POSTIZ_API_KEY'),
      // Comma-separated Postiz integration ids for the connected channels.
      integrationIds: () =>
        req(env, 'POSTIZ_INTEGRATION_IDS')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    },

    compliance: {
      disclaimer: opt(
        env,
        'FCA_DISCLAIMER',
        'This is for educational purposes only and is not financial advice. I am not authorised by the Financial Conduct Authority. Always consult a qualified adviser before making financial decisions. Capital at risk.'
      ),
    },
  };
}

export { TONES };
