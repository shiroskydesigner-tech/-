// Cloudflare Pages Function — /api/units
// 以 Cloudflare KV 儲存一份共用「使用單位」清單；沿用 APP_PASSWORD 保護。
// GET  /api/units  → 讀清單（x-app-password header 驗證）
// POST /api/units  → 存清單（body: {password, units}）
// 需在 Pages 後台綁定 KV namespace，變數名 UNITS_KV。未綁定時讀取回空清單、儲存提示未綁定。

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function onRequestGet({ request, env }) {
  if (!env.APP_PASSWORD) return json({ error: '伺服器尚未設定 APP_PASSWORD' }, 500);
  if (request.headers.get('x-app-password') !== env.APP_PASSWORD) return json({ error: '密碼錯誤' }, 401);
  if (!env.UNITS_KV) return json({ units: [] }); // 未綁定 KV → 空清單，不報錯
  let units = [];
  try { const raw = await env.UNITS_KV.get('units'); units = raw ? JSON.parse(raw) : []; } catch (_) {}
  return json({ units: Array.isArray(units) ? units : [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.APP_PASSWORD) return json({ error: '伺服器尚未設定 APP_PASSWORD' }, 500);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: '請求格式錯誤' }, 400); }
  if (body.password !== env.APP_PASSWORD) return json({ error: '密碼錯誤' }, 401);
  if (!env.UNITS_KV) return json({ error: '伺服器尚未綁定 UNITS_KV，無法儲存' }, 500);

  const clean = (Array.isArray(body.units) ? body.units : []).slice(0, 50).map(u => ({
    id: String(u.id || ('u' + Math.random().toString(36).slice(2, 8))),
    name: String(u.name || '').trim().slice(0, 40),
    enabled: !!u.enabled
  })).filter(u => u.name);

  await env.UNITS_KV.put('units', JSON.stringify(clean));
  return json({ ok: true });
}

export async function onRequest(context) {
  const m = context.request.method;
  if (m === 'GET') return onRequestGet(context);
  if (m === 'POST') return onRequestPost(context);
  return json({ error: '只接受 GET/POST' }, 405);
}
