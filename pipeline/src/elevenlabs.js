// ElevenLabs text-to-speech. Renders the spoken script with the channel's
// professional voice clone and returns raw MP3 bytes. We generate the audio
// ourselves (rather than letting HeyGen synthesise) so the exact cloned voice
// is guaranteed regardless of HeyGen's internal voice catalogue.

export function createVoice({ config, http }) {
  return {
    async synthesize(text) {
      const voiceId = config.elevenlabs.voiceId();
      const res = await http.postRaw(
        `${config.elevenlabs.baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          headers: {
            'xi-api-key': config.elevenlabs.apiKey(),
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: config.elevenlabs.modelId,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
          }),
        }
      );
      const arrayBuf = await res.arrayBuffer();
      const bytes = Buffer.from(arrayBuf);
      if (bytes.length < 1024) {
        throw new Error(`ElevenLabs returned suspiciously small audio (${bytes.length} bytes)`);
      }
      return { bytes, contentType: 'audio/mpeg', filename: 'voiceover.mp3' };
    },
  };
}
