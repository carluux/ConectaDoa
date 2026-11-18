const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/validar-ponto';

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'conectadoa.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

// 1. Tabela ConectaDoa (Pontos de Coleta)
db.exec(`
  CREATE TABLE IF NOT EXISTS pontos_coleta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    bairro TEXT NOT NULL,
    endereco TEXT NOT NULL,
    horario TEXT NOT NULL,
    itens TEXT NOT NULL,
    urgente INTEGER NOT NULL DEFAULT 0,
    whatsapp TEXT NOT NULL,
    chave_edicao_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

db.exec(`CREATE TABLE IF NOT EXISTS eventos_arte(
  id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, categoria TEXT NOT NULL,
  bairro TEXT NOT NULL, endereco TEXT NOT NULL, data_horario TEXT NOT NULL,
  entrada TEXT NOT NULL, descricao TEXT NOT NULL, organizador TEXT NOT NULL,
  contato TEXT NOT NULL, instagram TEXT NOT NULL DEFAULT '',
  destaque INTEGER NOT NULL DEFAULT 0, conexoes INTEGER NOT NULL DEFAULT 0,
  chave_hash TEXT, busca TEXT NOT NULL, criado_em TEXT NOT NULL);`);

if (db.prepare('SELECT COUNT(*) n FROM eventos_arte').get().n === 0 && process.env.SEED !== '0') {
  const insArte = db.prepare(`INSERT INTO eventos_arte(titulo,categoria,bairro,endereco,data_horario,entrada,descricao,organizador,contato,instagram,destaque,conexoes,busca,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now = new Date().toISOString();
  insArte.run('Oficina Aberta de Dança Urbana & Hip-Hop', 'Dança', 'Santana', 'Centro Cultural Juventude - Av. Dep. Emílio Carlos, 3641', 'Sábados, 14h às 17h', 'Gratuito', 'Aulas abertas de breaking, locking e expressão corporal para jovens e iniciantes.', 'Coletivo Movimento Norte', '5511999991001', '@coletivomovimentonorte', 1, 42, norm('Oficina Aberta de Dança Urbana Hip-Hop Santana Coletivo Movimento Norte'), now);
  insArte.run('Roda de Leitura & Poesia Marginal na Praça', 'Leitura', 'Jardim Brasil', 'Praça Rotary - Jardim Brasil, São Paulo - SP', 'Domingos, 10h às 12h30', 'Beneficente (1kg de alimento)', 'Encontro comunitário de leitura compartilhada, troca de livros e microfone aberto.', 'Sarau da Quebrada', '5511999991002', '@saraudaquebrada_sp', 0, 29, norm('Roda de Leitura Poesia Marginal Jardim Brasil Sarau da Quebrada'), now);
  insArte.run('Ateliê Livre de Desenho, Grafite e Pintura', 'Artes Visuais', 'Tucuruvi', 'Rua Paranabi, 118 - Tucuruvi, São Paulo - SP', 'Quartas e Sextas, 18h30 às 20h30', 'Gratuito', 'Oficina prática de ilustração, técnicas de sombreamento e pintura mural.', 'Núcleo Arte Viva', '5511999991003', '@nucleoarteviva', 1, 37, norm('Atelie Livre de Desenho Grafite Pintura Tucuruvi Nucleo Arte Viva'), now);
}

// 2. Tabela ConectaArte (Eventos Culturais e Comunitários)
db.exec(`
  CREATE TABLE IF NOT EXISTS eventos_arte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    bairro TEXT NOT NULL,
    endereco TEXT NOT NULL,
    data_horario TEXT NOT NULL,
    entrada TEXT NOT NULL,
    descricao TEXT NOT NULL,
    organizador TEXT NOT NULL,
    contato TEXT NOT NULL,
    instagram TEXT NOT NULL DEFAULT '',
    destaque INTEGER NOT NULL DEFAULT 0,
    conexoes INTEGER NOT NULL DEFAULT 0,
    chave_edicao_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

function hashChave(chave) {
  return crypto.createHash('sha256').update(String(chave || '')).digest('hex');
}

function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Seed ConectaDoa
const totalPontos = db.prepare('SELECT COUNT(*) AS total FROM pontos_coleta').get().total;
if (totalPontos === 0) {
  const insertPonto = db.prepare(`
    INSERT INTO pontos_coleta (nome, categoria, bairro, endereco, horario, itens, urgente, whatsapp, chave_edicao_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPonto.run(
    'Associação Comunitária Jardim Brasil',
    'Alimentos',
    'Jardim Brasil',
    'Av. Roland Garros, 1420 - Jardim Brasil, São Paulo - SP',
    'Seg a Sáb, 08h às 18h',
    'Arroz, feijão, óleo, leite em pó e cestas básicas',
    1,
    '5511999990001',
    hashChave('seed-ponto-1')
  );
  insertPonto.run(
    'Projeto Acolher Santana',
    'Roupas',
    'Santana',
    'Rua Voluntários da Pátria, 2150 - Santana, São Paulo - SP',
    'Ter a Sex, 09h às 17h',
    'Agasalhos infantis, cobertores e calçados em bom estado',
    0,
    '5511999990002',
    hashChave('seed-ponto-2')
  );
  insertPonto.run(
    'Casa Solidária Vila Medeiros',
    'Higiene',
    'Vila Medeiros',
    'Av. Nossa Senhora do Loreto, 890 - Vila Medeiros, São Paulo - SP',
    'Seg a Sex, 09h às 18h',
    'Fraldas geriátricas (G/EG), sabonete, creme dental e absorventes',
    1,
    '5511999990003',
    hashChave('seed-ponto-3')
  );
}

// --- ROTAS CONECTAARTE (/api/arte) ---
if (p === '/api/arte' && m === 'GET') {
  const q = url.searchParams, where = [], args = [];
  const b = norm(q.get('busca') || '').trim();
  if (b) { where.push("busca LIKE ? ESCAPE '\\'"); args.push(`%${b.replace(/[\\%_]/g, '\\$&')}%`); }
  const cat = q.get('categoria') || '';
  if (cat && cat !== 'Todas') { where.push('categoria=?'); args.push(cat); }
  const ent = q.get('entrada') || '';
  if (ent && ent !== 'Todas') { where.push("entrada LIKE ? ESCAPE '\\'"); args.push(`%${ent.replace(/[\\%_]/g, '\\$&')}%`); }
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT id,titulo,categoria,bairro,endereco,data_horario,entrada,descricao,organizador,contato,instagram,destaque,conexoes,criado_em FROM eventos_arte ${W} ORDER BY destaque DESC, id DESC`).all(...args).map(x => ({ ...x }));
  return json(res, 200, rows);
}

if (p === '/api/arte' && m === 'POST') {
  const b = await corpo(req);
  const lim = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const titulo = lim(b.titulo, 120), categoria = lim(b.categoria, 50), bairro = lim(b.bairro, 60);
  const endereco = lim(b.endereco, 180), data_horario = lim(b.data_horario, 80), entrada = lim(b.entrada, 80);
  const descricao = lim(b.descricao, 400), organizador = lim(b.organizador, 100), instagram = lim(b.instagram, 60);
  const destaque = b.destaque ? 1 : 0;
  let contato = String(b.contato ?? '').replace(/\D/g, '');
  if (contato.length === 10 || contato.length === 11) contato = '55' + contato;

  if (!titulo || !categoria || !bairro || !endereco || !data_horario || !entrada || !descricao || !organizador || contato.length < 12) {
    throw falha(422, 'Preencha todos os campos obrigatórios e um WhatsApp válido com DDD.');
  }

  const chave = crypto.randomBytes(24).toString('hex');
  const busca = norm([titulo, categoria, bairro, endereco, descricao, organizador].join(' '));
  const info = db.prepare(`INSERT INTO eventos_arte(titulo,categoria,bairro,endereco,data_horario,entrada,descricao,organizador,contato,instagram,destaque,conexoes,chave_hash,busca,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`)
    .run(titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque, sha(chave).toString('hex'), busca, new Date().toISOString());
  return json(res, 201, { id: Number(info.lastInsertRowid), chaveEdicao: chave });
}

const rConn = p.match(/^\/api\/arte\/(\d{1,12})\/conectar$/);
if (rConn && m === 'POST') {
  const id = +rConn[1];
  db.prepare('UPDATE eventos_arte SET conexoes = conexoes + 1 WHERE id=?').run(id);
  const row = db.prepare('SELECT conexoes FROM eventos_arte WHERE id=?').get(id);
  return json(res, 200, { conexoes: row ? row.conexoes : 0 });
}

const rArte = p.match(/^\/api\/arte\/(\d{1,12})$/);
if (rArte) {
  const id = +rArte[1];
  const row = db.prepare('SELECT chave_hash h FROM eventos_arte WHERE id=?').get(id);
  if (!row) throw falha(404, 'Evento não encontrado.');

  // Aceita tanto Authorization: Bearer quanto X-Admin-Token do conectarte.html
  const admHeader = req.headers['x-admin-token'];
  if (admHeader && !req.headers.authorization) req.headers.authorization = `Bearer ${admHeader}`;
  if (!temPermissao(req, row.h)) throw falha(403, 'Sem permissão para alterar este evento.');

  if (m === 'DELETE') {
    db.prepare('DELETE FROM eventos_arte WHERE id=?').run(id);
    res.writeHead(204); return res.end();
  }
  if (m === 'PUT') {
    const b = await corpo(req);
    const lim = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
    const titulo = lim(b.titulo, 120), categoria = lim(b.categoria, 50), bairro = lim(b.bairro, 60);
    const endereco = lim(b.endereco, 180), data_horario = lim(b.data_horario, 80), entrada = lim(b.entrada, 80);
    const descricao = lim(b.descricao, 400), organizador = lim(b.organizador, 100), instagram = lim(b.instagram, 60);
    const destaque = b.destaque ? 1 : 0;
    let contato = String(b.contato ?? '').replace(/\D/g, '');
    if (contato.length === 10 || contato.length === 11) contato = '55' + contato;

    const busca = norm([titulo, categoria, bairro, endereco, descricao, organizador].join(' '));
    db.prepare(`UPDATE eventos_arte SET titulo=?, categoria=?, bairro=?, endereco=?, data_horario=?, entrada=?, descricao=?, organizador=?, contato=?, instagram=?, destaque=?, busca=? WHERE id=?`)
      .run(titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque, busca, id);
    return json(res, 200, { atualizado: true });
  }
}

// Seed ConectaArte
const totalArte = db.prepare('SELECT COUNT(*) AS total FROM eventos_arte').get().total;
if (totalArte === 0) {
  const insertArte = db.prepare(`
    INSERT INTO eventos_arte (titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque, conexoes, chave_edicao_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertArte.run(
    'Oficina Aberta de Dança Urbana & Hip-Hop',
    'Dança',
    'Santana',
    'Centro Cultural Juventude - Av. Dep. Emílio Carlos, 3641, São Paulo - SP',
    'Sábados, 14h às 17h',
    'Gratuito',
    'Aulas abertas de breaking, locking e expressão corporal para jovens e iniciantes da comunidade.',
    'Coletivo Movimento Norte',
    '5511999991001',
    '@coletivomovimentonorte',
    1,
    42,
    hashChave('seed-arte-1')
  );
  insertArte.run(
    'Roda de Leitura & Poesia Marginal na Praça',
    'Leitura',
    'Jardim Brasil',
    'Praça Rotary - Jardim Brasil, São Paulo - SP',
    'Domingos, 10h às 12h30',
    'Beneficente (1kg de alimento)',
    'Encontro comunitário de leitura compartilhada, troca de livros e microfone aberto para poetas locais.',
    'Sarau da Quebrada',
    '5511999991002',
    '@saraudaquebrada_sp',
    0,
    29,
    hashChave('seed-arte-2')
  );
  insertArte.run(
    'Ateliê Livre de Desenho, Grafite e Pintura',
    'Artes Visuais',
    'Tucuruvi',
    'Rua Paranabi, 118 - Tucuruvi, São Paulo - SP',
    'Quartas e Sextas, 18h30 às 20h30',
    'Gratuito',
    'Oficina prática de ilustração, técnicas de sombreamento e pintura mural com materiais compartilhados.',
    'Núcleo Arte Viva',
    '5511999991003',
    '@nucleoarteviva',
    1,
    37,
    hashChave('seed-arte-3')
  );
  insertArte.run(
    'Roda de Samba & Oficina de Percussão Comunitária',
    'Música',
    'Vila Maria',
    'Praça Santo Eduardo, 45 - Vila Maria, São Paulo - SP',
    'Sextas, 19h às 22h',
    'Gratuito',
    'Vivência musical gratuita com ensino básico de pandeiro, tantã e surdo seguida de roda aberta.',
    'Grupo Raízes do Samba',
    '5511999991004',
    '@raizesdosambazn',
    0,
    54,
    hashChave('seed-arte-4')
  );
}

// Rate Limiting simples por IP
const rateMap = new Map();
function verificarRateLimit(ip) {
  const agora = Date.now();
  const janela = 60_000;
  const maxReq = 60;
  const registro = rateMap.get(ip) || { count: 0, start: agora };
  if (agora - registro.start > janela) {
    registro.count = 1;
    registro.start = agora;
  } else {
    registro.count += 1;
  }
  rateMap.set(ip, registro);
  return registro.count <= maxReq;
}

function normalizarTexto(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function limparTexto(txt, max = 300) {
  return String(txt || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function limparTelefone(tel) {
  let nums = String(tel || '').replace(/\D/g, '');
  if (nums.length >= 10 && nums.length <= 11) nums = '55' + nums;
  return nums.slice(0, 15);
}

function lerJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error('Payload muito grande'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function enviarJson(res, status, dados) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(dados));
}

async function validarEnderecoN8n(endereco, bairro) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endereco, bairro }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return true;
    const data = await resp.json();
    if (typeof data.valido === 'boolean') return data.valido;
    return true;
  } catch {
    // Fallback automático caso o n8n local esteja offline (ex: ambiente cloud)
    return true;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  if (!verificarRateLimit(ip)) {
    return enviarJson(res, 429, { erro: 'Muitas requisições. Tente novamente em instantes.' });
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // --- API ADMIN ---
  if (pathname === '/api/admin/verificar' && req.method === 'POST') {
    try {
      const body = await lerJsonBody(req);
      const autorizado = compararSeguro(body.senha, ADMIN_TOKEN);
      if (!autorizado) return enviarJson(res, 401, { erro: 'Senha de administrador incorreta.' });
      return enviarJson(res, 200, { autorizado: true });
    } catch {
      return enviarJson(res, 400, { erro: 'Requisição inválida.' });
    }
  }

  // --- API CONECTADOA (/api/pontos) ---
  if (pathname === '/api/pontos' && req.method === 'GET') {
    const busca = normalizarTexto(urlObj.searchParams.get('busca'));
    const categoria = urlObj.searchParams.get('categoria') || '';
    const urgente = urlObj.searchParams.get('urgencia') === '1';

    let rows = db.prepare('SELECT id, nome, categoria, bairro, endereco, horario, itens, urgente, whatsapp, criado_em FROM pontos_coleta ORDER BY urgente DESC, id DESC').all();

    if (categoria && categoria !== 'Todas') {
      rows = rows.filter((r) => r.categoria === categoria);
    }
    if (urgente) {
      rows = rows.filter((r) => Number(r.urgente) === 1);
    }
    if (busca) {
      rows = rows.filter((r) =>
        normalizarTexto(`${r.nome} ${r.bairro} ${r.endereco} ${r.itens}`).includes(busca)
      );
    }
    return enviarJson(res, 200, rows);
  }

  if (pathname === '/api/pontos' && req.method === 'POST') {
    try {
      const body = await lerJsonBody(req);
      const nome = limparTexto(body.nome, 120);
      const categoria = limparTexto(body.categoria, 50);
      const bairro = limparTexto(body.bairro, 80);
      const endereco = limparTexto(body.endereco, 200);
      const horario = limparTexto(body.horario, 100);
      const itens = limparTexto(body.itens, 250);
      const urgente = body.urgente ? 1 : 0;
      const whatsapp = limparTelefone(body.whatsapp);

      if (!nome || !categoria || !bairro || !endereco || !horario || !itens || whatsapp.length < 12) {
        return enviarJson(res, 400, { erro: 'Preencha todos os campos obrigatórios e um WhatsApp válido com DDD.' });
      }

      const enderecoValido = await validarEnderecoN8n(endereco, bairro);
      if (!enderecoValido) {
        return enviarJson(res, 422, { erro: 'Endereço não localizado na validação geográfica. Verifique rua, número e bairro.' });
      }

      const chaveEdicao = crypto.randomBytes(16).toString('hex');
      const info = db.prepare(`
        INSERT INTO pontos_coleta (nome, categoria, bairro, endereco, horario, itens, urgente, whatsapp, chave_edicao_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(nome, categoria, bairro, endereco, horario, itens, urgente, whatsapp, hashChave(chaveEdicao));

      return enviarJson(res, 201, { id: Number(info.lastInsertRowid), chaveEdicao });
    } catch (err) {
      return enviarJson(res, 400, { erro: err.message || 'Erro ao cadastrar ponto.' });
    }
  }

  const matchPonto = pathname.match(/^\/api\/pontos\/(\d+)$/);
  if (matchPonto && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = Number(matchPonto[1]);
    const ponto = db.prepare('SELECT * FROM pontos_coleta WHERE id = ?').get(id);
    if (!ponto) return enviarJson(res, 404, { erro: 'Ponto não encontrado.' });

    const chaveHeader = req.headers['x-chave-edicao'] || '';
    const adminHeader = req.headers['x-admin-token'] || '';
    const ehCriador = chaveHeader && compararSeguro(hashChave(chaveHeader), ponto.chave_edicao_hash);
    const ehAdmin = adminHeader && compararSeguro(adminHeader, ADMIN_TOKEN);

    if (!ehCriador && !ehAdmin) {
      return enviarJson(res, 403, { erro: 'Sem permissão para alterar este ponto.' });
    }

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM pontos_coleta WHERE id = ?').run(id);
      return enviarJson(res, 200, { removido: true });
    }

    try {
      const body = await lerJsonBody(req);
      const nome = limparTexto(body.nome, 120);
      const categoria = limparTexto(body.categoria, 50);
      const bairro = limparTexto(body.bairro, 80);
      const endereco = limparTexto(body.endereco, 200);
      const horario = limparTexto(body.horario, 100);
      const itens = limparTexto(body.itens, 250);
      const urgente = body.urgente ? 1 : 0;
      const whatsapp = limparTelefone(body.whatsapp);

      if (!nome || !categoria || !bairro || !endereco || !horario || !itens || whatsapp.length < 12) {
        return enviarJson(res, 400, { erro: 'Preencha todos os campos obrigatórios.' });
      }

      db.prepare(`
        UPDATE pontos_coleta
        SET nome = ?, categoria = ?, bairro = ?, endereco = ?, horario = ?, itens = ?, urgente = ?, whatsapp = ?
        WHERE id = ?
      `).run(nome, categoria, bairro, endereco, horario, itens, urgente, whatsapp, id);

      return enviarJson(res, 200, { atualizado: true });
    } catch {
      return enviarJson(res, 400, { erro: 'Erro ao atualizar ponto.' });
    }
  }

  // --- API CONECTAARTE (/api/arte) ---
  if (pathname === '/api/arte' && req.method === 'GET') {
    const busca = normalizarTexto(urlObj.searchParams.get('busca'));
    const categoria = urlObj.searchParams.get('categoria') || '';
    const entrada = urlObj.searchParams.get('entrada') || '';

    let rows = db.prepare(`
      SELECT id, titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque, conexoes, criado_em
      FROM eventos_arte
      ORDER BY destaque DESC, id DESC
    `).all();

    if (categoria && categoria !== 'Todas') {
      rows = rows.filter((r) => r.categoria === categoria);
    }
    if (entrada && entrada !== 'Todas') {
      rows = rows.filter((r) => normalizarTexto(r.entrada).includes(normalizarTexto(entrada)));
    }
    if (busca) {
      rows = rows.filter((r) =>
        normalizarTexto(`${r.titulo} ${r.categoria} ${r.bairro} ${r.descricao} ${r.organizador}`).includes(busca)
      );
    }
    return enviarJson(res, 200, rows);
  }

  if (pathname === '/api/arte' && req.method === 'POST') {
    try {
      const body = await lerJsonBody(req);
      const titulo = limparTexto(body.titulo, 120);
      const categoria = limparTexto(body.categoria, 50);
      const bairro = limparTexto(body.bairro, 80);
      const endereco = limparTexto(body.endereco, 200);
      const data_horario = limparTexto(body.data_horario, 100);
      const entrada = limparTexto(body.entrada, 80);
      const descricao = limparTexto(body.descricao, 300);
      const organizador = limparTexto(body.organizador, 100);
      const contato = limparTelefone(body.contato);
      const instagram = limparTexto(body.instagram, 80);
      const destaque = body.destaque ? 1 : 0;

      if (!titulo || !categoria || !bairro || !endereco || !data_horario || !entrada || !descricao || !organizador || contato.length < 12) {
        return enviarJson(res, 400, { erro: 'Preencha todos os campos obrigatórios e um WhatsApp válido com DDD.' });
      }

      const enderecoValido = await validarEnderecoN8n(endereco, bairro);
      if (!enderecoValido) {
        return enviarJson(res, 422, { erro: 'Endereço do evento não localizado. Verifique rua, número e bairro.' });
      }

      const chaveEdicao = crypto.randomBytes(16).toString('hex');
      const info = db.prepare(`
        INSERT INTO eventos_arte (titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque, conexoes, chave_edicao_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque, hashChave(chaveEdicao));

      return enviarJson(res, 201, { id: Number(info.lastInsertRowid), chaveEdicao });
    } catch (err) {
      return enviarJson(res, 400, { erro: err.message || 'Erro ao cadastrar evento cultural.' });
    }
  }

  // Contador de conexões (sugestão da entrevista com o Victor)
  const matchArteConexao = pathname.match(/^\/api\/arte\/(\d+)\/conectar$/);
  if (matchArteConexao && req.method === 'POST') {
    const id = Number(matchArteConexao[1]);
    db.prepare('UPDATE eventos_arte SET conexoes = conexoes + 1 WHERE id = ?').run(id);
    const updated = db.prepare('SELECT conexoes FROM eventos_arte WHERE id = ?').get(id);
    return enviarJson(res, 200, { conexoes: updated ? updated.conexoes : 0 });
  }

  const matchArte = pathname.match(/^\/api\/arte\/(\d+)$/);
  if (matchArte && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = Number(matchArte[1]);
    const evento = db.prepare('SELECT * FROM eventos_arte WHERE id = ?').get(id);
    if (!evento) return enviarJson(res, 404, { erro: 'Evento não encontrado.' });

    const chaveHeader = req.headers['x-chave-edicao'] || '';
    const adminHeader = req.headers['x-admin-token'] || '';
    const ehCriador = chaveHeader && compararSeguro(hashChave(chaveHeader), evento.chave_edicao_hash);
    const ehAdmin = adminHeader && compararSeguro(adminHeader, ADMIN_TOKEN);

    if (!ehCriador && !ehAdmin) {
      return enviarJson(res, 403, { erro: 'Sem permissão para alterar este evento.' });
    }

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM eventos_arte WHERE id = ?').run(id);
      return enviarJson(res, 200, { removido: true });
    }

    try {
      const body = await lerJsonBody(req);
      const titulo = limparTexto(body.titulo, 120);
      const categoria = limparTexto(body.categoria, 50);
      const bairro = limparTexto(body.bairro, 80);
      const endereco = limparTexto(body.endereco, 200);
      const data_horario = limparTexto(body.data_horario, 100);
      const entrada = limparTexto(body.entrada, 80);
      const descricao = limparTexto(body.descricao, 300);
      const organizador = limparTexto(body.organizador, 100);
      const contato = limparTelefone(body.contato);
      const instagram = limparTexto(body.instagram, 80);
      const destaque = body.destaque ? 1 : 0;

      if (!titulo || !categoria || !bairro || !endereco || !data_horario || !entrada || !descricao || !organizador || contato.length < 12) {
        return enviarJson(res, 400, { erro: 'Preencha todos os campos obrigatórios.' });
      }

      db.prepare(`
        UPDATE eventos_arte
        SET titulo = ?, categoria = ?, bairro = ?, endereco = ?, data_horario = ?, entrada = ?, descricao = ?, organizador = ?, contato = ?, instagram = ?, destaque = ?
        WHERE id = ?
      `).run(titulo, categoria, bairro, endereco, data_horario, entrada, descricao, organizador, contato, instagram, destaque, id);

      return enviarJson(res, 200, { atualizado: true });
    } catch {
      return enviarJson(res, 400, { erro: 'Erro ao atualizar evento.' });
    }
  }

  // --- ARQUIVOS ESTÁTICOS ---
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, safePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Acesso negado');
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Página não encontrada');
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ConectaDoa & ConectaArte rodando em http://${HOST}:${PORT}`);
});