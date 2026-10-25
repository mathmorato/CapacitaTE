// CapacitaTE - Edge Function admin-invite-user
// Convite de usuário pelo admin; exige a chave service_role (que nunca vai para o navegador):
//   { action: 'invite', email, full_name, permissions: [{ module_key, action }] }  → convida por e-mail
// Deploy: supabase functions deploy admin-invite-user
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das Edge Functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // 1. Quem chamou precisa estar logado e ser admin ativo
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !caller?.user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);
  const { data: profile } = await admin.from('profiles').select('is_admin, is_active').eq('user_id', caller.user.id).single();
  if (!profile?.is_admin || !profile?.is_active) return json({ error: 'Somente admins podem fazer isso.' }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Corpo inválido.' }, 400); }
  const audit = (action: string, target: string, details: Record<string, unknown> = {}) =>
    admin.from('audit_log').insert({ user_id: caller.user.id, action, target, details });

  if (body.action === 'invite') {
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400);
    const redirectTo = typeof body.redirect_to === 'string' ? body.redirect_to : undefined;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo });
    if (error) return json({ error: error.message }, 400);
    const userId = data.user.id;
    await admin.from('profiles').upsert({ user_id: userId, email, full_name: fullName }, { onConflict: 'user_id' });
    const perms = Array.isArray(body.permissions) ? body.permissions as { module_key: string; action: string }[] : [];
    const rows = perms
      .filter(p => /^[a-z][a-z0-9_]*$/.test(p.module_key) && /^[a-z][a-z0-9_]*$/.test(p.action))
      .map(p => ({ user_id: userId, module_key: p.module_key, action: p.action, granted_by: caller.user.id }));
    if (rows.length) await admin.from('module_permissions').insert(rows);
    await audit('user.invite', userId, { email, permissions: rows.length });
    return json({ ok: true, user_id: userId });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
});
