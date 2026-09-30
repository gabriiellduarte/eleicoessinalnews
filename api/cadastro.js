// Vercel: /api/cadastro/<rota> → candidatos, vices, municípios e fotos oficiais do TSE.
const { atender } = require('../cadastro');
const caminhoDe = require('./_caminho');

module.exports = (req, res) => atender(caminhoDe(req, 'cadastro'), res);
