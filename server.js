'use strict';
// ConectaDoa & ConectaArte API — Node 22.13+ (SQLite embutido, zero dependências)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PUB = path.join(__dirname, 'public');
const ADMIN = process.env.ADMIN_TOKEN || 'senha-local';
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'data', 'conectadoa.db'));

db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS pontos(
  id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, bairro TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK(categoria IN('Alimentos','Roupas','Higiene')),
  endereco TEXT NOT NULL, descricao TEXT NOT NULL, horario TEXT NOT NULL, whats TEXT NOT NULL,
  urgencia TEXT NOT NULL CHECK(urgencia IN('disponivel','urgente')),
  itens_urgentes TEXT NOT NULL DEFAULT '', chave_hash TEXT, busca TEXT NOT NULL, criado_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_pontos ON pontos(urgencia, criado_em);

CREATE TABLE IF NOT EXISTS eventos_arte(
  id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, categoria TEXT NOT NULL,
  bairro TEXT NOT NULL, endereco TEXT NOT NULL, data_horario TEXT NOT NULL,
  entrada TEXT NOT NULL, descricao TEXT NOT NULL, organizador TEXT NOT NULL,
  contato TEXT NOT NULL, instagram TEXT NOT NULL DEFAULT '',
  destaque INTEGER NOT NULL DEFAULT 0, conexoes INTEGER NOT NULL DEFAULT 0,
  chave_hash TEXT, busca TEXT NOT NULL, criado_em TEXT NOT NULL);
`);

const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const sha = s => crypto.createHash('sha256').update(s).digest();
const igual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

// --- Funções ConectaDoa ---
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

// --- Seed ConectaArte ---
if (db.prepare('SELECT COUNT(*) n FROM eventos_arte').get().n === 0 && process.env.SEED !== '0') {
  const insArte = db.prepare(`INSERT INTO eventos_arte(titulo,categoria,bairro,endereco,data_horario,entrada,descricao,organizador,contato,instagram,destaque,conexoes,busca,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now = new Date().toISOString();
  insArte.run('Oficina Aberta de Dança Urbana & Hip-Hop', 'Dança', 'Santana', 'Centro Cultural Juventude - Av. Dep. Emílio Carlos, 3641', 'Sábados, 14h às 17h', 'Gratuito', 'Aulas abertas de breaking, locking e expressão corporal para jovens e iniciantes.', 'Coletivo Movimento Norte', '5511999991001', '@coletivomovimentonorte', 1, 42, norm('Oficina Aberta de Dança Urbana Hip-Hop Santana Coletivo Movimento Norte'), now);
  insArte.run('Roda de Leitura & Poesia Marginal na Praça', 'Leitura', 'Jardim Brasil', 'Praça Rotary - Jardim Brasil, São Paulo - SP', 'Domingos, 10h às 12h30', 'Beneficente (1kg de alimento)', 'Encontro comunitário de leitura compartilhada, troca de livros e microfone aberto.', 'Sarau da Quebrada', '5511999991002', '@saraudaquebrada_sp', 0, 29, norm('Roda de Leitura Poesia Marginal Jardim Brasil Sarau da Quebrada'), now);
  insArte.run('Ateliê Livre de Desenho, Grafite e Pintura', 'Artes Visuais', 'Tucuruvi', 'Rua Paranabi, 118 - Tucuruvi, São Paulo - SP', 'Quartas e Sextas, 18h30 às 20h30', 'Gratuito', 'Oficina prática de ilustração, técnicas de sombreamento e pintura mural.', 'Núcleo Arte Viva', '5511999991003', '@nucleoarteviva', 1, 37, norm('Atelie Livre de Desenho Grafite Pintura Tucuruvi Nucleo Arte Viva'), now);
  insArte.run('Roda de Samba & Oficina de Percussão Comunitária', 'Música', 'Vila Maria', 'Praça Santo Eduardo, 45 - Vila Maria, São Paulo - SP', 'Sextas, 19h às 22h', 'Gratuito', 'Vivência musical gratuita com ensino básico de pandeiro, tantã e surdo seguida de roda aberta.', 'Grupo Raízes do Samba', '5511999991004', '@raizesdosambazn', 0, 54, norm('Roda de Samba Oficina de Percussao Comunitaria Vila Maria Grupo Raizes do Samba'), now);
}

// ---------- Validação ConectaDoa ----------
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

// ---------- Validação ConectaArte ----------
const CATS_ARTE = ['Dança', 'Música', 'Artes Visuais', 'Leitura', 'Lutas & Capoeira'];
function validarArte(b) {
  b = b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  const lim = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

  const titulo = lim(b.titulo, 120);
  const categoria = lim(b.categoria, 50);
  const bairro = lim(b.bairro, 60);
  const endereco = lim(b.endereco, 180);
  const data_horario = lim(b.data_horario, 80);
  const entrada = lim(b.entrada, 80);
  const descricao = lim(b.descricao, 400);
  const organizador = lim(b.organizador, 100);
  const destaque = b.destaque ? 1 : 0;

  let contato = String(b.contato ?? '').replace(/\D/g, '');
  if (contato.length === 10 || contato.length === 11) contato = '55' + contato;

  const rawInsta = lim(b.instagram, 40).replace(/^@+/, '');
  if (rawInsta && !/^[a-zA-Z0-9._]{1,30}$/.test(rawInsta)) {
    throw falha(422, 'Instagram inválido. Informe apenas o @usuário (letras, números, ponto ou underline).');
  }
  const instagram = rawInsta ? `@${rawInsta}` : '';

  if (titulo.length < 3 || !CATS_ARTE.includes(categoria) || bairro.length < 2 || endereco.length < 5 ||
      data_horario.length < 3 || entrada.length < 3 || descricao.length < 10 || organizador.length < 2 ||
      !/^55[1-9]\d{9,10}$/.test(contato)) {
    throw falha(422, 'Preencha todos os campos obrigatórios corretamente e informe um WhatsApp válido com DDD.');
  }

  return { titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque };
}

function temPermissao(req, rowHash) {
  const auth = req.headers.authorization || '';
  const ch = req.headers['x-chave-edicao'];
  const isAdmin = Boolean(ADMIN && auth.startsWith('Bearer ') && igual(auth.slice(7), ADMIN));
  const isCriador = Boolean(rowHash && typeof ch === 'string' && ch.length < 200 && igual(sha(ch).toString('hex'), rowHash));
  return isAdmin || isCriador;
}

// ---------- Utilidades HTTP ----------
const json = (res, st, o) => {
  const s = JSON.stringify(o);
  res.writeHead(st, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s), 'Cache-Control': 'no-store' });
  res.end(s);
};
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
  const fwd = process.env.TRUST_PROXY !== '0' ? req.headers['x-forwarded-for']?.split(',')[0].trim() : '';
  const ip = fwd || req.socket.remoteAddress || 'unknown';
  const espera = limitar('g' + ip, 120, 60000);
  if (espera) { res.setHeader('Retry-After', espera); throw falha(429, 'Muitas requisições. Aguarde um instante.'); }
  const p = url.pathname, m = req.method;

  // Verificação de senha do Administrador
  if (p === '/api/admin/verificar' && m === 'POST') {
    if (limitar('adm' + ip, 10, 60000)) throw falha(429, 'Muitas tentativas. Aguarde 1 minuto.');
    if (!(req.headers['content-type'] || '').includes('application/json')) throw falha(415, 'Envie JSON.');
    const b = await corpo(req);
    const senha = typeof b.senha === 'string' ? b.senha : '';
    if (!ADMIN || !igual(senha, ADMIN)) throw falha(403, 'Senha de administrador incorreta.');
    return json(res, 200, { ok: true });
  }

  // --- ROTAS CONECTADOA (/api/pontos) ---
  if (p === '/api/pontos' && m === 'GET') {
    const q = url.searchParams, where = [], args = [];
    for (const t of norm(q.get('busca') || '').slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 5)) {
      where.push("busca LIKE ? ESCAPE '\\'");
      args.push(`%${t.replace(/[\\%_]/g, '\\$&')}%`);
    }
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

  // --- ROTAS CONECTAARTE (/api/arte) ---
  if (p === '/api/arte' && m === 'GET') {
    const q = url.searchParams, where = [], args = [];
    const b = norm(q.get('busca') || '').slice(0, 100).trim();
    if (b) { where.push("busca LIKE ? ESCAPE '\\'"); args.push(`%${b.replace(/[\\%_]/g, '\\$&')}%`); }
    const cat = q.get('categoria') || '';
    if (cat && cat !== 'Todas') { where.push('categoria=?'); args.push(cat); }
    const ent = q.get('entrada') || '';
    if (ent && ent !== 'Todas') { where.push("entrada LIKE ? ESCAPE '\\'"); args.push(`%${ent.replace(/[\\%_]/g, '\\$&')}%`); }
    const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = db.prepare(`SELECT id,titulo,categoria,bairro,endereco,data_horario,entrada,descricao,organizador,contato,instagram,destaque,conexoes,criado_em FROM eventos_arte ${W} ORDER BY destaque DESC, id DESC LIMIT 100`).all(...args).map(x => ({ ...x }));
    return json(res, 200, rows);
  }

  if (p === '/api/arte' && m === 'POST') {
    if (limitar('arte' + ip, 10, 3600000)) throw falha(429, 'Limite de cadastros por hora atingido.');
    if (!(req.headers['content-type'] || '').includes('application/json')) throw falha(415, 'Envie JSON.');

    const d = validarArte(await corpo(req));
    const chave = crypto.randomBytes(24).toString('hex');
    const busca = norm([d.titulo, d.categoria, d.bairro, d.endereco, d.descricao, d.organizador].join(' '));
    const info = db.prepare(`INSERT INTO eventos_arte(titulo,categoria,bairro,endereco,data_horario,entrada,descricao,organizador,contato,instagram,destaque,conexoes,chave_hash,busca,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`)
      .run(d.titulo, d.categoria, d.bairro, d.endereco, d.data_horario, d.entrada, d.descricao, d.organizador, d.contato, d.instagram, d.destaque, sha(chave).toString('hex'), busca, new Date().toISOString());
    return json(res, 201, { id: Number(info.lastInsertRowid), chaveEdicao: chave });
  }

  const rConn = p.match(/^\/api\/arte\/(\d{1,12})\/conectar$/);
  if (rConn && m === 'POST') {
    const id = +rConn[1];
    if (limitar('conn' + ip + ':' + id, 3, 3600000)) {
      throw falha(429, 'Limite de interações atingido para este evento.');
    }
    db.prepare('UPDATE eventos_arte SET conexoes = conexoes + 1 WHERE id=?').run(id);
    const row = db.prepare('SELECT conexoes FROM eventos_arte WHERE id=?').get(id);
    if (!row) throw falha(404, 'Evento não encontrado.');
    return json(res, 200, { conexoes: row.conexoes });
  }

  const rArte = p.match(/^\/api\/arte\/(\d{1,12})$/);
  if (rArte) {
    const id = +rArte[1];
    const row = db.prepare('SELECT chave_hash h FROM eventos_arte WHERE id=?').get(id);
    if (!row) throw falha(404, 'Evento não encontrado.');

    const admHeader = req.headers['x-admin-token'];
    if (admHeader && !req.headers.authorization) req.headers.authorization = `Bearer ${admHeader}`;
    if (!temPermissao(req, row.h)) throw falha(403, 'Sem permissão para alterar este evento.');

    if (m === 'DELETE') {
      db.prepare('DELETE FROM eventos_arte WHERE id=?').run(id);
      res.writeHead(204); return res.end();
    }
    if (m === 'PUT') {
      if (!(req.headers['content-type'] || '').includes('application/json')) throw falha(415, 'Envie JSON.');
      const d = validarArte(await corpo(req));
      const busca = norm([d.titulo, d.categoria, d.bairro, d.endereco, d.descricao, d.organizador].join(' '));
      db.prepare(`UPDATE eventos_arte SET titulo=?, categoria=?, bairro=?, endereco=?, data_horario=?, entrada=?, descricao=?, organizador=?, contato=?, instagram=?, destaque=?, busca=? WHERE id=?`)
        .run(d.titulo, d.categoria, d.bairro, d.endereco, d.data_horario, d.entrada, d.descricao, d.organizador, d.contato, d.instagram, d.destaque, busca, id);
      return json(res, 200, { atualizado: true });
    }
  }

  throw falha(r || rArte || p === '/api/pontos' || p === '/api/arte' ? 405 : 404, 'Rota ou método não suportado.');
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
}).listen(process.env.PORT || 3000, process.env.HOST || '0.0.0.0', function () {
  const hostExibicao = this.address().address === '0.0.0.0' ? 'localhost' : this.address().address;
  console.log(`ConectaDoa & ConectaArte rodando em http://${hostExibicao}:${this.address().port}`);
});