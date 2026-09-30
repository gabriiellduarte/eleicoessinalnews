// Extrai o trecho depois de /api/<nome>/ — vem na query (rewrite do vercel.json) ou na própria URL.
module.exports = function caminhoDe(req, nome) {
  const daQuery = req.query && req.query.caminho;
  if (daQuery) return Array.isArray(daQuery) ? daQuery.join('/') : String(daQuery);
  const url = new URL(req.url, 'http://localhost');
  const prefixo = `/api/${nome}/`;
  return url.pathname.startsWith(prefixo) ? decodeURIComponent(url.pathname.slice(prefixo.length)) : url.searchParams.get('caminho') || '';
};
