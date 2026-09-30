// Sonda os arquivos de resultado do TSE para descobrir o que já está publicado.
// Uso: node scripts/sondar-tse.js [ambiente]      (ambiente: oficial | simulado)
const AMBIENTE = process.argv[2] || 'oficial';
const FEDERAL = process.env.TSE_FEDERAL || '6257';
const ESTADUAL = process.env.TSE_ESTADUAL || '6259';
const BASE = 'https://resultados.tse.jus.br';
const CABECALHOS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};
const e6 = (n) => String(n).padStart(6, '0');

const caminhos = [
  `${AMBIENTE}/comum/config/ele-c.json`,
  `${AMBIENTE}/ele2026/${FEDERAL}/dados/br/br-c0001-e${e6(FEDERAL)}-u.json`,
  `${AMBIENTE}/ele2026/${FEDERAL}/dados-simplificados/br/br-c0001-e${e6(FEDERAL)}-r.json`,
  `${AMBIENTE}/ele2026/${FEDERAL}/dados/ce/ce-c0001-e${e6(FEDERAL)}-u.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados/ce/ce-c0003-e${e6(ESTADUAL)}-u.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados-simplificados/ce/ce-c0003-e${e6(ESTADUAL)}-r.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados/ce/ce-c0005-e${e6(ESTADUAL)}-u.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados/ce/ce-c0006-e${e6(ESTADUAL)}-u.json`,
  `${AMBIENTE}/ele2026/${FEDERAL}/dados/ce/ce-c0006-e${e6(FEDERAL)}-u.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados/ce/ce-c0007-e${e6(ESTADUAL)}-u.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados/ce/ce13218-c0003-e${e6(ESTADUAL)}-u.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados/ce/ce13218-c0007-e${e6(ESTADUAL)}-u.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/dados-simplificados/ce/ce13218-c0003-e${e6(ESTADUAL)}-r.json`,
  `${AMBIENTE}/ele2026/${ESTADUAL}/config/mun-e${e6(ESTADUAL)}-cm.json`,
  `${AMBIENTE}/ele2026/${FEDERAL}/config/mun-e${e6(FEDERAL)}-cm.json`,
];

(async () => {
  for (const c of caminhos) {
    try {
      const r = await fetch(`${BASE}/${c}`, { headers: CABECALHOS, signal: AbortSignal.timeout(20000) });
      const texto = await r.text();
      const json = !texto.trimStart().startsWith('<');
      console.log(`${r.status} ${json ? 'JSON' : 'HTML'} ${String(texto.length).padStart(8)}  ${c}`);
      if (r.ok && json) console.log(`    ${texto.slice(0, 500).replace(/\s+/g, ' ')}`);
    } catch (e) {
      console.log(`ERRO ${c}: ${e.message}`);
    }
  }
})();
