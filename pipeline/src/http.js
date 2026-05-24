// Thin fetch wrapper: timeout via AbortController, exponential-backoff retry on
// transient failures (network errors + 429/5xx), and structured errors. Every
// caller injects `fetchImpl` so the whole stack is testable without a network.

export class HttpError extends Error {
  constructor(message, { status, body, url } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createHttp({
  fetchImpl = globalThis.fetch,
  retries = 4,
  baseDelayMs = 1000,
  timeoutMs = 120000,
  logger,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('http: no fetch implementation available (Node >= 18 required)');
  }

  async function request(url, { method = 'GET', headers = {}, body, raw = false } = {}) {
    let attempt = 0;
    let lastErr;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, { method, headers, body, signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
          const text = await safeText(res);
          if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
            const delay = backoff(baseDelayMs, attempt, res);
            logger?.warn(`http ${res.status} on ${method} ${url} — retry in ${delay}ms`, {
              attempt: attempt + 1,
            });
            await sleep(delay);
            attempt++;
            continue;
          }
          throw new HttpError(`HTTP ${res.status} on ${method} ${url}`, {
            status: res.status,
            body: text,
            url,
          });
        }
        return raw ? res : parse(res);
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        const transient = err.name === 'AbortError' || err.name === 'TypeError';
        if (transient && attempt < retries) {
          const delay = backoff(baseDelayMs, attempt);
          logger?.warn(`http network error on ${method} ${url} — retry in ${delay}ms`, {
            error: err.message,
          });
          await sleep(delay);
          attempt++;
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  return {
    getJson: (url, opts) => request(url, { ...opts, method: 'GET' }),
    postJson: (url, json, opts = {}) =>
      request(url, {
        ...opts,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        body: JSON.stringify(json),
      }),
    postRaw: (url, opts = {}) => request(url, { ...opts, method: 'POST', raw: true }),
    getRaw: (url, opts = {}) => request(url, { ...opts, method: 'GET', raw: true }),
    request,
  };
}

function backoff(base, attempt, res) {
  // Honour Retry-After when the server provides it.
  const retryAfter = res?.headers?.get?.('retry-after');
  if (retryAfter && !Number.isNaN(Number(retryAfter))) return Number(retryAfter) * 1000;
  const jitter = Math.floor(Math.random() * 250);
  return base * 2 ** attempt + jitter;
}

async function parse(res) {
  const ct = res.headers.get?.('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
