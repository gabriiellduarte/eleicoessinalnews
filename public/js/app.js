// Página pública da apuração.
import { CONFIG } from './config.js';
import { UFS, UF_POR_SIGLA, CARGOS, REGIOES, ufsDaRegiao, nomeLocal, tituloCargo, semAcento } from './ufs.js';
import { fonte } from './fontes/index.js';
import { carregarDestaques, rotuloCargo, textoPosicao } from './destaques.js';
import { montarLogo, coresPara, criarLista, criarMapa, criarMenuMapa, preencherStats, classeSituacao, esc, fmt, resumoDefinicao } from './ui.js';

const $ = (id) => document.getElementById(id);
const LIMITE_LISTA = 30;
const estado = { cargo: 'presidente', uf: 'BR', cidade: '', regiao: '', busca: '' };
let atualizarLista = criarLista($('lista'));
const atualizarMapa = criarMapa($('mapa'), (uf, e) => (CARGOS[estado.cargo].nacional ? abrirMenuMapa(uf, e) : selecionar(estado.cargo, uf)));
let pedido = 0;
let ultimo = null; // último resultado recebido, para a busca filtrar sem nova consulta

montarLogo($('logo'));
$('turno').textContent = CONFIG.turno;
$('fonte-dados').textContent = 'Fonte: Tribunal Superior Eleitoral (TSE).';

$('abas').innerHTML = Object.entries(CARGOS)
  .map(([id, c]) => `<button role="tab" data-cargo="${id}">${c.titulo}</button>`)
  .join('');
$('abas').addEventListener('click', (e) => {
  const cargo = e.target.dataset?.cargo;
  if (!cargo) return;
  const mantemLocal = estado.uf !== 'BR';
  if (CARGOS[cargo].nacional && !estado.cidade) selecionar(cargo, 'BR');
  else selecionar(cargo, mantemLocal ? estado.uf : CONFIG.ufDestaque, mantemLocal ? estado.cidade : '');
});
// Valores "R:NE" no seletor são regiões; o resto, siglas de estado.
$('uf').addEventListener('change', (e) => {
  const v = e.target.value;
  if (v.startsWith('R:')) selecionar(estado.cargo, 'BR', '', v.slice(2));
  else selecionar(estado.cargo, v);
});

// Presidente: clicar num estado do mapa pergunta se é para ver o estado ou a região dele.
const menuMapa = criarMenuMapa($('mapa-area'), (valor) => {
  if (valor.startsWith('R:')) selecionar(estado.cargo, 'BR', '', valor.slice(2));
  else selecionar(estado.cargo, valor);
});
$('mapa-voltar').addEventListener('click', () => selecionar(estado.cargo, 'BR'));
function abrirMenuMapa(uf, e) {
  const u = UF_POR_SIGLA[uf];
  menuMapa.abrir(e, u.nome, [
    { rotulo: `Ver estado: ${u.nome}`, valor: uf },
    { rotulo: `Ver Região ${REGIOES[u.regiao]}`, valor: `R:${u.regiao}` },
  ]);
}
$('cidade').addEventListener('change', (e) => selecionar(estado.cargo, ufDasCidades(estado.uf), e.target.value));
$('busca').addEventListener('input', (e) => {
  estado.busca = e.target.value;
  if (ultimo) desenhar(ultimo);
});

// Com "Brasil" selecionado, a lista oferece as cidades do estado da emissora.
const ufDasCidades = (uf) => (uf === 'BR' ? CONFIG.ufDestaque : uf);

// A lista de cidades fica sempre visível; escolher uma cidade leva ao estado dela.
async function preencherCidades(uf) {
  const sel = $('cidade');
  const ufLista = ufDasCidades(uf);
  const nome = UF_POR_SIGLA[ufLista].nome;
  if (sel.dataset.uf !== ufLista) {
    sel.dataset.uf = ufLista;
    sel.innerHTML = `<option value="">Carregando cidades · ${esc(nome)}…</option>`;
    let lista = null;
    try {
      lista = await fonte.cidades(ufLista);
    } catch {}
    if (sel.dataset.uf !== ufLista) return;
    sel.innerHTML = lista?.length
      ? `<option value="">Cidades · ${esc(nome)} (${lista.length})</option>` + lista.map((c) => `<option>${esc(c)}</option>`).join('')
      : `<option value="">Cidades de ${esc(nome)} indisponíveis</option>`;
    if (!lista?.length) delete sel.dataset.uf; // tenta de novo na próxima troca
  }
  sel.value = estado.cidade;
}

function selecionar(cargo, uf, cidade = '', regiao = '') {
  const c = CARGOS[cargo];
  if (!c.nacional) regiao = ''; // regiões só para Presidente
  Object.assign(estado, { cargo, uf, cidade, regiao, busca: '' });
  menuMapa.fechar();
  document.querySelectorAll('#abas button').forEach((b) => b.setAttribute('aria-selected', b.dataset.cargo === cargo));
  $('uf').innerHTML =
    (c.nacional
      ? '<option value="BR">Brasil</option><optgroup label="Regiões">' +
        Object.entries(REGIOES).map(([sigla, nome]) => `<option value="R:${sigla}">Região ${nome}</option>`).join('') +
        '</optgroup><optgroup label="Estados">'
      : '') +
    [...UFS].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((u) => `<option value="${u.sigla}">${u.nome}</option>`).join('') +
    (c.nacional ? '</optgroup>' : '');
  $('uf').value = regiao ? `R:${regiao}` : uf;
  preencherCidades(uf);
  $('titulo').textContent = tituloCargo(cargo, uf);
  $('local').textContent = regiao ? `Região ${REGIOES[regiao]}` : nomeLocal(uf, cidade);
  $('busca').value = '';
  $('mapa-titulo').textContent = c.nacional ? 'Quem lidera em cada estado' : 'Andamento da apuração por estado';
  $('mapa-dica').hidden = !c.nacional;
  $('mapa-voltar').hidden = !regiao;
  if (c.nacional) $('mapa-titulo').textContent = regiao ? `Região ${REGIOES[regiao]}: quem lidera em cada estado` : 'Quem lidera em cada estado';
  // Lista nova a cada troca: os candidatos são outros.
  $('lista').innerHTML = '';
  atualizarLista = criarLista($('lista'));
  atualizar();
  atualizarMapaEstados();
}

function desenhar(r) {
  const proporcional = CARGOS[r.cargo].proporcional;
  const eleitos = r.candidatos.filter((c) => c.eleito).length;
  let lista = r.candidatos;
  const busca = semAcento(estado.busca);
  if (busca) lista = lista.filter((c) => semAcento(c.nome).includes(busca) || String(c.numero).includes(busca));
  // Deputados: quantos aparecem é escolha do leitor ("vagas" = número de cadeiras do estado).
  const quantos = $('quantos').value;
  const limite = quantos === 'todos' ? Infinity : quantos === 'vagas' ? r.vagas : Number(quantos) || LIMITE_LISTA;
  if (proporcional) lista = lista.slice(0, limite);
  atualizarLista(lista, coresPara(`${r.cargo}|${r.uf}`, r.candidatos), proporcional ? { teto: r.candidatos[0]?.pct } : undefined);
  $('quantos').hidden = !proporcional;
  $('nota-lista').hidden = !proporcional;
  $('nota-lista').textContent = busca
    ? `${lista.length} resultado(s) para "${estado.busca}"`
    : `Mostrando ${lista.length} de ${fmt.int(r.candidatos.length)} candidatos · ${r.vagas} vagas.${eleitos ? ` ${eleitos} de ${r.vagas} eleitos.` : ''}`;
  const definicao = proporcional ? null : resumoDefinicao(r.candidatos);
  $('faixa-resultado').hidden = !definicao;
  if (definicao) {
    $('faixa-resultado').className = `faixa-resultado ${definicao.classe}`;
    $('faixa-resultado').textContent = definicao.texto;
  }
}
$('quantos').addEventListener('change', () => ultimo && desenhar(ultimo));

async function atualizar() {
  const meu = ++pedido;
  const { cargo, uf, cidade, regiao } = estado;
  try {
    const r = regiao ? await fonte.regiao(cargo, regiao) : await fonte.resultado(cargo, uf, cidade);
    if (meu !== pedido) return;
    $('erro').hidden = !r.aguardando;
    $('erro').textContent = 'Aguardando o início da totalização pelo TSE. Os candidatos abaixo são os registrados oficialmente, em ordem alfabética.';
    ultimo = r;
    desenhar(r);
    preencherStats(document, r);
  } catch (e) {
    if (meu !== pedido) return;
    $('erro').hidden = false;
    $('erro').textContent = `Aguardando dados do TSE. ${e.message}`;
  }
}

// Região escolhida: o mapa mostra só os estados dela, aproximados.
const selecaoNoMapa = () => (estado.regiao ? { foco: ufsDaRegiao(estado.regiao) } : { selecionada: estado.uf });

async function atualizarMapaEstados() {
  const { cargo } = estado;
  const nacional = CARGOS[cargo].nacional;
  try {
    // Fora de Presidente o mapa só mostra o andamento das seções, igual para todos os
    // cargos do estado: usa Governador, que tem os arquivos mais leves.
    const [mapa, br] = await Promise.all([fonte.mapa(nacional ? cargo : 'governador'), nacional ? fonte.resultado(cargo, 'BR') : null]);
    if (cargo !== estado.cargo) return;
    const cor = br ? coresPara(`${cargo}|BR`, br.candidatos) : null;
    atualizarMapa(mapa, { modo: nacional ? 'lider' : 'progresso', cor, ...selecaoNoMapa() });
    $('legenda').innerHTML = br
      ? br.candidatos.slice(0, 4).map((c) => `<span><i style="--cor:${cor(c.numero)}"></i>${esc(c.nome)}</span>`).join('')
      : '<span><i style="--cor:#D90404"></i>Quanto mais forte a cor, mais seções totalizadas</span>';
  } catch {
    atualizarMapa(null, selecaoNoMapa());
    $('legenda').textContent = '';
  }
}

// Candidatos em destaque definidos no config.js (ex.: os deputados de Aracati).
async function atualizarDestaques() {
  const uf = CONFIG.ufDestaque;
  const cidade = CONFIG.destaques.cidade;
  try {
    const { itens } = await carregarDestaques(fonte, { uf, cidade, numeros: CONFIG.destaques });
    $('destaques').hidden = !itens.length;
    $('destaques-titulo').textContent = CONFIG.destaques.titulo || `Candidatos de ${cidade}`;
    $('destaques-lista').innerHTML = itens
      .map((item) => {
        const { cargo, cand, onde, naCidade } = item;
        return `
        <li>
          <div>
            <strong>${esc(cand.nome)}</strong> <span class="sit ${classeSituacao(cand)}">${esc(cand.situacao || '')}</span>
            <small>${esc(rotuloCargo(cargo))} · ${esc(cand.partido)} · ${esc(cand.numero)} · ${textoPosicao(item)}</small>
          </div>
          <div class="dest-num">
            <b>${fmt.int(cand.votos)}</b>
            <small>${naCidade ? `${fmt.int(naCidade.votos)} em ${esc(cidade)}` : esc(onde)}</small>
          </div>
        </li>`;
      })
      .join('');
  } catch {
    $('destaques').hidden = true;
  }
}

selecionar('presidente', 'BR');
atualizarDestaques();
setInterval(atualizar, fonte.intervaloMs);
// Mapa (27 consultas na fonte TSE) e destaques atualizam em ritmo mais lento.
setInterval(atualizarMapaEstados, 30000);
setInterval(atualizarDestaques, Math.max(3000, fonte.intervaloMs));
