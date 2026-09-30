// Servidor da apuração para rodar no próprio computador (estúdio): entrega os
// arquivos de /public e atende /api/tse/* e /api/cadastro/*.
// Na Vercel este arquivo não é usado: valem as funções da pasta api/.
const http = require('http');
const fs = require('fs');
const path = require('path');
const cadastro = require('./cadastro');
const tseProxy = require('./tse-proxy');

const PORT = process.env.PORT || 3000;
const RAIZ = path.join(__dirname, 'public');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function estatico(urlPath, res) {
  let rel = decodeURIComponent(urlPath);
  if (rel.endsWith('/')) rel += 'index.html';
  if (rel === '/telao' || rel === '/controle') rel += '.html';
  const arquivo = path.normalize(path.join(RAIZ, rel));
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(arquivo, (err, dados) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(dados);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Aceita /api/<nome>/<caminho> e também /api/<nome>?caminho=<caminho>: na Vercel as
    // regras do vercel.json reescrevem o endereço para a segunda forma antes de chegar aqui.
    const caminhoDe = (nome) => {
      if (url.pathname.startsWith(`/api/${nome}/`)) return url.pathname.slice(`/api/${nome}/`.length);
      return url.pathname === `/api/${nome}` ? url.searchParams.get('caminho') || '' : null;
    };
    const doTse = caminhoDe('tse');
    if (doTse !== null) return tseProxy.atender(doTse, res);
    const doCadastro = caminhoDe('cadastro');
    if (doCadastro !== null) return cadastro.atender(doCadastro, res);
    estatico(url.pathname, res);
  })
  .on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error(`A porta ${PORT} já está em uso: o servidor da apuração provavelmente já está rodando.`);
    console.error(`Abra http://localhost:${PORT} ou feche o outro servidor. Para usar outra porta: set PORT=3001 && node server.js`);
    process.exit(1);
  })
  .listen(PORT, () => {
    console.log(`Apuração Sinal News em http://localhost:${PORT}`);
    console.log(`Telão:               http://localhost:${PORT}/telao`);
  });
