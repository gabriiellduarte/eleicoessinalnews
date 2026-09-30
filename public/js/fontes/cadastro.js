// Cadastro oficial do TSE (Dados Abertos + DivulgaCandContas) servido pelo server.js em /api/cadastro:
// candidatos registrados em 2026 e municípios com o código TSE.
import { CONFIG } from '../config.js';

const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du']);

// O TSE publica tudo em maiúsculas: "JUAZEIRO DO NORTE" → "Juazeiro do Norte".
export function nomeProprio(s) {
  return String(s ?? '')
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.replace(/(^|[-'.(])\p{L}/gu, (m) => m.toUpperCase())))
    .join(' ');
}

const pedidos = new Map();

function buscar(caminho) {
  if (!pedidos.has(caminho)) {
    const pedido = fetch(`${CONFIG.cadastro.base}/${caminho}`).then((r) => {
      if (!r.ok) throw new Error(`Cadastro do TSE indisponível (${caminho}).`);
      return r.json();
    });
    pedidos.set(caminho, pedido);
    // Falha não fica em cache: a próxima consulta tenta de novo.
    pedido.catch(() => pedidos.delete(caminho));
  }
  return pedidos.get(caminho);
}

export const cadastro = {
  // Presidente é sempre uf = 'BR'.
  async candidatos(cargo, uf) {
    const lista = await buscar(`candidatos/${uf}/${cargo}`);
    return lista.map((c) => ({
      numero: String(c.numero),
      nome: nomeProprio(c.nome),
      partido: c.partido,
      vice: nomeProprio(c.vice),
      foto: `${CONFIG.cadastro.base}/foto/${uf}/${c.id}`,
    }));
  },
  // { numero: nome do vice }
  async vices(cargo, uf) {
    const v = await buscar(`vices/${uf}/${cargo}`);
    return Object.fromEntries(Object.entries(v).map(([n, nome]) => [n, nomeProprio(nome)]));
  },
  // [{ nome, codigo }]
  async municipios(uf) {
    return (await buscar(`municipios/${uf}`)).map((m) => ({ nome: nomeProprio(m.nome), codigo: m.codigo }));
  },
};
