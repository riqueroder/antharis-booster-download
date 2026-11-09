// Painel admin do Antharis Booster (Supabase)
const SB_URL = 'https://tpabceuglpbxkdptwcqz.supabase.co';
const SB_KEY = 'sb_publishable_gV7OXC031_TCcPifNOqr2Q_Zh7aQqIq';   // chave pública: só o admin consegue ler as tabelas (RLS)
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } });
const RELEASES = 'https://api.github.com/repos/riqueroder/antharis-booster-download/releases?per_page=8';
const ONLINE_MS = 15 * 60e3, DAY = 86400e3;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = { keys: [], machines: [], events: [], users: [], me: null, at: 0 };
const UI = { keyFilter: 'all', keyQ: '', userQ: '', userProv: 'all', pcQ: '', pcFilter: 'all', period: 90, newKeys: null, create: { kind: 'days', days: 30, pcs: 1, qty: 1, tester: false, note: '' } };

// ---------- ícones ----------
const I = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
  keys: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3"/><path d="m17 6 3 3"/><path d="m14.5 8.5 2 2"/>',
  pcs: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  metrics: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  versions: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7"/><path d="M18 11.5c0 3-3 4-9.5 5.5"/>',
  audit: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const DC_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19.6 5.3A16.8 16.8 0 0 0 15.4 4l-.5 1.1a15.6 15.6 0 0 0-5.8 0L8.6 4a16.8 16.8 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17a16.9 16.9 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12 12 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a16.9 16.9 0 0 0 5.2-2.6c.4-4.4-.7-8.3-3.1-11.7zM8.7 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1z"/></svg>';

// ---------- utilidades ----------
const fmtDate = t => t ? new Date(t).toLocaleDateString('pt-BR') : '—';
const fmtDT = t => t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
function ago(t) {
  if (!t) return '—';
  const s = (Date.now() - new Date(t)) / 1000;
  if (s < 90) return 'agora'; if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`; if (s < 172800) return 'ontem';
  return `há ${Math.round(s / 86400)} dias`;
}
const online = m => !m.released && Date.now() - new Date(m.last_seen) < ONLINE_MS;
const ini = n => (String(n || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?').toUpperCase();
const avatar = u => u && u.avatar ? `<img class="av" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="av">${esc(ini(u && u.name))}</span>`;
const provName = p => p === 'google' ? 'Google' : p === 'anonymous' ? 'Temporária' : 'Discord';
const provPill = p => p === 'anonymous' ? '<span class="pill p-off">Temporária</span>' : p === 'discord' ? '<span class="pill p-dc">Discord</span>' : p === 'google' ? '<span class="pill p-gg">Google</span>' : `<span class="pill p-off">${esc(p || 'E-mail')}</span>`;
function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3800); }
async function copy(txt, what) { try { await navigator.clipboard.writeText(txt); toast((what || 'Copiado') + ' para a área de transferência.'); } catch { toast('Não consegui copiar.', true); } }

function keyState(k) {
  if (k.status === 'blocked') return 'blocked';
  if (k.expires_at && new Date(k.expires_at) < Date.now()) return 'expired';
  if (!k.activated_at) return 'unused';
  if (k.expires_at && new Date(k.expires_at) - Date.now() < 7 * DAY) return 'soon';
  return 'active';
}
const ST = { active: ['Ativa', 'p-ok'], soon: ['Vence logo', 'p-warn'], unused: ['Não usada', 'p-off'], expired: ['Expirada', 'p-off'], blocked: ['Bloqueada', 'p-bad'] };
const stPill = k => { const [t, c] = ST[keyState(k)]; return `<span class="pill ${c}">${t}</span>`; };
const kindTxt = k => k.kind === 'lifetime' ? 'Vitalícia' : `${k.duration_days || '?'} dias`;
const expTxt = k => k.kind === 'lifetime' ? '—' : k.expires_at ? fmtDate(k.expires_at) : 'Ao ativar';
const keyOf = id => D.keys.find(k => k.id === id);
const userOf = id => D.users.find(u => u.id === id);
const pcsOf = k => D.machines.filter(m => m.key_id === k.id && !m.released);
const ownerName = k => { const u = k && k.owner && userOf(k.owner); return u ? u.name : null; };

// ---------- dados ----------
async function loadAll() {
  const [k, m, e, u] = await Promise.all([
    sb.from('license_keys').select('*').order('created_at', { ascending: false }),
    sb.from('machines').select('*').order('last_seen', { ascending: false }),
    sb.from('events').select('*').order('created_at', { ascending: false }).limit(400),
    sb.rpc('admin_users'),
  ]);
  const err = k.error || m.error || e.error || u.error;
  if (err) throw err;
  D.keys = k.data; D.machines = m.data; D.events = e.data; D.users = u.data; D.at = Date.now();
}
async function logEv(key_id, kind, detail) { try { await sb.from('events').insert({ key_id, kind, detail }); } catch {} }
async function act(fn, okMsg) {
  try { const r = await fn(); if (r && r.error) throw r.error; if (okMsg) toast(okMsg); await loadAll(); render(); return true; }
  catch (e) { toast('Erro: ' + (e.message || e), true); return false; }
}

// ---------- telas de entrada ----------
function showLogin(msg) {
  $('#app').innerHTML = `<div class="login"><div class="card">
    <div class="brand"><i>${'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#02121a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>'}</i><div><b>ANTHARIS</b><small>BOOSTER</small></div></div>
    <h1>Painel admin</h1><p class="muted" style="margin:0">Entre com a sua conta do Discord. Só contas marcadas como admin conseguem ver os dados.</p>
    ${msg ? `<div class="toast err" style="animation:none">${esc(msg)}</div>` : ''}
    <button class="dc" id="dcLogin">${DC_ICON}Entrar com Discord</button></div></div>`;
  $('#dcLogin').onclick = () => sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname } });
}
function showNotAdmin(user) {
  $('#app').innerHTML = `<div class="login"><div class="card">
    <h1>Essa conta ainda não é admin</h1>
    <p class="muted" style="margin:0">Você entrou como <b style="color:var(--text)">${esc(user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || user.email)}</b>. Para liberar o painel, abra o Supabase → <b>SQL Editor</b> → <b>New query</b>, cole isto e clique em <b>Run</b>. Depois recarregue esta página.</p>
    <pre class="sql">insert into public.admins (user_id)\nvalues ('${esc(user.id)}');</pre>
    <div class="row"><button class="btn cy" id="cpSql">Copiar comando</button><button class="btn" id="reload">Recarregar</button><button class="btn" id="out">Sair</button></div></div></div>`;
  $('#cpSql').onclick = () => copy(`insert into public.admins (user_id) values ('${user.id}');`, 'Comando copiado');
  $('#reload').onclick = () => location.reload();
  $('#out').onclick = async () => { await sb.auth.signOut(); showLogin(); };
}

// ---------- estrutura ----------
const PAGES = [['overview', 'Visão geral'], ['users', 'Usuários'], ['keys', 'Keys'], ['pcs', 'PCs ativos'], ['metrics', 'Métricas'], ['versions', 'Versões'], ['audit', 'Auditoria']];
function route() { const h = location.hash.replace('#', '') || 'overview'; const [p, id] = h.split('/'); return { p, id }; }
function shell(active, inner) {
  const meName = D.me && D.me.user_metadata && (D.me.user_metadata.full_name || D.me.user_metadata.name) || (D.me && D.me.email) || 'admin';
  return `<div class="shell"><nav class="side">
    <div class="brand"><i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#02121a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></i><div><b>ANTHARIS</b><small>BOOSTER</small></div></div>
    <div class="sub">Painel admin</div>
    ${PAGES.map(([id, t]) => `<a class="nav ${active === id ? 'on' : ''}" href="#${id}">${ic(id)}${t}</a>`).join('')}
    <div class="me"><span>Logado como ${esc(meName)}</span><button id="refresh">Atualizar dados</button><button id="logout">Sair do admin</button></div>
  </nav><main class="main">${inner}</main></div>`;
}
function render() {
  const { p, id } = route();
  const fn = { overview: pgOverview, users: pgUsers, keys: pgKeys, pcs: pgPcs, pc: () => pgPc(id), metrics: pgMetrics, versions: pgVersions, audit: pgAudit }[p] || pgOverview;
  const act = p === 'pc' ? 'pcs' : p;
  $('#app').innerHTML = shell(act, fn());
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.hash = ''; showLogin(); };
  $('#refresh').onclick = async () => { await loadAll(); render(); toast('Dados atualizados.'); };
  const after = { keys: bindKeys, users: bindUsers, pcs: bindPcs, pc: () => bindPc(id), versions: bindVersions, metrics: bindMetrics }[p];
  if (after) after();
}
window.addEventListener('hashchange', () => { if (D.me) { render(); window.scrollTo(0, 0); } });
const head = (t, sub, right = '') => `<div class="hd"><div><h1>${t}</h1><p>${sub}</p></div>${right}</div>`;

// ---------- Visão geral ----------
function pgOverview() {
  const st = D.keys.map(keyState);
  const on = D.machines.filter(online).length, act = D.machines.filter(m => !m.released).length;
  const month = Date.now() - 30 * DAY;
  const newUsers = D.users.filter(u => new Date(u.created_at) > month).length;
  // ativações por dia (30 dias)
  const days = [...Array(30)].map((_, i) => { const d = new Date(Date.now() - (29 - i) * DAY); return d.toISOString().slice(0, 10); });
  const cnt = Object.fromEntries(days.map(d => [d, 0]));
  D.events.filter(e => e.kind === 'activate' || e.kind === 'swap').forEach(e => { const d = e.created_at.slice(0, 10); if (d in cnt) cnt[d]++; });
  const max = Math.max(1, ...Object.values(cnt));
  const bars = days.map((d, i) => { const h = Math.round(cnt[d] / max * 150); return `<rect x="${i * 20 + 3}" y="${170 - h}" width="14" height="${Math.max(h, 2)}" rx="3" fill="${cnt[d] ? 'url(#g)' : '#172133'}"><title>${fmtDate(d + 'T12:00')}: ${cnt[d]}</title></rect>`; }).join('');
  return head('Visão geral', 'Resumo do Antharis Booster.') + `
    <div class="grid4">
      <div class="stat"><small>Usuários</small><b>${D.users.length}</b><span>+${newUsers} nos últimos 30 dias</span></div>
      <div class="stat"><small>Keys ativas</small><b>${st.filter(s => s === 'active' || s === 'soon').length}</b><span>${st.filter(s => s === 'unused').length} ainda não usadas</span></div>
      <div class="stat"><small>PCs online agora</small><b style="color:var(--cyan)">${on}</b><span>de ${act} PCs ativados</span></div>
      <div class="stat"><small>Vencem em 7 dias</small><b style="color:var(--warn)">${st.filter(s => s === 'soon').length}</b><span>${st.filter(s => s === 'blocked').length} bloqueadas</span></div>
    </div>
    <div class="row">
      <section class="card" style="flex:3 1 460px;min-width:0"><h2>Ativações por dia (30 dias)</h2>
        <svg viewBox="0 0 600 180" style="width:100%;height:220px" role="img" aria-label="Ativações por dia nos últimos 30 dias"><defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4f7bff"/><stop offset="1" stop-color="#2fd8ff"/></linearGradient></defs>${bars}</svg></section>
      <section class="card" style="flex:2 1 300px;min-width:0"><h2>Atividade recente</h2>${feed(D.events.slice(0, 8)) || '<div class="empty">Nada ainda.</div>'}</section>
    </div>`;
}
const EV = { activate: 'ativou a key', limit: 'tentou ativar além do limite de PCs', link: 'vinculou a conta', swap: 'trocou de PC (automático)',
  'admin:create': 'gerou keys', 'admin:block': 'bloqueou a key', 'admin:unblock': 'desbloqueou a key', 'admin:renew': 'renovou a key', 'admin:release': 'liberou troca de PC',
  'admin:delete': 'apagou uma key', 'admin:edit': 'editou a key', 'admin:pcdel': 'removeu um PC' };
function feed(list) {
  return list.map(e => {
    const k = keyOf(e.key_id); const u = k && k.owner && userOf(k.owner);
    const admin = e.kind.startsWith('admin:');
    const who = admin ? 'Admin' : (u ? u.name : (k ? k.key.slice(0, 9) + '…' : 'Key'));
    return `<div class="feed">${admin ? '<span class="av" style="background:#12324a;color:var(--cyan)">AD</span>' : avatar(u || { name: who })}<div style="min-width:0"><div>${esc(who)} ${EV[e.kind] || esc(e.kind)}${e.detail ? ` <span class="muted">· ${esc(e.detail)}</span>` : ''}</div><small>${ago(e.created_at)}</small></div></div>`;
  }).join('');
}

// ---------- Usuários ----------
function pgUsers() {
  const q = UI.userQ.toLowerCase();
  const rows = D.users.filter(u => UI.userProv === 'all' || u.provider === UI.userProv)
    .map(u => ({ u, keys: D.keys.filter(k => k.owner === u.id) }))
    .filter(({ u, keys }) => !q || [u.name, u.email, ...keys.map(k => k.key)].join(' ').toLowerCase().includes(q));
  const c = p => D.users.filter(u => p === 'all' || u.provider === p).length;
  return head('Usuários', 'Contas Discord, Google e temporárias (só de um PC) que entraram no app, com a key vinculada.', `<input class="in search" id="uq" placeholder="Buscar por nome, e-mail ou key" value="${esc(UI.userQ)}">`) + `
    <div class="chips">${[['all', 'Todos'], ['discord', 'Discord'], ['google', 'Google'], ['anonymous', 'Temporárias']].map(([p, t]) => `<button class="chip ${UI.userProv === p ? 'on' : ''}" data-up="${p}">${t} · ${c(p)}</button>`).join('')}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Usuário</th><th>Conta</th><th>Key</th><th>Vence</th><th>PCs</th><th>Visto</th><th>Status</th></tr></thead><tbody>
    ${rows.map(({ u, keys }) => { const k = keys[0]; const ms = k ? D.machines.filter(m => m.key_id === k.id) : [];
      return `<tr class="${k ? 'click' : ''}" ${k ? `data-key="${k.id}"` : ''}><td><div class="who">${avatar(u)}<div><b>${esc(u.name)}</b><small>${esc(u.email || '')}</small></div></div></td>
      <td>${provPill(u.provider)}</td><td class="mono">${k ? esc(k.key) + (keys.length > 1 ? ` <span class="muted">+${keys.length - 1}</span>` : '') : '<span class="muted">—</span>'}</td>
      <td>${k ? expTxt(k) : '—'}</td><td>${k ? `${pcsOf(k).length} / ${k.max_pcs}` : '—'}</td><td>${ms.length ? ago(ms[0].last_seen) : '—'}</td><td>${k ? stPill(k) : '<span class="pill p-off">Sem key</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Nenhum usuário ainda.</td></tr>'}
    </tbody></table></div>`;
}
function bindUsers() {
  const uq = $('#uq'); uq.oninput = () => { UI.userQ = uq.value; const pos = uq.selectionStart; render(); const n = $('#uq'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-up]').forEach(b => b.onclick = () => { UI.userProv = b.dataset.up; render(); });
  $$('tr[data-key]').forEach(r => r.onclick = () => keyModal(r.dataset.key));
}

// ---------- Keys ----------
function pgKeys() {
  const q = UI.keyQ.toLowerCase();
  const FL = [['all', 'Todas'], ['active', 'Ativas'], ['unused', 'Não usadas'], ['soon', 'Vencem logo'], ['expired', 'Expiradas'], ['blocked', 'Bloqueadas']];
  const list = D.keys.filter(k => UI.keyFilter === 'all' || keyState(k) === UI.keyFilter || (UI.keyFilter === 'active' && keyState(k) === 'soon'))
    .filter(k => !q || [k.key, k.note, ownerName(k)].join(' ').toLowerCase().includes(q));
  const c = UI.create;
  return head('Keys', 'Crie, renove e bloqueie o acesso dos clientes. Clique numa key para ver as ações.', `<input class="in search" id="kq" placeholder="Buscar key, cliente ou nota" value="${esc(UI.keyQ)}">`) + `
    <div class="chips">${FL.map(([f, t]) => `<button class="chip ${UI.keyFilter === f ? 'on' : ''}" data-kf="${f}">${t}</button>`).join('')}</div>
    <div class="row">
      <div class="tbl-wrap" style="flex:999 1 520px;min-width:0"><table><thead><tr><th>Key</th><th>Cliente</th><th>Tipo</th><th>Vence</th><th>PCs</th><th>Status</th></tr></thead><tbody>
        ${list.map(k => `<tr class="click" data-key="${k.id}"><td class="mono">${esc(k.key)}${k.tester ? ' <span class="pill p-cy">Tester</span>' : ''}</td>
          <td>${esc(ownerName(k) || k.note || '—')}</td><td>${kindTxt(k)}</td><td>${expTxt(k)}</td><td>${pcsOf(k).length} / ${k.max_pcs}</td><td>${stPill(k)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhuma key aqui.</td></tr>'}
      </tbody></table></div>
      <section class="card" style="flex:1 1 300px;max-width:360px;border-color:var(--cyan);display:flex;flex-direction:column;gap:14px">
        <h2 style="margin:0">Nova key</h2>
        <div class="field"><label for="cNote">Cliente / nota (opcional)</label><input class="in" id="cNote" placeholder="Nome ou Discord" value="${esc(c.note)}"></div>
        <div class="field"><span>Duração</span><div class="chips">${[[1, '1 dia'], [7, '7 dias'], [15, '15 dias'], [30, '30 dias'], [60, '60 dias'], [90, '90 dias'], [180, '180 dias'], [365, '1 ano'], ['life', 'Vitalícia']].map(([v, t]) => `<button class="chip ${(v === 'life' ? c.kind === 'lifetime' : c.kind === 'days' && c.days === v) ? 'on' : ''}" data-cd="${v}">${t}</button>`).join('')}</div>
          ${c.kind === 'days' ? `<div class="daysin"><label for="cDays">Ou digite quantos dias:</label><input class="in" id="cDays" type="number" min="1" max="3650" value="${c.days}"><span>dias</span></div>` : ''}</div>
        <div class="grid2" style="gap:10px"><div class="field"><label for="cPcs">Limite de PCs</label><input class="in" id="cPcs" type="number" min="1" max="20" value="${c.pcs}"></div>
          <div class="field"><label for="cQty">Quantidade</label><input class="in" id="cQty" type="number" min="1" max="100" value="${c.qty}"></div></div>
        <div class="tgrow"><div><b>Key de tester</b><span>Para você testar as versões</span></div><button class="tg ${c.tester ? 'on' : ''}" id="cTester" aria-label="Key de tester"></button></div>
        <button class="btn pri" id="cGo" style="height:46px;justify-content:center">Gerar keys</button>
        ${UI.newKeys ? `<div class="newkeys"><b>${UI.newKeys.length} key(s) criada(s)</b>${UI.newKeys.map(k => `<code>${esc(k)}</code>`).join('')}<button class="btn sm cy" id="cCopy">Copiar ${UI.newKeys.length > 1 ? 'todas' : ''}</button></div>` : ''}
      </section>
    </div>`;
}
function bindKeys() {
  const kq = $('#kq'); kq.oninput = () => { UI.keyQ = kq.value; const pos = kq.selectionStart; render(); const n = $('#kq'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-kf]').forEach(b => b.onclick = () => { UI.keyFilter = b.dataset.kf; render(); });
  $$('tr[data-key]').forEach(r => r.onclick = () => keyModal(r.dataset.key));
  const c = UI.create;
  const sync = () => { c.note = $('#cNote').value; if ($('#cDays')) c.days = Math.min(3650, Math.max(1, Math.round(+$('#cDays').value || 30))); c.pcs = +$('#cPcs').value || 1; c.qty = +$('#cQty').value || 1; };
  $$('[data-cd]').forEach(b => b.onclick = () => { sync(); const v = b.dataset.cd; if (v === 'life') c.kind = 'lifetime'; else { c.kind = 'days'; c.days = +v; } render(); });
  if ($('#cDays')) $('#cDays').oninput = () => { sync(); $$('[data-cd]').forEach(b => b.classList.toggle('on', +b.dataset.cd === c.days)); };
  $('#cTester').onclick = () => { sync(); c.tester = !c.tester; render(); };
  $('#cGo').onclick = async () => {
    sync(); $('#cGo').disabled = true;
    const r = await sb.rpc('admin_create_keys', { p_count: Math.min(100, Math.max(1, c.qty)), p_kind: c.kind, p_days: c.kind === 'days' ? c.days : null, p_max_pcs: Math.max(1, c.pcs), p_tester: c.tester, p_note: c.note || null });
    if (r.error) { toast('Erro: ' + r.error.message, true); $('#cGo').disabled = false; return; }
    UI.newKeys = r.data.map(k => k.key);
    await logEv(r.data[0] && r.data[0].id, 'admin:create', `${r.data.length}× ${c.kind === 'lifetime' ? 'vitalícia' : c.days + ' dias'}`);
    copy(UI.newKeys.join('\n'), UI.newKeys.length > 1 ? 'Keys copiadas' : 'Key copiada');
    await loadAll(); render();
  };
  if ($('#cCopy')) $('#cCopy').onclick = () => copy(UI.newKeys.join('\n'), 'Keys copiadas');
}

// janela com os detalhes e ações de uma key
function keyModal(id) {
  const k = keyOf(id); if (!k) return;
  const ms = D.machines.filter(m => m.key_id === k.id);
  const u = k.owner && userOf(k.owner);
  const close = () => { $('#modal').innerHTML = ''; };
  $('#modal').innerHTML = `<div class="bg"><div class="box" role="dialog" aria-modal="true" aria-label="Key ${esc(k.key)}">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h2 class="mono">${esc(k.key)}</h2>${stPill(k)}</div>
    <div>
      <div class="kv"><span>Tipo</span><span>${kindTxt(k)}${k.tester ? ' · Tester' : ''}</span></div>
      <div class="kv"><span>Ativada em</span><span>${fmtDT(k.activated_at)}</span></div>
      <div class="kv"><span>Vence</span><span>${expTxt(k)}</span></div>
      <div class="kv"><span>Conta vinculada</span><span>${u ? `${esc(u.name)} (${provName(u.provider)})` : '—'}</span></div>
      <div class="kv"><span>Nota</span><span>${esc(k.note || '—')}</span></div>
      <div class="kv"><span>PCs</span><span>${ms.filter(m => !m.released).length} de ${k.max_pcs}</span></div>
      ${ms.map(m => `<div class="kv"><span><a href="#pc/${m.id}" data-close>${esc(m.pc_name || 'PC')}</a>${m.released ? ' <span class="pill p-off">liberado</span>' : ''}</span><span>${ago(m.last_seen)} · v${esc(m.app_version || '?')}</span></div>`).join('')}
    </div>
    <div class="field"><span>Renovar</span><div class="chips">
      <button class="btn sm cy" data-renew="7">+7 dias</button><button class="btn sm cy" data-renew="30">+30 dias</button><button class="btn sm cy" data-renew="90">+90 dias</button><button class="btn sm cy" data-renew="365">+1 ano</button>
      <span class="daysin"><input class="in" id="mDays" type="number" min="1" max="3650" placeholder="dias" aria-label="Quantos dias adicionar"><button class="btn sm cy" id="mDaysGo">Adicionar</button></span>
      ${k.kind !== 'lifetime' ? '<button class="btn sm" data-renew="life">Tornar vitalícia</button>' : ''}</div></div>
    <div class="grid2" style="gap:10px"><div class="field"><label for="mPcs">Limite de PCs</label><input class="in" id="mPcs" type="number" min="1" max="20" value="${k.max_pcs}"></div>
      <div class="field"><label for="mNote">Nota</label><input class="in" id="mNote" value="${esc(k.note || '')}"></div></div>
    <div class="row" style="gap:8px">
      <button class="btn sm" id="mSave">Salvar limite e nota</button>
      <button class="btn sm" id="mCopy">Copiar key</button>
      <button class="btn sm" id="mRel" ${ms.some(m => !m.released) ? '' : 'disabled'}>Liberar troca de PC</button>
      <button class="btn sm ${k.status === 'blocked' ? 'cy' : 'red'}" id="mBlock">${k.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}</button>
      <button class="btn sm red" id="mDel">Apagar key</button>
      <button class="btn sm" id="mClose" style="margin-left:auto">Fechar</button>
    </div></div></div>`;
  $('#modal .bg').onclick = e => { if (e.target.classList.contains('bg')) close(); };
  $$('#modal [data-close]').forEach(a => a.onclick = close);
  $('#mClose').onclick = close;
  $('#mCopy').onclick = () => copy(k.key, 'Key copiada');
  $('#mDaysGo').onclick = () => {
    const n = Math.round(+$('#mDays').value);
    if (!(n >= 1 && n <= 3650)) return toast('Digite de 1 a 3650 dias.', true);
    const b = document.createElement('button'); b.dataset.renew = String(n); renewKey(b);
  };
  const renewKey = async b => {
    const v = b.dataset.renew; let patch;
    if (k.kind === 'lifetime' && v !== 'life') return toast('Esta key é vitalícia: não precisa renovar.');
    if (v === 'life') patch = { kind: 'lifetime', expires_at: null, duration_days: null };
    else if (!k.activated_at) patch = { duration_days: (k.duration_days || 0) + +v };
    else { const base = Math.max(Date.now(), k.expires_at ? new Date(k.expires_at).getTime() : Date.now()); patch = { expires_at: new Date(base + +v * DAY).toISOString() }; }
    if (await act(() => sb.from('license_keys').update(patch).eq('id', k.id), v === 'life' ? 'Agora é vitalícia.' : `Renovada: +${v} dias.`)) { logEv(k.id, 'admin:renew', v === 'life' ? 'vitalícia' : `+${v} dias`); keyModal(k.id); }
  };
  $$('#modal [data-renew]').forEach(b => b.onclick = () => renewKey(b));
  $('#mSave').onclick = async () => {
    const patch = { max_pcs: Math.max(1, +$('#mPcs').value || 1), note: $('#mNote').value || null };
    if (await act(() => sb.from('license_keys').update(patch).eq('id', k.id), 'Salvo.')) { logEv(k.id, 'admin:edit', `limite ${patch.max_pcs}`); keyModal(k.id); }
  };
  $('#mRel').onclick = async () => {
    if (!confirm('Liberar os PCs desta key? O cliente vai poder ativar em outro PC.')) return;
    if (await act(() => sb.from('machines').update({ released: true }).eq('key_id', k.id), 'PCs liberados. O cliente já pode ativar no PC novo.')) { logEv(k.id, 'admin:release'); keyModal(k.id); }
  };
  $('#mBlock').onclick = async () => {
    const block = k.status !== 'blocked';
    if (block && !confirm('Bloquear esta key? O app do cliente vai pedir uma key nova em até 2 minutos.')) return;
    if (await act(() => sb.from('license_keys').update({ status: block ? 'blocked' : 'active' }).eq('id', k.id), block ? 'Key bloqueada.' : 'Key desbloqueada.')) { logEv(k.id, block ? 'admin:block' : 'admin:unblock'); keyModal(k.id); }
  };
  $('#mDel').onclick = async () => {
    if (!confirm(`Apagar a key ${k.key} de vez? Os PCs dela perdem o acesso. Não dá para desfazer.`)) return;
    await logEv(null, 'admin:delete', k.key);
    if (await act(() => sb.from('license_keys').delete().eq('id', k.id), 'Key apagada.')) close();
  };
}

// ---------- PCs ----------
const cpuClean = s => String(s || '').replace(/\((R|TM)\)/gi, '').replace(/\b(CPU|Processor)\b/gi, '').replace(/@.*$/, '').replace(/\d+-Core/i, '').replace(/with Radeon.*$/i, '').replace(/\s+/g, ' ').trim();
const gpuList = r => { const s = r && r.specs; const l = (s && s.gpus ? s.gpus.map(g => g.name) : (r && r.gpus) || []); return l.filter(n => n && !/basic|remote|virtual|parsec|meta/i.test(n)); };
const ramTxt = r => { if (!r) return ''; const s = r.specs; const gb = r.ramGB || (s && s.ramTotal && Math.round(s.ramTotal / 1073741824)); const st = s && s.ram && s.ram[0]; return `${gb || '?'} GB${st && (st.conf || st.speed) ? ` · ${st.conf || st.speed} MT/s` : ''}${s && s.ram && s.ram.length ? ` · ${s.ram.length} pente${s.ram.length > 1 ? 's' : ''}` : ''}`; };
function pgPcs() {
  const q = UI.pcQ.toLowerCase();
  const list = D.machines.filter(m => !m.released && (UI.pcFilter === 'all' || online(m)))
    .filter(m => { const k = keyOf(m.key_id); return !q || [m.pc_name, k && k.key, ownerName(k), m.report && m.report.cpu, ...gpuList(m.report)].join(' ').toLowerCase().includes(q); });
  return head('PCs ativos', 'Cada PC com o Antharis Booster ativado. Clique para ver o relatório.', `<input class="in search" id="pq" placeholder="Buscar por key, cliente, CPU ou GPU" value="${esc(UI.pcQ)}">`) + `
    <div class="chips"><button class="chip ${UI.pcFilter === 'all' ? 'on' : ''}" data-pf="all">Todos · ${D.machines.filter(m => !m.released).length}</button><button class="chip ${UI.pcFilter === 'on' ? 'on' : ''}" data-pf="on">Online agora · ${D.machines.filter(online).length}</button></div>
    <div class="pcs">${list.map(m => { const k = keyOf(m.key_id); const r = m.report; const blocked = k && k.status === 'blocked';
      return `<a class="pc" href="#pc/${m.id}"><div class="t"><b>${esc(m.pc_name || 'PC')}</b>${blocked ? '<span class="pill p-bad">Bloqueado</span>' : online(m) ? '<span class="pill p-ok">Online</span>' : '<span class="pill p-off">Offline</span>'}</div>
        <div class="s"><div>${esc(cpuClean(r && (r.specs && r.specs.cpu ? r.specs.cpu.name : r.cpu)) || 'Sem relatório ainda')}</div><div>${esc(gpuList(r).join(' + ') || '')}</div><div>${esc(ramTxt(r))}</div></div>
        <div class="f"><span>${esc(ownerName(k) || (k ? k.key.slice(0, 9) + '…' : ''))}</span><span>${ago(m.last_seen)}</span></div></a>`; }).join('') || '<div class="empty">Nenhum PC aqui.</div>'}</div>`;
}
function bindPcs() {
  const pq = $('#pq'); pq.oninput = () => { UI.pcQ = pq.value; const pos = pq.selectionStart; render(); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-pf]').forEach(b => b.onclick = () => { UI.pcFilter = b.dataset.pf; render(); });
}

// ---------- Relatório do PC ----------
const GB = b => b ? (b / 1073741824 >= 1000 ? (b / 1099511627776).toFixed(1) + ' TB' : Math.round(b / 1073741824) + ' GB') : '?';
function pgPc(id) {
  const m = D.machines.find(x => x.id === id);
  if (!m) return head('PC não encontrado', '<a href="#pcs">← Voltar para PCs ativos</a>');
  const k = keyOf(m.key_id); const u = k && k.owner && userOf(k.owner); const r = m.report || {}; const s = r.specs || {};
  const hw = [];
  const cpu = s.cpu || {};
  hw.push(['Processador', `${cpuClean(cpu.name || r.cpu) || '?'}${cpu.cores ? ` · ${cpu.cores} núcleos / ${cpu.threads} threads` : r.threads ? ` · ${r.threads} threads` : ''}`]);
  (s.gpus || []).filter(g => gpuList({ specs: { gpus: [g] } }).length).forEach(g => hw.push(['Placa de vídeo', `${g.name}${g.vram ? ' · ' + GB(g.vram) : ''}${g.driver ? ' · driver ' + g.driver : ''}`]));
  if (!s.gpus && r.gpus) r.gpus.forEach(g => hw.push(['Placa de vídeo', g]));
  hw.push(['Memória', ramTxt(r)]);
  if (s.board) hw.push([s.board.laptop ? 'Notebook' : 'Placa-mãe', s.board.laptop ? [s.board.pcMaker, s.board.pcModel].filter(Boolean).join(' ') : [s.board.maker, s.board.model].filter(Boolean).join(' ') || '?']);
  (s.disks || []).forEach(d => hw.push(['Armazenamento', `${d.name} · ${GB(d.size)} · ${d.bus || d.media || ''}${d.health && d.health !== 'Healthy' ? ' · ' + d.health : ''}`]));
  (s.nets || []).forEach(n => hw.push(['Rede', `${n.desc || n.name}${n.speed ? ' · ' + n.speed : ''}`]));
  const build = String(r.windows || '').split('.')[2];
  hw.push(['Windows', r.windows ? `${+build >= 22000 ? 'Windows 11' : 'Windows 10'} · build ${build}` : '?']);
  hw.push(['Antharis Booster', `v${m.app_version || '?'}${r.admin === false ? ' · sem administrador' : ''}`]);
  const temps = (r.temps || []).filter(t => ['cpu', 'gpu', 'disk'].includes(t.grp));
  const set = r.settings || {};
  const cfg = [['Modo gamer', set.gamer ? 'Ligado' : 'Desligado', set.gamer], ['Atualização automática', set.autoUpdate ? 'Ligada' : 'Desligada', set.autoUpdate],
    ['Limpeza automática da RAM', set.memAuto && set.memAuto.on ? (set.memAuto.mode === 'pct' ? `Ao passar de ${set.memAuto.pct}%` : `A cada ${set.memAuto.min} min`) : 'Desligada', set.memAuto && set.memAuto.on],
    ['Ajustes aplicados', set.tweaks ? `${set.tweaks.length}` : '?', set.tweaks && set.tweaks.length]];
  const blocked = k && k.status === 'blocked';
  return `<a href="#pcs" style="font-size:13px;text-decoration:none">← Voltar para PCs ativos</a>` +
    head(`${esc(m.pc_name || 'PC')} ${blocked ? '<span class="pill p-bad">Bloqueado</span>' : online(m) ? '<span class="pill p-ok">Online</span>' : '<span class="pill p-off">Offline</span>'}`,
      `${u ? `Dono: <b style="color:#b9c1ff">${esc(u.name)}</b> · ` : ''}Key <span class="mono" style="color:var(--soft)">${esc(k ? k.key : '?')}</span> · ${k ? kindTxt(k) + (k.expires_at ? ' · vence ' + fmtDate(k.expires_at) : '') : ''} · último relatório ${ago(r.at || m.last_seen)}`,
      `<div class="row" style="gap:8px"><button class="btn cy" id="pRenew">Renovar +30 dias</button><button class="btn" id="pRel">Liberar troca de PC</button><button class="btn ${blocked ? 'cy' : 'red'}" id="pBlock">${blocked ? 'Desbloquear' : 'Bloquear'}</button><button class="btn" id="pKey">Ver key</button></div>`) + `
    ${m.report ? '' : '<div class="card muted">Este PC ainda não mandou o relatório. Ele chega uns 2 minutos depois de abrir o app e é atualizado a cada 10 minutos.</div>'}
    <div class="row">
      <section class="card" style="flex:3 1 420px;min-width:0"><h2 style="font-size:13px;letter-spacing:.1em;color:var(--muted)">HARDWARE</h2>${hw.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${esc(b)}</span></div>`).join('')}</section>
      <div style="flex:2 1 300px;min-width:0;display:flex;flex-direction:column;gap:16px">
        <section class="card"><h2 style="font-size:13px;letter-spacing:.1em;color:var(--muted)">TEMPERATURAS</h2>
          ${temps.length ? `<div class="temps">${temps.map(t => `<div class="tcell"><small>${esc(t.grp === 'cpu' ? 'CPU' : t.grp === 'gpu' ? 'GPU' : t.name)}</small><b style="color:${t.c >= 85 ? 'var(--bad)' : t.c >= 75 ? 'var(--warn)' : 'var(--text)'}">${t.c} °C</b><span>mín ${t.min} · máx ${t.max}</span></div>`).join('')}</div>` : '<div class="muted">Sem leitura de temperatura.</div>'}</section>
        <section class="card"><h2 style="font-size:13px;letter-spacing:.1em;color:var(--muted)">CONFIGURAÇÕES DO APP</h2>
          ${cfg.map(([a, b, on]) => `<div class="kv"><span style="color:var(--soft)">${a}</span><span style="color:${on ? 'var(--ok)' : 'var(--muted)'};font-weight:600">${esc(b)}</span></div>`).join('')}</section>
      </div></div>`;
}
function bindPc(id) {
  const m = D.machines.find(x => x.id === id); if (!m) return;
  const k = keyOf(m.key_id); if (!k) return;
  $('#pKey').onclick = () => keyModal(k.id);
  $('#pRenew').onclick = async () => {
    const patch = k.kind === 'lifetime' ? null : !k.activated_at ? { duration_days: (k.duration_days || 0) + 30 } : { expires_at: new Date(Math.max(Date.now(), k.expires_at ? new Date(k.expires_at).getTime() : Date.now()) + 30 * DAY).toISOString() };
    if (!patch) return toast('Esta key é vitalícia.');
    if (await act(() => sb.from('license_keys').update(patch).eq('id', k.id), 'Renovada: +30 dias.')) logEv(k.id, 'admin:renew', '+30 dias');
  };
  $('#pRel').onclick = async () => {
    if (!confirm('Liberar este PC? A vaga fica livre e o cliente pode ativar em outro PC.')) return;
    if (await act(() => sb.from('machines').update({ released: true }).eq('id', m.id), 'PC liberado.')) { logEv(k.id, 'admin:release', m.pc_name); location.hash = 'pcs'; }
  };
  $('#pBlock').onclick = async () => {
    const block = k.status !== 'blocked';
    if (block && !confirm('Bloquear a key deste PC? O app vai pedir uma key nova em até 2 minutos.')) return;
    if (await act(() => sb.from('license_keys').update({ status: block ? 'blocked' : 'active' }).eq('id', k.id), block ? 'Key bloqueada.' : 'Key desbloqueada.')) logEv(k.id, block ? 'admin:block' : 'admin:unblock', m.pc_name);
  };
}

// ---------- Métricas ----------
function pgMetrics() {
  const since = Date.now() - UI.period * DAY;
  const ms = D.machines.filter(m => m.report && new Date(m.last_seen) > since);
  const n = ms.length || 1;
  const pct = x => Math.round(x / n * 100);
  const pcs = x => `${x} PC${x === 1 ? '' : 's'}`;
  const cpus = ms.map(m => cpuClean(m.report.specs && m.report.specs.cpu ? m.report.specs.cpu.name : m.report.cpu));
  const laptops = ms.filter(m => m.report.specs && m.report.specs.board && m.report.specs.board.laptop).length;
  const x3d = cpus.filter(c => /X3D/i.test(c)).length;
  const hybrid = cpus.filter(c => /Core.*\b(1[2-9]\d{3}|Ultra)/i.test(c) || /Core\s*Ultra/i.test(c)).length;
  const count = arr => { const o = {}; arr.forEach(x => { if (x) o[x] = (o[x] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const INTEG = /Intel.*(UHD|Iris|HD Graphics)|Radeon\(TM\) Graphics|Radeon Graphics$|Radeon Vega/i;
  const mainGpus = m => { const l = [...new Set(gpuList(m.report))]; const d = l.filter(n => !INTEG.test(n)); return d.length ? d : l; };
  const gpuR = count(ms.flatMap(mainGpus)).slice(0, 10);
  const cpuR = count(cpus).slice(0, 10);
  const rank = list => list.length ? list.map(([name, c]) => `<div class="rank"><div><span>${esc(name)}</span><em>${c} PC${c > 1 ? 's' : ''} <span class="muted">· ${pct(c)}%</span></em></div><div class="bar"><i style="width:${Math.round(c / list[0][1] * 100)}%"></i></div></div>`).join('') : '<div class="muted">Sem dados no período.</div>';
  const mainGpu = m => { const l = mainGpus(m).join(' '); return /nvidia|geforce|rtx|gtx/i.test(l) ? 'NVIDIA' : /radeon|amd/i.test(l) ? 'AMD' : /intel|arc/i.test(l) ? 'Intel' : 'Outra'; };
  const ram = m => { const g = m.report.ramGB || 0; return g <= 8 ? '8 GB ou menos' : g <= 16 ? '16 GB' : g <= 32 ? '32 GB' : '64 GB ou mais'; };
  const win = m => +String(m.report.windows || '').split('.')[2] >= 22000 ? 'Windows 11' : 'Windows 10';
  const COL = ['#2fd8ff', '#4f7bff', '#7aa2ff', '#3a4a63'];
  const split = (t, arr) => { const l = count(arr); return `<section class="card"><h2 style="font-size:13.5px">${t}</h2><div class="split">${l.map(([, c], i) => `<i style="width:${pct(c)}%;background:${COL[i % 4]}"></i>`).join('')}</div>
    <div class="legend">${l.map(([nm, c], i) => `<span><i style="background:${COL[i % 4]}"></i>${esc(nm)} ${pct(c)}%</span>`).join('') || '<span class="muted">Sem dados</span>'}</div></section>`; };
  return head('Métricas', 'PCs que usaram o app no período, pela última ficha de cada um. Só dados técnicos.') + `
    <div class="seg" style="align-self:flex-start">${[7, 30, 90, 365].map(d => `<button class="${UI.period === d ? 'on' : ''}" data-per="${d}">${d} dias</button>`).join('')}</div>
    <div class="grid4">
      <div class="stat"><small>PCs com ficha</small><b>${ms.length}</b><span>no período</span></div>
      <div class="stat"><small>Notebooks</small><b>${pct(laptops)}%</b><span>${pcs(laptops)}</span></div>
      <div class="stat"><small>Ryzen X3D</small><b>${pct(x3d)}%</b><span>${pcs(x3d)}</span></div>
      <div class="stat"><small>Intel híbrido (P+E)</small><b>${pct(hybrid)}%</b><span>${pcs(hybrid)}</span></div>
    </div>
    <div class="grid2"><section class="card"><h2>Placas de vídeo</h2>${rank(gpuR)}</section><section class="card"><h2>Processadores</h2>${rank(cpuR)}</section></div>
    <div class="grid4">${split('Fabricante da GPU', ms.map(mainGpu))}${split('Fabricante da CPU', cpus.map(c => /amd|ryzen/i.test(c) ? 'AMD' : /intel|core/i.test(c) ? 'Intel' : 'Outro'))}${split('Memória RAM', ms.map(ram))}${split('Windows', ms.map(win))}</div>`;
}
function bindMetrics() { $$('[data-per]').forEach(b => b.onclick = () => { UI.period = +b.dataset.per; render(); }); }

// ---------- Versões ----------
let relCache = null;
function pgVersions() {
  const ms = D.machines.filter(m => !m.released && Date.now() - new Date(m.last_seen) < 30 * DAY);
  const o = {}; ms.forEach(m => { const v = m.app_version || '?'; o[v] = (o[v] || 0) + 1; });
  const vers = Object.entries(o).sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));
  const max = Math.max(1, ...vers.map(v => v[1]));
  const latest = relCache && relCache.find(r => !r.prerelease && !r.draft);
  return head('Versões', 'Quais versões estão em uso (PCs vistos nos últimos 30 dias) e as releases publicadas no GitHub.') + `
    <div class="row">
      <section class="card" style="flex:3 1 440px;min-width:0"><h2>Versões em uso</h2>
        ${vers.map(([v, c]) => `<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid #131b29"><b class="mono" style="width:70px">v${esc(v)}</b>
          <div class="bar" style="flex:1;margin:0;height:8px"><i style="width:${Math.round(c / max * 100)}%"></i></div><span style="width:110px;text-align:right" class="muted">${c} PC${c > 1 ? 's' : ''} · ${Math.round(c / ms.length * 100)}%</span>
          ${latest && latest.tag_name === 'v' + v ? '<span class="pill p-cy">Atual</span>' : '<span class="pill p-off">Antiga</span>'}</div>`).join('') || '<div class="muted">Nenhum PC ainda.</div>'}</section>
      <section class="card" style="flex:2 1 300px;min-width:0"><h2>Releases no GitHub</h2><div id="rels">${relCache ? relHtml() : '<div class="muted"><i class="spin" style="width:14px;height:14px;vertical-align:-2px"></i> Carregando…</div>'}</div></section>
    </div>`;
}
const relHtml = () => relCache.map(r => `<div class="kv"><span style="color:var(--text)"><b>${esc(r.tag_name)}</b> <span class="muted">· ${fmtDate(r.published_at)}</span></span><span>${r.prerelease ? '<span class="pill p-dc">Pré-lançamento</span>' : r === relCache.find(x => !x.prerelease && !x.draft) ? '<span class="pill p-cy">Latest</span>' : '<span class="pill p-off">Anterior</span>'}</span></div>`).join('') || '<div class="muted">Nenhuma release.</div>';
function bindVersions() {
  if (relCache) return;
  fetch(RELEASES).then(r => r.json()).then(j => { relCache = Array.isArray(j) ? j : []; if (route().p === 'versions') render(); }).catch(() => { const e = $('#rels'); if (e) e.innerHTML = '<div class="muted">Não consegui ler o GitHub agora.</div>'; });
}

// ---------- Auditoria ----------
function pgAudit() {
  return head('Auditoria', 'Tudo o que aconteceu: ativações, trocas de PC e ações do admin (últimos 400 registros).') + `
    <div class="tbl-wrap"><table><thead><tr><th>Quando</th><th>O quê</th><th>Key</th><th>Quem</th><th>Detalhe</th></tr></thead><tbody>
    ${D.events.map(e => { const k = keyOf(e.key_id); const adm = e.kind.startsWith('admin:');
      return `<tr ${k ? `class="click" data-key="${k.id}"` : ''}><td style="white-space:nowrap">${fmtDT(e.created_at)}</td><td>${adm ? '<span class="pill p-cy">Admin</span> ' : ''}${EV[e.kind] || esc(e.kind)}</td>
        <td class="mono">${k ? esc(k.key) : '—'}</td><td>${adm ? 'Admin' : esc(ownerName(k) || '—')}</td><td class="muted">${esc(e.detail || '')}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">Nada ainda.</td></tr>'}
    </tbody></table></div>`;
}
document.addEventListener('click', e => { const r = e.target.closest('#app tr[data-key]'); if (r && route().p === 'audit') keyModal(r.dataset.key); });

// ---------- início ----------
async function boot() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin(new URLSearchParams(location.search).get('error_description'));
    D.me = session.user;
    const { data: isAdm, error } = await sb.rpc('is_admin');
    if (error) throw error;
    if (!isAdm) return showNotAdmin(session.user);
    await loadAll(); render();
    setInterval(async () => { if (document.visibilityState === 'visible' && !$('#modal').innerHTML) { try { await loadAll(); const a = document.activeElement; if (!a || a.tagName !== 'INPUT') render(); } catch {} } }, 60000);
  } catch (e) {
    $('#app').innerHTML = `<div class="login"><div class="card"><h1>Não consegui carregar</h1><p class="muted">${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div></div>`;
  }
}
boot();
