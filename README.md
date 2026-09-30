# Apuração Eleições 2026 · Sinal News

Apuração de votos ao vivo em três páginas:

- **Público** — `http://localhost:3000/` (responsivo, celular e computador)
- **Telão** — `http://localhost:3000/telao` (16:9, tela cheia, cenas em rodízio)
- **Controle do telão** — `http://localhost:3000/controle` (para o operador, em outro monitor)

Cargos: Presidente, Governador, Senador, Deputado Federal e Deputado Estadual (Distrital no DF),
no país, por estado e por cidade.

## Rodar

Precisa apenas do Node 18 ou superior, sem instalar dependências.

```bash
node server.js
```

## Publicar na Vercel

O projeto já está preparado: a pasta `public/` vira o site e as funções em `api/` fazem o papel do `server.js`
(`vercel.json` cuida das rotas e fixa a região em São Paulo, `gru1`).

```bash
npx vercel
```

Na primeira vez ele pede login e cria o projeto (aceite as opções padrão). Para publicar no endereço definitivo:

```bash
npx vercel --prod
```

- Publicado, o site abre sempre no **modo TSE** (candidatos oficiais zerados até a apuração começar). A simulação
  só aparece com `?fonte=sim` no endereço.
- Na Vercel não há disco permanente: quem segura a carga é o cache da própria rede (20 s para os resultados,
  10 min para candidatos). Se o TSE recusar acessos vindos da Vercel, use o `iniciar.bat` no computador do estúdio
  para o telão.
- Depois de publicar, confira `https://SEU-SITE.vercel.app/api/cadastro/municipios/CE`: deve listar as cidades.

## Telão

Cenas: 1 Presidente, 2 Mapa Brasil, 3 Governador, 4 Senador, 5 Dep. Federal, 6 Dep. Estadual, 7 Destaques.

| Tecla | Ação |
| --- | --- |
| `C` | abre o painel de controle sobre o telão (`Esc` fecha) |
| `←` `→` | trocar de cena |
| `1` a `7` | ir direto para a cena |
| `Espaço` | pausar / retomar o rodízio |
| `F` | tela cheia |
| `H` | ajuda na tela |
| `R`, `+`, `-` | reiniciar / acelerar / desacelerar a simulação |

Mexer o mouse também mostra o botão "Controle" no canto.

### Painel de controle

- **Cena no ar** e quais cenas entram no rodízio; segundos por cena.
- **Estado**: clique no mapa ou escolha na lista.
- **Cidade**: estado inteiro ou só os votos de uma cidade (vale para todos os cargos). A lista traz todas as
  cidades do estado, com filtro.
- **Candidatos em destaque**: lista oficial do TSE filtrada por cargo (os cinco) e por partido, com filtro de
  nome opcional; clique para incluir ou tirar. A cena mostra os votos de cada um, a posição e os votos na cidade.
- **Simulação**: reiniciar e velocidade.

O painel pode ficar em **outra janela** (`/controle`), por exemplo no monitor do operador enquanto o telão
está no projetor. As duas janelas precisam estar **no mesmo navegador do mesmo computador**; as escolhas ficam salvas.

Parâmetros de URL do telão: `?uf=CE`, `?cidade=Aracati`, `?tempo=15`, `?cena=destaques`, `?fonte=tse`.

## Cadastro oficial (candidatos e cidades)

O servidor (`cadastro.js`) baixa o arquivo **Candidatos 2026 do Portal de Dados Abertos do TSE**
(`consulta_cand_2026.zip`, renovado a cada 6 horas) e confere no **DivulgaCandContas** quem continua apto
(o arquivo traz também renúncias e substituídos). Entrega em `/api/cadastro/...`:

- candidatos registrados em 2026 para os cinco cargos, em todos os estados (nome de urna, número, partido, foto e vice);
- todos os municípios de cada estado com o código TSE (Aracati = `13218`).

Só entram candidatos aptos a receber votos. As respostas ficam em cache na memória e na pasta `cache/`:
se o TSE sair do ar, vale a última cópia boa. A lista de candidatos é renovada a cada 15 minutos.
A eleição consultada (`20322002026`, Eleição Geral Federal 2026) está no topo de `cadastro.js`.

## Candidatos em destaque

No painel do telão, escolha o cargo (e o partido, se quiser) e clique nos candidatos da lista oficial.
Para deixar fixo (e aparecer no cartão da página pública), preencha os números de urna no bloco `destaques`
de `public/js/config.js`.

## Simulação

Candidatos e cidades são os **oficiais**; os **votos são fictícios**, sorteados a partir do número de cada
candidato. Não são resultado, pesquisa nem previsão, e a tela mostra o selo "SIMULAÇÃO". Use só para ensaio:
não divulgue a página pública nesse modo.

A apuração vai de 0% a 100% em 8 minutos e recomeça (`sim` em `public/js/config.js`). Nos deputados, a
simulação marca como eleitos os mais votados até o número de vagas (a regra real usa o quociente partidário).
Se o cadastro do TSE estiver inacessível, a simulação cai para nomes fictícios.

## Conectar os resultados do TSE

Tudo em `public/js/config.js`:

1. `fonte: 'tse'` (ou abra as páginas com `?fonte=tse` para testar sem mexer no arquivo)
2. `tse.eleicao`: já preenchido com `6257` (Eleição Geral Federal) e `6259` (Eleições Gerais Estaduais).
3. `tse.ambiente`: `oficial`.

Enquanto o TSE não publica os arquivos, o modo `tse` mostra os candidatos oficiais com zero voto e o aviso
"Aguardando o início da totalização". Quando os arquivos aparecerem, os votos entram sozinhos. Se uma consulta
falhar no meio da apuração, a tela mantém o último resultado bom.

Para ver o que o TSE já publicou:

```bash
node scripts/sondar-tse.js
```

Em 30/09/2026 todos os endereços respondiam 404 (o site de resultados ainda mostrava "Nova versão em breve"),
então os códigos acima e o formato dos arquivos **ainda não foram confirmados na prática**.

O `server.js` busca os arquivos em `resultados.tse.jus.br` pelo caminho `/api/tse/...`, com cache de 20 s,
então o público nunca consulta o TSE diretamente.

O conector (`public/js/fontes/tse.js`) entende os layouts de 2022 e de 2024 e tenta os dois.
**O layout de 2026 ainda não foi publicado**; se vier diferente, o ajuste fica nas funções `urls()` e `normalizar()`
desse arquivo. O resultado **por cidade** usa o código TSE do município, que já vem do cadastro; o nome do
arquivo municipal de 2026 é a parte que falta confirmar.
O conector tenta cada cargo nas duas eleições (federal e estadual), caso o TSE distribua os cargos de outro jeito.

## Logo

A logo está em `public/assets/logo-sinal-news.webp`. Para trocar, substitua o arquivo ou ajuste `logo` em `config.js`.
