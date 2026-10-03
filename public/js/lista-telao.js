// Regras de qual lista de candidatos cada cena do telão mostra. Usadas pelo telão
// e pelo painel de controle, que exibe a mesma lista para rolar pelo celular.
import { CARGOS } from './ufs.js';
import { estado, cidadeAtiva } from './estado-telao.js';
import { lerNumeros } from './destaques.js';
import { resumoDefinicao } from './ui.js';

// Presidente, Governador e Senador podem ir ao ar no formato "lista completa",
// que usa o mesmo desenho das cenas de deputados.
export const tipoDaCena = (cena) => (cena.tipo === 'majoritario' && estado.formato === 'lista' ? 'proporcional' : cena.tipo);

// De onde vêm os votos de cada cena, conforme estado/cidade escolhidos no painel.
export function escopoDaCena(cena) {
  const cidade = cidadeAtiva();
  if (cena.tipo === 'mapa') return { uf: 'BR', cidade: '' };
  if (cena.tipo === 'destaques') return { uf: estado.uf, cidade: estado.cidade };
  if (CARGOS[cena.cargo].nacional && estado.abrangencia === 'br') return { uf: 'BR', cidade: '' };
  if (estado.abrangencia === 'regiao') return CARGOS[cena.cargo].nacional ? { uf: 'BR', cidade: '', regiao: estado.regiao } : { uf: estado.uf, cidade: '' };
  return { uf: estado.uf, cidade };
}

// Resultado de um cargo no escopo da cena (estado, cidade ou soma da região).
export const resultadoNoEscopo = (fonte, cargo, { uf, cidade, regiao }) => (regiao ? fonte.regiao(cargo, regiao) : fonte.resultado(cargo, uf, cidade));

// Desenho de cada lista rolável no telão: linhas visíveis de cada vez e candidatos por linha.
export const DESENHO_ROLAGEM = {
  proporcional: { naTela: 5, porLinha: 2 },
  majoritario: { naTela: 4, porLinha: 1 }, // "Demais candidatos", a partir do 3º
};

// Lista que rola em cada tipo de cena (no formato destaque, os dois primeiros ficam fixos).
export function itensRolaveis(tipo, r, cargo) {
  if (tipo === 'majoritario') return { lista: r.candidatos.slice(2), titulo: 'Demais candidatos (a partir do 3º)' };
  return listaDaCena(r, cargo);
}

// Quantos deputados entram na lista conforme a opção do painel.
const LIMITE_DEPUTADOS = { top: 10, top20: 20, top30: 30, top50: 50, todos: Infinity };

// { lista, titulo } da cena em formato de lista, a partir do resultado `r` do cargo.
export function listaDaCena(r, cargo) {
  if (!CARGOS[cargo].proporcional) {
    // No formato lista, a definição (eleito ou 2º turno) vai no título da lista.
    const definicao = resumoDefinicao(r.candidatos);
    return { lista: r.candidatos, titulo: `${r.candidatos.length} candidatos${definicao ? ` · ${definicao.texto}` : ''}` };
  }
  // "Só os escolhidos": apenas os candidatos em destaque deste cargo, com a posição real.
  const numeros = estado.deputados === 'escolhidos' ? lerNumeros(estado.destaques[cargo]) : [];
  const escolhidos = r.candidatos.filter((c) => numeros.includes(String(c.numero)));
  const limite = estado.deputados === 'vagas' ? r.vagas : LIMITE_DEPUTADOS[estado.deputados] || 10;
  const lista = escolhidos.length ? escolhidos : r.candidatos.slice(0, limite);
  const todos = lista.length === r.candidatos.length;
  const rotulo = escolhidos.length ? `${escolhidos.length} candidato(s) escolhido(s)` : todos ? 'Todos os candidatos' : `${lista.length} mais votados`;
  // Quando o TSE começa a definir os eleitos, a contagem entra no título.
  const eleitos = r.candidatos.filter((c) => c.eleito).length;
  const contagem = eleitos ? ` · ${eleitos} de ${r.vagas} eleitos` : '';
  return { lista, titulo: `${rotulo} · ${r.vagas} vagas · ${r.candidatos.length} candidatos${contagem}` };
}
