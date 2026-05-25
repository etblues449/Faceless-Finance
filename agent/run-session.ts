/**
 * RUNTIME — run once per video. Creates a session against the pre-created
 * agent + environment, streams events, executes the custom (provider) tools
 * host-side so the keys never enter the sandbox, then downloads the two
 * artifacts (script.txt, storyboard.json) the worker wrote.
 *
 *   npm i @anthropic-ai/sdk
 *   FF_AGENT_ID=... FF_ENVIRONMENT_ID=... ANTHROPIC_API_KEY=... \
 *   PEXELS_KEY=... RUNWAY_KEY=... HIGGSFIELD_KEY=... ELEVENLABS_KEY=... GOOGLE_AI_KEY=... \
 *   npx tsx run-session.ts "Topic: maxing your 2025/26 ISA allowance" mat
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
const tone = (process.argv[3] ?? "neutral") as "mat" | "rebecca" | "neutral";

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
    // Render/voiceover/image tools — gated off by the system prompt in the
    // default script+storyboard flow. Implement the provider calls here when
    // you enable preview rendering.
    case "runway_generate":
      return notWired("runway_generate", "RUNWAY_KEY");
    case "higgsfield_generate":
      return notWired("higgsfield_generate", "HIGGSFIELD_KEY");
    case "elevenlabs_tts":
      return notWired("elevenlabs_tts", "ELEVENLABS_KEY");
    case "google_ai_generate":
      return notWired("google_ai_generate", "GOOGLE_AI_KEY");
    default:
      return `Unknown tool: ${name}`;
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

function notWired(tool: string, keyEnv: string): string {
  // Returned to the agent if it calls a preview tool in the default flow.
  return (
    `${tool} is not enabled in script/storyboard mode. The app renders ` +
    `downstream. (To enable preview rendering, implement the ${keyEnv}-backed ` +
    `call in run-session.ts.)`
  );
}

// ---- Session loop --------------------------------------------------------

async function main() {
  const session = await client.beta.sessions.create({
    agent: AGENT_ID,
    environment_id: ENV_ID,
    title: `FF video: ${topic.slice(0, 60)}`,
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
