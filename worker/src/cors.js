// CORS helpers — restrict to FinCast app origin
export function corsHeaders(env, request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const matched = allowed.includes(origin) ? origin : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function preflight(env, request) {
  return new Response(null, { status: 204, headers: corsHeaders(env, request) });
}

export function jsonResponse(env, request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env, request), ...extraHeaders },
  });
}

export function redirect(url, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: url, ...extraHeaders } });
}

export function error(env, request, message, status = 400) {
  return jsonResponse(env, request, { error: message }, status);
}
