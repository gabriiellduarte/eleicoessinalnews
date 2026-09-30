// Candidatos em destaque: acompanhados pelo número de urna, em qualquer cargo,
// com os votos na disputa inteira (o que decide a eleição) e os votos dentro da cidade.
import { CARGOS } from './ufs.js';

export const lerNumeros = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/)).map(String).filter(Boolean);

// numeros = { presidente: [...], governador: [...], senador: [...], depfederal: [...], depestadual: [...] }
export async function carregarDestaques(fonte, { uf, cidade, numeros }) {
  const itens = [];
  const naoEncontrados = [];
  let referencia = null;
  for (const cargo of Object.keys(CARGOS)) {
    const lista = lerNumeros(numeros?.[cargo]);
    if (!lista.length) continue;
    // Presidente soma o país inteiro; os demais cargos, o estado.
    const ufTotal = CARGOS[cargo].nacional ? 'BR' : uf;
    const [total, local] = await Promise.all([
      fonte.resultado(cargo, ufTotal),
      cidade ? fonte.resultado(cargo, uf, cidade).catch(() => null) : null,
    ]);
    if (!referencia || !CARGOS[cargo].nacional) referencia = total;
    for (const n of lista) {
      const cand = total.candidatos.find((c) => String(c.numero) === n);
      if (!cand) {
        naoEncontrados.push(n);
        continue;
      }
      itens.push({
        cargo,
        cand,
        vagas: total.vagas,
        onde: CARGOS[cargo].nacional ? 'Brasil' : uf,
        naCidade: local?.candidatos.find((c) => String(c.numero) === n) || null,
        cidadeDisponivel: !!local,
      });
    }
  }
  return { itens, naoEncontrados, referencia };
}

export const rotuloCargo = (cargo) => CARGOS[cargo].abreviado || CARGOS[cargo].titulo;
export const textoPosicao = ({ cand, vagas }) => (vagas > 1 ? `${cand.pos}º mais votado (${vagas} vagas)` : `${cand.pos}º colocado`);
