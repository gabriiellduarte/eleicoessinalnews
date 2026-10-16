// Painel de controle do telão. Usado em dois lugares: sobreposto ao próprio
// telão (tecla C) e na página controle.html, aberta em outro monitor.
import { UFS, UF_POR_SIGLA, REGIOES, ufsDaRegiao, semAcento } from './ufs.js';
import { CENAS, estado, definir, aoMudar, restaurarPadrao, rede, aoMudarRede } from './estado-telao.js';
import { criarMapa, criarMenuMapa, esc, fmt } from './ui.js';
import { tipoDaCena, escopoDaCena, itensRolaveis, resultadoNoEscopo, DESENHO_ROLAGEM } from './lista-telao.js';

export function montarPainel(el, fonte) {
  el.classList.add('painel');
  el.innerHTML = `
    <section>
      <h3>Controle pelo celular</h3>
      <p class="p-rede" data-rede></p>
    </section>

    <section>
      <h3>Cena no ar</h3>
      <div class="p-cenas">
        ${CENAS.map((c, i) => `
          <div class="p-cena">
            <button type="button" data-cena="${c.id}"><kbd>${i + 1}</kbd>${esc(c.nome)}</button>
            <label title="Incluir no rodízio automático"><input type="checkbox" data-ativa="${c.id}"> rodízio</label>
          </div>`).join('')}
      </div>
      <div class="p-linha">
        <button type="button" data-acao="rodizio"></button>
        <label>Segundos por cena <input type="number" min="3" max="600" data-campo="tempo"></label>
      </div>
    </section>

    <section>
      <h3>Estado</h3>
      <p class="p-dica">Clique num estado para escolher o estado ou a região dele (a região vale para Presidente).</p>
      <div class="mapa-area p-mapa-area"><div class="p-mapa"></div></div>
      <select data-campo="uf" aria-label="Estado">
        ${[...UFS].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((u) => `<option value="${u.sigla}">${u.nome}</option>`).join('')}
      </select>
    </section>

    <section>
      <h3>Abrangência dos votos</h3>
      <div class="p-linha p-abr">
        <button type="button" data-abr="br">Brasil todo</button>
        <button type="button" data-abr="uf">Só o estado</button>
        <button type="button" data-abr="cidade">Só a cidade</button>
        <button type="button" data-abr="regiao">Só a região</button>
      </div>
      <select data-campo="regiao" aria-label="Região">
        ${Object.entries(REGIOES).map(([sigla, nome]) => `<option value="${sigla}">Região ${nome}</option>`).join('')}
      </select>
      <p class="p-dica">"Brasil todo": Presidente soma o país. "Só o estado": Presidente mostra só os votos do estado. "Só a cidade": Presidente mostra os votos da cidade escolhida abaixo (e o Governador também, se a cidade for de um estado com 2º turno). "Só a região": Presidente soma os votos dos estados da região escolhida. Cada cena de Governador mostra sempre o seu estado.</p>
      <p class="p-atual">Cidade escolhida: <strong data-cidade-atual></strong></p>
      <input type="search" data-filtro-cidade placeholder="Filtrar cidades" aria-label="Filtrar cidades">
      <ul class="p-lista" data-lista="cidades"></ul>
      <p class="p-status" data-status="cidades"></p>
    </section>

    <section>
      <h3>Lista no ar</h3>
      <p class="p-atual">Presidente e Governador:</p>
      <div class="p-linha p-abr">
        <button type="button" data-formato="destaque">2 em destaque</button>
        <button type="button" data-formato="lista">Lista completa</button>
      </div>
      <p class="p-atual">Quando passar de 10 nomes:</p>
      <div class="p-linha p-abr">
        <button type="button" data-lista="paginas">Páginas de 10</button>
        <button type="button" data-lista="rolagem">Rolagem automática</button>
        <button type="button" data-lista="manual">Rolagem manual</button>
      </div>
      <div class="p-linha p-rolar">
        <button type="button" data-rolar="topo" aria-label="Voltar ao início">⏮ Início</button>
        <button type="button" data-rolar="-1" aria-label="Subir">▲ Subir</button>
        <button type="button" data-rolar="1" aria-label="Descer">▼ Descer</button>
      </div>
      <p class="p-dica" data-espelho-aviso></p>
      <ol class="p-espelho" data-espelho></ol>
    </section>

    <section>
      <div class="p-linha">
        <button type="button" data-acao="padrao">Restaurar padrão</button>
      </div>
    </section>`;

  const q = (s) => el.querySelector(s);
  const atualizarMapa = criarMapa(q('.p-mapa'), (uf, e) => {
    const u = UF_POR_SIGLA[uf];
    menuMapa.abrir(e, u.nome, [
      { rotulo: `Ver estado: ${u.nome}`, valor: uf },
      { rotulo: `Ver Região ${REGIOES[u.regiao]} (Presidente)`, valor: `R:${u.regiao}` },
    ]);
  });
  const menuMapa = criarMenuMapa(q('.p-mapa-area'), (valor) => (valor.startsWith('R:') ? escolherRegiao(valor.slice(2)) : trocarUf(valor)));
  const filtro = { cidade: '' };

  // --- cidades ----------------------------------------------------------------
  let cidades = [];
  let ufDasCidades = null;

  async function carregarCidades() {
    const uf = estado.uf;
    ufDasCidades = uf;
    cidades = [];
    q('[data-status="cidades"]').textContent = 'Carregando cidades do TSE…';
    mostrarCidades();
    let lista = [];
    try {
      lista = await fonte.cidades(uf);
    } catch {}
    if (uf !== estado.uf) return;
    cidades = lista;
    if (!lista.length) {
      ufDasCidades = null; // permite nova tentativa
      q('[data-status="cidades"]').innerHTML = 'Não foi possível carregar as cidades do TSE. <button type="button" data-acao="recarregar">Tentar de novo</button>';
    }
    mostrarCidades();
  }

  function mostrarCidades() {
    const texto = semAcento(filtro.cidade);
    // Quem começa com o texto digitado vem primeiro.
    const comeca = (c) => (semAcento(c).startsWith(texto) ? 0 : 1);
    const visiveis = cidades.filter((c) => semAcento(c).includes(texto)).sort((a, b) => comeca(a) - comeca(b));
    q('[data-lista="cidades"]').innerHTML = visiveis
      .map((c) => `<li><button type="button" data-cidade="${esc(c)}" class="${c === estado.cidade ? 'ativo' : ''}">${esc(c)}</button></li>`)
      .join('');
    q('[data-cidade-atual]').textContent = `${estado.cidade || '—'} (${estado.uf})`;
    if (cidades.length) q('[data-status="cidades"]').textContent = `${visiveis.length} de ${cidades.length} cidades de ${UF_POR_SIGLA[estado.uf].nome}`;
  }

  async function trocarUf(uf) {
    // Escolher um estado já põe no ar só os votos dele, sem precisar clicar em "Só o estado".
    // A cidade anterior não pertence ao novo estado: passa a ser a capital.
    if (uf === estado.uf && estado.abrangencia === 'uf') return;
    definir({ uf, abrangencia: 'uf', ...(uf !== estado.uf && { cidade: UF_POR_SIGLA[uf].capital }) });
  }

  // A soma por região só existe para Presidente: se outra cena está no ar, entra a de Presidente.
  function escolherRegiao(regiao) {
    definir({ abrangencia: 'regiao', regiao, ...(estado.cena !== 'presidente' && { cena: 'presidente' }) });
  }

  // --- sincronização com o estado do telão ---------------------------------------
  function sincronizar() {
    el.querySelectorAll('[data-cena]').forEach((b) => b.classList.toggle('ativo', b.dataset.cena === estado.cena));
    el.querySelectorAll('[data-ativa]').forEach((c) => (c.checked = estado.cenasAtivas.includes(c.dataset.ativa)));
    el.querySelectorAll('[data-abr]').forEach((b) => b.classList.toggle('ativo', b.dataset.abr === estado.abrangencia));
    el.querySelectorAll('[data-lista]').forEach((b) => b.classList.toggle('ativo', b.dataset.lista === (estado.lista || 'paginas')));
    q('.p-rolar').hidden = estado.lista !== 'manual';
    el.querySelectorAll('[data-formato]').forEach((b) => b.classList.toggle('ativo', b.dataset.formato === (estado.formato || 'destaque')));
    // Computador do estúdio (localhost ou IP da rede): endereços da rede local.
    // Site publicado (Hostinger, Vercel...): o próprio endereço do site.
    const noEstudio = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
    q('[data-rede]').innerHTML = !rede.ligada
      ? 'Controle remoto indisponível neste endereço: vale apenas entre janelas do mesmo navegador.'
      : noEstudio && rede.enderecos.length
        ? `No celular, na mesma rede Wi-Fi, abra:<br>${rede.enderecos.map((e) => `<strong>${esc(e)}/controle</strong>`).join('<br>')}`
        : `No celular conectado à mesma rede (mesma internet) do telão, abra: <strong>${esc(location.origin)}/controle</strong>`;
    q('[data-acao="rodizio"]').textContent = estado.rodizio ? '❚❚ Pausar rodízio' : '▶ Retomar rodízio';
    q('[data-acao="rodizio"]').classList.toggle('ativo', estado.rodizio);
    const definirValor = (campo, valor) => {
      if (campo !== document.activeElement) campo.value = valor;
    };
    definirValor(q('[data-campo="tempo"]'), estado.tempo);
    definirValor(q('[data-campo="uf"]'), estado.uf);
    definirValor(q('[data-campo="regiao"]'), estado.regiao);
    atualizarMapa(null, estado.abrangencia === 'regiao' ? { foco: ufsDaRegiao(estado.regiao) } : { selecionada: estado.uf });
    if (ufDasCidades !== estado.uf) carregarCidades();
    else mostrarCidades();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !el.contains(b)) return;
    const d = b.dataset;
    if (d.cidade) definir({ cidade: d.cidade, abrangencia: 'cidade' }); // já vai ao ar "Só a cidade"
    else if (d.cena) definir({ cena: d.cena });
    else if (d.abr) definir({ abrangencia: d.abr });
    else if (d.acao === 'rodizio') definir({ rodizio: !estado.rodizio });
    else if (d.acao === 'padrao') restaurarPadrao();
    else if (d.formato) definir({ formato: d.formato, listaPos: 0 });
    else if (d.lista) definir({ lista: d.lista, listaPos: 0 });
    else if (d.rolar) definir({ listaPos: d.rolar === 'topo' ? 0 : Math.max(0, (estado.listaPos || 0) + Number(d.rolar)) });
    sincronizar();
  });

  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.ativa) {
      const ativas = CENAS.map((c) => c.id).filter((id) => (id === t.dataset.ativa ? t.checked : estado.cenasAtivas.includes(id)));
      definir({ cenasAtivas: ativas });
    } else if (t.dataset.campo === 'tempo') definir({ tempo: Math.min(600, Math.max(3, Number(t.value) || 15)) });
    else if (t.dataset.campo === 'uf') trocarUf(t.value);
    else if (t.dataset.campo === 'regiao') escolherRegiao(t.value);
  });

  // Os filtros de texto agem a cada tecla.
  el.addEventListener('input', (e) => {
    const t = e.target;
    if ('filtroCidade' in t.dataset) {
      filtro.cidade = t.value;
      mostrarCidades();
    }
  });

  // As teclas digitadas nos campos não devem acionar os atalhos do telão.
  el.addEventListener('keydown', (e) => e.stopPropagation());

  // --- lista no ar: a mesma lista do telão, para rolar pelo controle ------------------
  // Rolar esta lista move a do telão (nos deputados, uma linha do telão = dois candidatos daqui).
  const ALTURA_ITEM = 44;
  const espelho = q('[data-espelho]');
  let rolandoPorCodigo = false;
  let ultimoEnvio = 0;
  let envioPendente = null;

  let porLinha = 2; // candidatos por linha do telão na lista que está no ar

  async function atualizarEspelho() {
    const cena = CENAS.find((c) => c.id === estado.cena);
    const aviso = q('[data-espelho-aviso]');
    const tipo = cena && tipoDaCena(cena);
    if (!DESENHO_ROLAGEM[tipo]) {
      espelho.innerHTML = '';
      aviso.textContent = 'A cena no ar não tem lista para rolar (mapa ou destaques).';
      return;
    }
    const { cargo } = cena;
    let r;
    try {
      r = await resultadoNoEscopo(fonte, cargo, escopoDaCena(cena));
    } catch {
      aviso.textContent = 'Não foi possível carregar a lista.';
      return;
    }
    if (cena.id !== estado.cena) return;
    const { lista, titulo } = itensRolaveis(tipo, r, cargo);
    const desenho = DESENHO_ROLAGEM[tipo];
    porLinha = desenho.porLinha;
    const linhas = Math.ceil(lista.length / porLinha);
    const sobre = titulo;
    aviso.textContent = linhas > desenho.naTela ? `${sobre}. Role a lista abaixo para mover o telão.` : `${sobre}. Cabem todos na tela; não há o que rolar.`;
    espelho.dataset.porLinha = porLinha;
    espelho.innerHTML = lista
      .map((c) => `<li><b>${c.pos}º</b><span>${esc(c.nome)}<small>${esc(c.partido)} · ${esc(c.numero)}</small></span><em>${fmt.int(c.votos)}</em></li>`)
      .join('');
    posicionarEspelho();
  }

  // Leva a lista do controle até a linha que está no topo do telão.
  function posicionarEspelho() {
    if (estado.lista !== 'manual') return;
    const alvo = (estado.listaPos || 0) * porLinha * ALTURA_ITEM;
    if (Math.abs(espelho.scrollTop - alvo) < ALTURA_ITEM) return;
    rolandoPorCodigo = true;
    espelho.scrollTop = alvo;
    setTimeout(() => (rolandoPorCodigo = false), 100);
  }

  espelho.addEventListener('scroll', () => {
    if (rolandoPorCodigo) return;
    const linha = Math.round(espelho.scrollTop / (porLinha * ALTURA_ITEM));
    const enviar = () => {
      envioPendente = null;
      ultimoEnvio = Date.now();
      if (estado.lista !== 'manual' || estado.listaPos !== linha) definir({ lista: 'manual', listaPos: linha });
    };
    // No máximo um envio a cada 150 ms enquanto o dedo arrasta.
    clearTimeout(envioPendente);
    if (Date.now() - ultimoEnvio > 150) enviar();
    else envioPendente = setTimeout(enviar, 150);
  });
  setInterval(atualizarEspelho, Math.max(3000, fonte.intervaloMs));

  aoMudar((e, alteracao, remoto) => {
    // Só a posição da rolagem mudou: basta acompanhar a lista (redesenhar o painel travaria o dedo).
    if (Object.keys(alteracao).every((k) => k === 'listaPos' || k === 'lista')) {
      el.querySelectorAll('[data-lista]').forEach((b) => b.classList.toggle('ativo', b.dataset.lista === estado.lista));
      q('.p-rolar').hidden = estado.lista !== 'manual';
      return posicionarEspelho();
    }
    sincronizar();
    atualizarEspelho();
  });
  aoMudarRede(sincronizar);
  sincronizar();
  atualizarEspelho();
}
