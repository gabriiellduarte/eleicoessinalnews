// Vercel: /api/tse/<arquivo do TSE> → proxy com cache dos resultados da apuração.
const { atender } = require('../tse-proxy');
const caminhoDe = require('./_caminho');

module.exports = (req, res) => atender(caminhoDe(req, 'tse'), res, req);
