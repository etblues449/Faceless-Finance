/**
 * RUNTIME — run once per video. Creates a session against the pre-created
 * agent + environment, streams events, executes the custom (provider) tools
 * host-side so the keys never enter the sandbox, then downloads the two
 * artifacts (script.txt, storyboard.json) the worker wrote.
 *
 *   npm i @anthropic-ai/sdk
 *   FF_AGENT_ID=... FF_ENVIRONMENT_ID=... ANTHROPIC_API_KEY=... \
 *   FF_VIDEO_VAULT_ID=...        # vault holding the video_studio MCP credential (rendering) \
 *   PEXELS_KEY=... ELEVENLABS_KEY=... ELEVENLABS_VOICE_ID=... \
 *   npx tsx run-session.ts "Topic: maxing your 2025/26 ISA allowance" matStyle
 *
 * Note: this is the data-plane / orchestrator. It must run somewhere with a
 * long-lived execution context (a Node process, a queue consumer, or a
 * Cloudflare Durable Object) because it holds the SSE stream open and answers
 * custom-tool calls — a plain short-lived Worker request will time out.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

const client = new Anthropic(); // ANTHROPIC_API_KEY from env

const AGENT_ID = required("FF_AGENT_ID");
const ENV_ID = required("FF_ENVIRONMENT_ID");

const topic = process.argv[2] ?? "Topic: how the UK personal savings allowance works";
// Tone keys match the app's TONE_PRESETS (index.html).
const tone = (process.argv[3] ?? "matStyle") as "matStyle" | "rebeccaStyle" | "neutral";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

// ---- Host-side custom tool handlers (keys stay here) ---------------------

async function runCustomTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "pexels_search":
      return pexelsSearch(input);
    case "elevenlabs_tts":
      return elevenLabsTTS(input);
    default:
      // generate_image / generate_video / show_characters etc. are MCP tools —
      // executed server-side by Anthropic via the video_studio toolset, not here.
      return `Unknown custom tool: ${name}`;
  }
}

async function pexelsSearch(input: {
  query: string;
  orientation?: string;
  per_page?: number;
}): Promise<string> {
  const key = process.env.PEXELS_KEY;
  if (!key) return "PEXELS_KEY not set on the orchestrator.";
  const params = new URLSearchParams({
    query: input.query,
    orientation: input.orientation ?? "portrait",
    per_page: String(Math.min(input.per_page ?? 5, 15)),
  });
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: key },
  });
  if (!res.ok) return `Pexels error ${res.status}: ${await res.text()}`;
  const data: any = await res.json();
  const clips = (data.videos ?? []).map((v: any) => ({
    id: v.id,
    url: v.url,
    duration_s: v.duration,
    width: v.width,
    height: v.height,
  }));
  return JSON.stringify({ query: input.query, clips }, null, 2);
}

async function elevenLabsTTS(input: { text: string; voice_id?: string }): Promise<string> {
  const key = process.env.ELEVENLABS_KEY;
  if (!key) return "ELEVENLABS_KEY not set on the orchestrator.";
  const voiceId = input.voice_id ?? process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) return "No voice_id provided and ELEVENLABS_VOICE_ID not set.";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text: input.text, model_id: "eleven_multilingual_v2" }),
    },
  );
  if (!res.ok) return `ElevenLabs error ${res.status}: ${(await res.text()).slice(0, 300)}`;
  fs.mkdirSync("outputs/vo", { recursive: true });
  const file = `outputs/vo/${Date.now()}.mp3`;
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return `Saved voiceover to ${file}`;
}

// ---- Session loop --------------------------------------------------------

async function main() {
  // Attach the vault holding the video_studio MCP credential, if configured.
  const vaultIds = process.env.FF_VIDEO_VAULT_ID
    ? [process.env.FF_VIDEO_VAULT_ID]
    : undefined;
  const session = await client.beta.sessions.create({
    agent: AGENT_ID,
    environment_id: ENV_ID,
    title: `FF video: ${topic.slice(0, 60)}`,
    ...(vaultIds ? { vault_ids: vaultIds } : {}),
  });
  console.log(
    `Watch in Console: https://platform.claude.com/workspaces/default/sessions/${session.id}\n`,
  );

  const kickoff = {
    type: "user.message" as const,
    content: [
      {
        type: "text" as const,
        text:
          `${topic}\nTone: ${tone}.\n` +
          `Produce script.txt and storyboard.json per your output contract. ` +
          `Cinematic b-roll only — no talking head. Do not render; script + storyboard only.`,
      },
    ],
  };

  let kicked = false;
  while (true) {
    const stream = await client.beta.sessions.events.stream(session.id);
    if (!kicked) {
      await client.beta.sessions.events.send(session.id, { events: [kickoff] });
      kicked = true;
    }

    const toolCalls: { id: string; name: string; input: any }[] = [];
    let terminated = false;

    for await (const event of stream as any) {
      if (event.type === "agent.message") {
        for (const block of event.content) {
          if (block.type === "text") process.stdout.write(block.text);
        }
      } else if (event.type === "agent.custom_tool_use") {
        toolCalls.push({ id: event.id, name: event.name, input: event.input });
      } else if (event.type === "agent.mcp_tool_use") {
        console.log(`\n[mcp ${event.name}]`); // executed server-side by Anthropic
      } else if (event.type === "session.error") {
        console.error("\n[session.error]", JSON.stringify(event));
      } else if (event.type === "session.status_terminated") {
        terminated = true;
        break;
      } else if (event.type === "session.status_idle") {
        break; // decide below whether we're really done
      }
    }

    if (terminated) break;

    if (toolCalls.length > 0) {
      const results = await Promise.all(
        toolCalls.map(async (c) => ({
          type: "user.custom_tool_result" as const,
          custom_tool_use_id: c.id,
          content: [{ type: "text" as const, text: await runCustomTool(c.name, c.input) }],
        })),
      );
      await client.beta.sessions.events.send(session.id, { events: results });
      continue; // reopen stream and keep going
    }

    // Idle with no pending tool calls => terminal (end_turn). Done.
    break;
  }

  // ---- Download the artifacts the worker wrote to /mnt/session/outputs/ ----
  await new Promise((r) => setTimeout(r, 2000)); // brief indexing lag
  const files = await client.beta.files.list({
    scope_id: session.id,
    betas: ["managed-agents-2026-04-01"],
  } as any);
  fs.mkdirSync("outputs", { recursive: true });
  for (const f of (files as any).data) {
    const resp = await client.beta.files.download(f.id);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(`outputs/${f.filename}`, buf);
    console.log(`\nSaved outputs/${f.filename} (${f.size_bytes} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
