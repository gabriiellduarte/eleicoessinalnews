// Gera public/js/mapa-brasil.js com o contorno real dos estados, a partir da
// malha oficial do IBGE (API de malhas). Rode de novo só se quiser outro nível de detalhe.
// Uso: node scripts/gerar-mapa.js
const fs = require('fs');
const path = require('path');

const URL_IBGE = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&intrarregiao=UF&qualidade=minima';
const SIGLAS = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' };
const LARGURA = 1000;

(async () => {
  const geo = await (await fetch(URL_IBGE)).json();
  // Projeção simples: longitude encolhida pelo cosseno da latitude média do país.
  const k = Math.cos((15 * Math.PI) / 180);
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
  const poligonos = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
  for (const f of geo.features) for (const pol of poligonos(f.geometry)) for (const [lon, lat] of pol[0]) {
    minX = Math.min(minX, lon * k); maxX = Math.max(maxX, lon * k); minY = Math.min(minY, -lat); maxY = Math.max(maxY, -lat);
  }
  const escala = LARGURA / (maxX - minX);
  const px = ([lon, lat]) => [Math.round((lon * k - minX) * escala * 10) / 10, Math.round((-lat - minY) * escala * 10) / 10];
  const area = (pts) => Math.abs(pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0) / 2);

  const estados = {};
  for (const f of geo.features) {
    const sigla = SIGLAS[String(f.properties.codarea)];
    const aneis = poligonos(f.geometry).map((pol) => pol[0].map(px)).filter((pts) => area(pts) > 3); // descarta ilhotas
    const maior = aneis.reduce((a, b) => (area(b) > area(a) ? b : a));
    // Centro do maior polígono (centroide por área), onde fica a sigla.
    let [cx, cy, soma] = [0, 0, 0];
    maior.forEach((p, i) => {
      const q = maior[(i + 1) % maior.length];
      const cruz = p[0] * q[1] - q[0] * p[1];
      cx += (p[0] + q[0]) * cruz; cy += (p[1] + q[1]) * cruz; soma += cruz;
    });
    estados[sigla] = {
      d: aneis.map((pts) => 'M' + pts.map((p) => p.join(' ')).join('L') + 'Z').join(''),
      centro: [Math.round(cx / (3 * soma)), Math.round(cy / (3 * soma))],
      area: Math.round(area(maior)),
    };
  }
  const altura = Math.ceil((maxY - minY) * escala);
  const saida = `// Contorno dos estados gerado por scripts/gerar-mapa.js a partir da malha do IBGE. Não edite à mão.\nexport const MAPA = ${JSON.stringify({ largura: LARGURA, altura, estados })};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'js', 'mapa-brasil.js'), saida);
  console.log('ok', Object.keys(estados).length, 'estados', LARGURA + 'x' + altura, Math.round(saida.length / 1024) + ' KB');
  console.log(Object.entries(estados).map(([s, e]) => `${s}:${e.centro.join(',')}/${e.area}`).join(' '));
})();
