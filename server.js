'use strict';
// ConectaDoa API — Node 22.13+ (SQLite embutido, zero dependências). Rodar: node server.js
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PUB = path.join(__dirname, 'public');
const ADMIN = process.env.ADMIN_TOKEN || 'senha-local'; // <-- Altere aqui sua senha mestra de dono do site
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'data', 'conectadoa.db'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS pontos(
  id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, bairro TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK(categoria IN('Alimentos','Roupas','Higiene')),
  endereco TEXT NOT NULL, descricao TEXT NOT NULL, horario TEXT NOT NULL, whats TEXT NOT NULL,
  urgencia TEXT NOT NULL CHECK(urgencia IN('disponivel','urgente')),
  itens_urgentes TEXT NOT NULL DEFAULT '', chave_hash TEXT, busca TEXT NOT NULL, criado_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_pontos ON pontos(urgencia, criado_em);`);

const norm = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const sha = s => crypto.createHash('sha256').update(s).digest();
const igual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function inserir(d, chaveHash = null) {
  const busca = norm([d.nome, d.bairro, d.endereco, d.descricao, d.categoria, d.itensUrgentes].join(' '));
  const r = db.prepare(`INSERT INTO pontos(nome,bairro,categoria,endereco,descricao,horario,whats,urgencia,itens_urgentes,chave_hash,busca,criado_em)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(d.nome, d.bairro, d.categoria, d.endereco, d.descricao, d.horario, d.whats,
    d.urgencia, d.itensUrgentes, chaveHash, busca, new Date().toISOString());
  return Number(r.lastInsertRowid);
}

function atualizar(id, d) {
  const busca = norm([d.nome, d.bairro, d.endereco, d.descricao, d.categoria, d.itensUrgentes].join(' '));
  db.prepare(`UPDATE pontos SET nome=?, bairro=?, categoria=?, endereco=?, descricao=?, horario=?, whats=?, urgencia=?, itens_urgentes=?, busca=? WHERE id=?`)
    .run(d.nome, d.bairro, d.categoria, d.endereco, d.descricao, d.horario, d.whats, d.urgencia, d.itensUrgentes, busca, id);
}

const COLS = 'id,nome,bairro,categoria,endereco,descricao,horario,whats,urgencia,itens_urgentes AS itensUrgentes,criado_em AS criadoEm';
const buscar = id => db.prepare(`SELECT ${COLS} FROM pontos WHERE id=?`).get(id);

if (db.prepare('SELECT COUNT(*) n FROM pontos').get().n === 0 && process.env.SEED !== '0') {
  const w = '5511999999999';
  inserir({ nome: 'Ação Solidária Comunitária', bairro: 'Centro', categoria: 'Alimentos', endereco: 'Rua das Flores, 123 - Centro', descricao: 'Arrecadação contínua de cestas básicas e leite para famílias em situação de vulnerabilidade.', horario: 'Seg a Sex: 08h - 17h', whats: w, urgencia: 'urgente', itensUrgentes: 'Arroz, Feijão, Leite em pó e Óleo de cozinha.' });
  inserir({ nome: 'Instituto Esperança Viva', bairro: 'Vila Nova', categoria: 'Roupas', endereco: 'Av. Principal, 450 - Vila Nova', descricao: 'Coleta de agasalhos, calçados e cobertores para a campanha do agasalho comunitária.', horario: 'Ter e Qui: 09h - 16h', whats: w, urgencia: 'disponivel', itensUrgentes: '' });
  inserir({ nome: 'Centro Comunitário São José', bairro: 'Jardim América', categoria: 'Higiene', endereco: 'Praça Central, 12 - Jd. América', descricao: 'Recebimento de itens de higiene pessoal e fraldas.', horario: 'Sábados: 08h - 12h', whats: w, urgencia: 'urgente', itensUrgentes: 'Fraldas geriátricas (G/EG) e Sabonetes.' });
}

// ---------- Validação ----------
const CAMPOS = { nome: [3, 100], bairro: [2, 60], endereco: [5, 150], descricao: [10, 500], horario: [3, 80] };
const CATS = ['Alimentos', 'Roupas', 'Higiene'];
function validar(b) {
  b = b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  const e = {}, d = {}, lim = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
  for (const [k, [mi, ma]] of Object.entries(CAMPOS)) {
    d[k] = lim(b[k]);
    if (d[k].length < mi || d[k].length > ma) e[k] = `${k}: use de ${mi} a ${ma} caracteres.`;
  }
  d.categoria = lim(b.categoria); if (!CATS.includes(d.categoria)) e.categoria = 'categoria inválida.';
  d.urgencia = lim(b.urgencia) || 'disponivel'; if (!['disponivel', 'urgente'].includes(d.urgencia)) e.urgencia = 'status inválido.';
  d.itensUrgentes = d.urgencia === 'urgente' ? lim(b.itensUrgentes).slice(0, 200) : '';
  
  let w = String(b.whats ?? '').replace(/\D/g, '');
  if (w.length === 10 || w.length === 11) w = '55' + w;
  d.whats = w;
  if (!/^55[1-9]\d{9,10}$/.test(w)) {
    e.whats = 'WhatsApp inválido. Informe DDD + número (ex: 11 99217-9363).';
  }
  return { d, e };
}

function temPermissao(req, rowHash) {
  const auth = req.headers.authorization || '';
  const ch = req.headers['x-chave-edicao'];
  const isAdmin = Boolean(ADMIN && auth.startsWith('Bearer ') && igual(auth.slice(7), ADMIN));
  const isCriador = Boolean(rowHash && typeof ch === 'string' && ch.length < 200 && igual(sha(ch).toString('hex'), rowHash));
  return isAdmin || isCriador;
}

// ---------- Utilidades HTTP ----------
const json = (res, st, o) => { const s = JSON.stringify(o); res.writeHead(st, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s), 'Cache-Control': 'no-store' }); res.end(s); };
const falha = (st, erro, detalhes) => Object.assign(new Error(erro), { st, detalhes });
const janelas = new Map();
function limitar(k, max, ms) {
  const t = Date.now(); let j = janelas.get(k);
  if (!j || j.fim <= t) janelas.set(k, (j = { n: 0, fim: t + ms }));
  return ++j.n <= max ? 0 : Math.ceil((j.fim - t) / 1000);
}
setInterval(() => { const t = Date.now(); for (const [k, j] of janelas) if (j.fim <= t) janelas.delete(k); }, 60000).unref();

function corpo(req) {
  return new Promise((ok, no) => {
    let n = 0, grande = false; const p = [];
    req.on('data', c => { n += c.length; if (n > 10240) grande = true; else p.push(c); });
    req.on('end', () => {
      if (grande) return no(falha(413, 'Requisição muito grande.'));
      try { ok(JSON.parse(Buffer.concat(p).toString('utf8') || '{}')); } catch { no(falha(400, 'JSON inválido.')); }
    });
    req.on('error', no);
  });
}

async function api(req, res, url) {
  const ip = (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress;
  const espera = limitar('g' + ip, 120, 60000);
  if (espera) { res.setHeader('Retry-After', espera); throw falha(429, 'Muitas requisições. Aguarde um instante.'); }
  const p = url.pathname, m = req.method;

  // Verificação de senha do Administrador
  if (p === '/api/admin/verificar' && m === 'POST') {
    if (limitar('adm' + ip, 10, 60000)) throw falha(429, 'Muitas tentativas. Aguarde 1 minuto.');
    const b = await corpo(req);
    const senha = typeof b.senha === 'string' ? b.senha : '';
    if (!ADMIN || !igual(senha, ADMIN)) throw falha(403, 'Senha de administrador incorreta.');
    return json(res, 200, { ok: true });
  }

  if (p === '/api/pontos' && m === 'GET') {
    const q = url.searchParams, where = [], args = [];
    for (const t of norm(q.get('busca') || '').slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 5)) { where.push("busca LIKE ? ESCAPE '\\'"); args.push(`%${t.replace(/[\\%_]/g, '\\$&')}%`); }
    if (CATS.includes(q.get('categoria'))) { where.push('categoria=?'); args.push(q.get('categoria')); }
    if (q.get('urgencia') === 'urgente') where.push("urgencia='urgente'");
    const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const limit = Math.min(Math.max(parseInt(q.get('limit')) || 30, 1), 100), offset = Math.max(parseInt(q.get('offset')) || 0, 0);
    const dados = db.prepare(`SELECT ${COLS} FROM pontos ${W} ORDER BY (urgencia='urgente') DESC, criado_em DESC, id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset).map(r => ({ ...r }));
    return json(res, 200, { dados, total: db.prepare(`SELECT COUNT(*) n FROM pontos ${W}`).get(...args).n, limit, offset });
  }
  
  if (p === '/api/pontos' && m === 'POST') {
    if (limitar('p' + ip, 10, 3600000)) throw falha(429, 'Limite de cadastros por hora atingido.');
    if (!(req.headers['content-type'] || '').includes('application/json')) throw falha(415, 'Envie JSON.');
    
    const { d, e } = validar(await corpo(req));
    if (Object.keys(e).length) throw falha(422, 'Dados inválidos.', Object.values(e));

    let resultadoN8n = null;
    try {
      const responseN8n = await fetch('http://localhost:5678/webhook/validar-e-notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d)
      });
      if (responseN8n.ok) {
        resultadoN8n = await responseN8n.json();
      }
    } catch (errN8n) {
      console.warn('Aviso: n8n indisponível no momento:', errN8n.message);
    }

    if (resultadoN8n && resultadoN8n.enderecoValido === false) {
      throw falha(400, 'Endereço não localizado ou não verificado no Google Maps.');
    }

    const chave = crypto.randomBytes(24).toString('hex');
    const id = inserir(d, sha(chave).toString('hex'));
    return json(res, 201, { ponto: { ...buscar(id) }, chaveEdicao: chave });
  }
  
  const r = p.match(/^\/api\/pontos\/(\d{1,12})$/);
  if (r) {
    const id = +r[1];
    const row = db.prepare('SELECT chave_hash h FROM pontos WHERE id=?').get(id);
    if (!row) throw falha(404, 'Ponto não encontrado.');
    
    if (m === 'GET') return json(res, 200, { ...buscar(id) });

    if (m === 'PUT') {
      if (!temPermissao(req, row.h)) throw falha(403, 'Sem permissão para editar este ponto.');
      if (!(req.headers['content-type'] || '').includes('application/json')) throw falha(415, 'Envie JSON.');
      const { d, e } = validar(await corpo(req));
      if (Object.keys(e).length) throw falha(422, 'Dados inválidos.', Object.values(e));
      atualizar(id, d);
      return json(res, 200, { ponto: { ...buscar(id) } });
    }

    if (m === 'DELETE') {
      if (!temPermissao(req, row.h)) throw falha(403, 'Sem permissão para remover este ponto.');
      db.prepare('DELETE FROM pontos WHERE id=?').run(id);
      res.writeHead(204); return res.end();
    }
  }
  throw falha(r || p === '/api/pontos' ? 405 : 404, 'Rota ou método não suportado.');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function estatico(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) throw falha(405, 'Método não permitido.');
  let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
  const f = path.normalize(path.join(PUB, rel));
  if (rel.includes('\0') || !f.startsWith(PUB + path.sep)) throw falha(404, 'Não encontrado.');
  fs.readFile(f, (err, buf) => {
    if (err) return json(res, 404, { erro: 'Não encontrado.' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https://unpkg.com https://cdn.jsdelivr.net; img-src 'self' data: https://images.unsplash.com; base-uri 'none'; frame-ancestors 'none'");
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) await api(req, res, url); else estatico(req, res, url);
  } catch (e) {
    if (!e.st) console.error(e);
    if (!res.headersSent) json(res, e.st || 500, { erro: e.st ? e.message : 'Erro interno.', detalhes: e.detalhes });
  }
}).listen(process.env.PORT || 3000, process.env.HOST || '127.0.0.1', function () {
  console.log(`ConectaDoa rodando em http://${this.address().address}:${this.address().port}`);
});