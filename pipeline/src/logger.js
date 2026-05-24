const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function ts() {
  return new Date().toISOString();
}

export function createLogger(minLevel = 'info') {
  const floor = LEVELS[minLevel] ?? LEVELS.info;
  const emit = (level, msg, extra) => {
    if (LEVELS[level] < floor) return;
    const line = `${ts()} [${level.toUpperCase()}] ${msg}`;
    const stream = LEVELS[level] >= LEVELS.warn ? process.stderr : process.stdout;
    stream.write(extra === undefined ? line + '\n' : `${line} ${safe(extra)}\n`);
  };
  return {
    debug: (m, e) => emit('debug', m, e),
    info: (m, e) => emit('info', m, e),
    warn: (m, e) => emit('warn', m, e),
    error: (m, e) => emit('error', m, e),
  };
}

function safe(v) {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
