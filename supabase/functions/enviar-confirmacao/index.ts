// CapacitaTE - Edge Function enviar-confirmacao
// Envia o e-mail de confirmação depois de uma inscrição, presença ou avaliação.
// É chamada pelos gatilhos do banco (migração 0004e, via pg_net) depois de cada INSERT em registrations,
// attendance e evaluations, com { table, record: { id } }. Publique com "Verify JWT" desligado.
//
// Segurança: a função não confia no conteúdo recebido. Ela usa só a tabela e o id do registro, relê a linha no banco
// (service_role) e envia para o e-mail gravado nela, uma única vez (marca answers.email_sent_at).
// Assim, mesmo chamada por terceiros, no máximo reenvia ao próprio participante a confirmação que ele já receberia.
//
// Segredos (Edge Functions > Secrets): GMAIL_USER (login do Gmail), GMAIL_APP_PASSWORD (senha de app de 16 letras)
// e, opcional, MAIL_FROM (padrão: "CECATE Centro-Oeste <cecate@ufg.br>").
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das Edge Functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const TABLES: Record<string, string> = { registrations: 'inscricao', attendance: 'presenca', evaluations: 'avaliacao' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const tz = 'America/Sao_Paulo';
const fmtDateTime = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const fmtDay = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(key) ? key.split('-').reverse().join('/') : key);
const protocol = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase();

function layout(title: string, intro: string, rows: [string, string][], footer: string, contacts: Record<string, string>) {
  const table = rows.filter(([, v]) => v).map(([k, v]) =>
    `<tr><td style="padding:6px 14px 6px 0; color:#757575; vertical-align:top; white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;"><strong>${esc(v)}</strong></td></tr>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif; max-width:560px; margin:0 auto; padding:24px; color:#202020;">
  <div style="background:#ffffff; border:1px solid #e5e5e5; border-top:4px solid #F6A800; border-radius:10px; padding:28px;">
    <p style="margin:0 0 4px; font-size:13px; color:#757575;">CECATE Centro-Oeste &middot; Capacitação em Transporte Escolar</p>
    <h2 style="margin:0 0 16px; font-size:20px;">${esc(title)}</h2>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.5;">${intro}</p>
    <table style="font-size:14px; border-collapse:collapse; margin:0 0 16px;">${table}</table>
    <p style="margin:0 0 12px; font-size:14px; line-height:1.5;">${footer}</p>
    <p style="margin:16px 0 0; font-size:12px; color:#757575;">Dúvidas: WhatsApp ${esc(contacts.whatsapp || '(62) 3209-6723')} &middot; Instagram ${esc(contacts.instagram || '@cecate.co')} &middot; ${esc(contacts.site || 'https://cecate.fct.ufg.br/')}<br>Este é um e-mail automático; não é preciso responder.</p>
  </div>
  <p style="text-align:center; font-size:11px; color:#999; margin-top:16px;">Centro Colaborador de Apoio ao Transporte Escolar da Região Centro-Oeste &middot; UFG / FNDE</p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  let payload: Record<string, any>;
  try { payload = await req.json(); } catch { return json({ error: 'Corpo inválido.' }, 400); }

  const table = String(payload.table || '');
  const id = String((payload.record && payload.record.id) || payload.id || '');
  if (!TABLES[table] || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Registro inválido.' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: row, error } = await db.from(table).select('*').eq('id', id).single();
  if (error || !row) return json({ error: 'Registro não encontrado.' }, 404);
  if (row.answers && row.answers.email_sent_at) return json({ ok: true, skipped: 'já enviado' });
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return json({ ok: true, skipped: 'sem e-mail' });

  const [{ data: form }, { data: training }] = await Promise.all([
    db.from('forms').select('config, module_key').eq('id', row.form_id).single(),
    db.from('trainings').select('number, polo, uf, data').eq('id', row.training_id).single()
  ]);
  const cfg = (form && form.config) || {};
  if (cfg.sendEmail === false) return json({ ok: true, skipped: 'envio desligado no formulário' });

  const t = training || { number: null, polo: '', uf: '', data: {} };
  const td = t.data || {};
  const cap = [t.number ? `${t.number}ª Capacitação em Transporte Escolar` : 'Capacitação em Transporte Escolar', t.polo ? `${t.polo}${t.uf ? `/${t.uf}` : ''}` : ''].filter(Boolean).join(' – ');
  const local = [td.locationVenue, td.locationAddress].filter(Boolean).join(' – ');
  const contacts = cfg.contacts || {};
  const first = String(row.full_name || '').split(/\s+/)[0] || 'participante';

  let subject = ''; let html = '';
  if (table === 'registrations') {
    const waitlist = row.answers && row.answers.waitlist;
    subject = `Inscrição recebida – ${cap}`;
    html = layout(waitlist ? 'Inscrição recebida (lista de espera)' : 'Inscrição confirmada',
      `Olá, ${esc(first)}! Recebemos a sua inscrição na <strong>${esc(cap)}</strong>.` +
        (waitlist ? ' <strong>As vagas do seu município nesta categoria já foram preenchidas: a sua inscrição ficou em lista de espera</strong> e a equipe do CECATE entrará em contato.' : ''),
      [['Protocolo', protocol(row.id)], ['Nome', row.full_name], ['Município', row.municipality], ['Categoria', row.category],
        ['Datas', td.datesFormatted || ''], ['Local', local], ['Enviada em', fmtDateTime(row.submitted_at)]],
      'Guarde este e-mail como comprovante. No dia da capacitação, registre a sua presença pelo QR Code disponível no local.', contacts);
  } else if (table === 'attendance') {
    subject = `Presença registrada em ${fmtDay(row.session_key)} – ${cap}`;
    html = layout('Presença registrada',
      `Olá, ${esc(first)}! A sua presença na <strong>${esc(cap)}</strong> foi registrada.`,
      [['Dia', fmtDay(row.session_key)], ['Registrada em', fmtDateTime(row.submitted_at)], ['Nome', row.full_name], ['Município', row.municipality], ['Local', local]],
      'Nos outros dias da capacitação, registre a presença novamente pelo mesmo QR Code.', contacts);
  } else {
    subject = `Obrigado pela avaliação – ${cap}`;
    html = layout('Avaliação recebida',
      `Olá, ${esc(first)}! Obrigado por avaliar a <strong>${esc(cap)}</strong>. As suas respostas ajudam o CECATE a melhorar as próximas formações.`,
      [['Protocolo', protocol(row.id)], ['Nome', row.full_name], ['Enviada em', fmtDateTime(row.submitted_at)]],
      'Acompanhe as próximas ações do CECATE Centro-Oeste pelo Instagram e pelo site.', contacts);
  }

  const user = Deno.env.get('GMAIL_USER');
  const pass = (Deno.env.get('GMAIL_APP_PASSWORD') || '').replace(/\s+/g, '');
  if (!user || !pass) return json({ error: 'Configure GMAIL_USER e GMAIL_APP_PASSWORD em Edge Functions > Secrets.' }, 500);

  const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: user, password: pass } } });
  try {
    await client.send({ from: Deno.env.get('MAIL_FROM') || 'CECATE Centro-Oeste <cecate@ufg.br>', to: row.email, subject, html, content: 'auto' });
  } catch (e) {
    await db.from('audit_log').insert({ action: 'email.error', module_key: TABLES[table], training_id: row.training_id, target: protocol(row.id), details: { message: String(e).slice(0, 300) } });
    return json({ error: 'Falha no envio do e-mail.' }, 502);
  } finally {
    try { await client.close(); } catch { /* conexão já encerrada */ }
  }

  await db.from(table).update({ answers: Object.assign({}, row.answers || {}, { email_sent_at: new Date().toISOString() }) }).eq('id', row.id);
  await db.from('audit_log').insert({ action: 'email.sent', module_key: TABLES[table], training_id: row.training_id, target: protocol(row.id) });
  return json({ ok: true });
});
