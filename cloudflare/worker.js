const APP_URL = 'https://ekaitzgs.github.io/mi-gym/';
const APP_ORIGIN = 'https://ekaitzgs.github.io';
const API = 'https://www.polaraccesslink.com/v3';
const cors = { 'Access-Control-Allow-Origin': APP_ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const back = (params) => Response.redirect(APP_URL + '#' + new URLSearchParams(params).toString(), 302);
const PUSH_HOSTS = /^(([a-z0-9-]+\.)*push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/;
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const subId = async (endpoint) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(endpoint)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
async function handle(req, env) {
const url = new URL(req.url);
if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
if (url.pathname.startsWith('/push/')) return push(req, url, env);
const redirectUri = url.origin + '/callback';
if (url.pathname === '/auth') return Response.redirect('https://flow.polar.com/oauth2/authorization?' + new URLSearchParams({ response_type: 'code', client_id: env.POLAR_CLIENT_ID, redirect_uri: redirectUri, scope: 'accesslink.read_all' }), 302);
if (url.pathname === '/callback') return callback(url, env, redirectUri);
const auth = req.headers.get('Authorization') || '';
if (url.pathname === '/exercises' || url.pathname === '/activities' || url.pathname === '/exercise') return data(url, auth);
if (url.pathname === '/') return new Response('Mi Gym - Polar OK v4', { headers: cors });
return json({ error: 'no_encontrado' }, 404);
}
async function callback(url, env, redirectUri) {
const code = url.searchParams.get('code');
if (!code) return back({ polar_error: url.searchParams.get('error') || 'sin_codigo' });
const basic = btoa(env.POLAR_CLIENT_ID + ':' + env.POLAR_CLIENT_SECRET);
const tr = await fetch('https://polarremote.com/v2/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json;charset=UTF-8' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }) });
const tok = await tr.json().catch(() => ({}));
if (!tr.ok || !tok.access_token) return back({ polar_error: tok.error || ('token_' + tr.status) });
const ur = await fetch(API + '/users', { method: 'POST', headers: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ 'member-id': 'migym-' + tok.x_user_id }) });
if (!ur.ok && ur.status !== 409) return back({ polar_error: 'registro_' + ur.status });
return back({ polar: tok.access_token, polar_user: tok.x_user_id });
}
async function data(url, auth) {
if (!auth.startsWith('Bearer ')) return json({ error: 'sin_token' }, 401);
let target;
if (url.pathname === '/exercises') target = API + '/exercises?samples=true&zones=true';
else if (url.pathname === '/exercise') {
const id = url.searchParams.get('id') || '';
if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return json({ error: 'id_no_valido' }, 400);
target = API + '/exercises/' + id + '?samples=true&zones=true';
} else target = API + '/users/activities?' + new URLSearchParams([...url.searchParams].filter(([k, v]) => (k === 'from' || k === 'to') && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)));
const r = await fetch(target, { headers: { Authorization: auth, Accept: 'application/json' } });
if (r.status === 204) return json([]);
const body = await r.text();
return new Response(body || '[]', { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
async function vapid(env) {
let k = await env.PUSH.get('vapid', 'json');
if (!k) {
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
k = { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)) };
await env.PUSH.put('vapid', JSON.stringify(k));
}
return k;
}
async function sendPush(env, endpoint) {
const k = await vapid(env);
const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: APP_URL })));
const key = await crypto.subtle.importKey('jwk', k.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + claims));
return fetch(endpoint, { method: 'POST', headers: { Authorization: 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + k.pub, TTL: '86400', Urgency: 'high', 'Content-Length': '0' } });
}
const clean = (it) => ({ k: String(it.k).slice(0, 60), at: Number(it.at) || 0, title: String(it.title || 'Mi Gym').slice(0, 80), body: String(it.body || '').slice(0, 240) });
async function push(req, url, env) {
if (!env.PUSH) return json({ error: 'sin_kv' }, 500);
const p = url.pathname;
if (p === '/push/key') return json({ key: (await vapid(env)).pub });
if (p === '/push/next') {
const id = (url.searchParams.get('id') || '').slice(0, 40);
const rec = await env.PUSH.get('sub:' + id, 'json');
const msg = rec && rec.queue && rec.queue.shift();
if (msg) await env.PUSH.put('sub:' + id, JSON.stringify(rec));
return json(msg || { title: 'Mi Gym', body: 'Tienes un aviso nuevo en Mi Gym.' });
}
if (req.method !== 'POST') return json({ error: 'metodo' }, 405);
const raw = await req.text();
if (raw.length > 20000) return json({ error: 'demasiado_grande' }, 413);
let body = {};
try { body = JSON.parse(raw) || {}; } catch {}
const endpoint = String((body.sub && body.sub.endpoint) || body.endpoint || '');
let host = '';
try { const u = new URL(endpoint); if (u.protocol === 'https:') host = u.hostname; } catch {}
if (!PUSH_HOSTS.test(host)) return json({ error: 'sin_suscripcion' }, 400);
const id = await subId(endpoint);
if (p === '/push/off') { await env.PUSH.delete('sub:' + id); return json({ ok: true }); }
const old = await env.PUSH.get('sub:' + id, 'json');
if (!old && (await env.PUSH.list({ prefix: 'sub:', limit: 20 })).keys.length >= 20) return json({ error: 'demasiadas_suscripciones' }, 429);
const rec = old || { sent: {}, queue: [] };
if (p === '/push/sync') {
rec.sub = { endpoint };
rec.items = (Array.isArray(body.items) ? body.items : []).slice(0, 60).map(clean);
const keep = {};
for (const it of rec.items) if (rec.sent[it.k]) keep[it.k] = 1;
rec.sent = keep;
await env.PUSH.put('sub:' + id, JSON.stringify(rec));
return json({ ok: true, id });
}
if (p === '/push/test') {
rec.sub = rec.sub || { endpoint };
rec.queue = [...(rec.queue || []), { title: 'Avisos activados \u2705', body: 'As\u00ed te llegar\u00e1n los avisos de Mi Gym.' }].slice(-10);
await env.PUSH.put('sub:' + id, JSON.stringify(rec));
const r = await sendPush(env, endpoint);
return json({ ok: r.ok, status: r.status, id });
}
return json({ error: 'no_encontrado' }, 404);
}
async function tick(env) {
if (!env.PUSH) return;
const now = Date.now();
const list = await env.PUSH.list({ prefix: 'sub:' });
for (const key of list.keys) {
const rec = await env.PUSH.get(key.name, 'json');
if (!rec || !rec.sub) continue;
const due = (rec.items || []).filter((it) => it.at <= now && it.at > now - 3 * 3600e3 && !rec.sent[it.k]);
if (!due.length) continue;
let gone = false;
for (const it of due) {
rec.sent[it.k] = 1;
rec.queue = [...(rec.queue || []), { title: it.title, body: it.body }].slice(-10);
const r = await sendPush(env, rec.sub.endpoint).catch(() => null);
if (r && (r.status === 404 || r.status === 410)) gone = true;
console.log('push', it.k, r ? r.status : 'error');
}
if (gone) await env.PUSH.delete(key.name);
else await env.PUSH.put(key.name, JSON.stringify(rec));
}
}
export default { fetch: handle, scheduled: (ev, env, ctx) => ctx.waitUntil(tick(env)) };
