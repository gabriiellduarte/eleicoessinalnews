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

- O site usa só os dados oficiais do TSE, ao vivo (candidatos zerados até a apuração começar).
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

Mexer o mouse mostra o botão de tela cheia no canto de baixo.

### Painel de controle

- **Cena no ar** e quais cenas entram no rodízio; segundos por cena.
- **Estado**: clique no mapa ou escolha na lista.
- **Cidade**: estado inteiro ou só os votos de uma cidade (vale para todos os cargos). A lista traz todas as
  cidades do estado, com filtro.
- **Candidatos em destaque**: lista oficial do TSE filtrada por cargo (os cinco) e por partido, com filtro de
  nome opcional; clique para incluir ou tirar. A cena mostra os votos de cada um, a posição e os votos na cidade.

### Controle pelo celular

Com o servidor rodando no computador do telão (`iniciar.bat` ou `node server.js`), qualquer aparelho da **mesma rede
Wi-Fi** comanda o telão: abra no celular o endereço que aparece no topo do painel e na janela do servidor, algo como
`http://192.168.0.10:3000/controle`. Cena, estado, cidade, candidatos e rolagem mudam no telão na hora.

- Na primeira vez o Windows pode perguntar se o Node pode usar a rede: marque "Redes privadas" e permita.
- Quem estiver na mesma rede e souber o endereço consegue controlar; use a rede da emissora, não um Wi-Fi aberto.
- **No site publicado na Vercel** o controle também funciona, por qualquer rede: abra `https://SEU-SITE.vercel.app/controle`
  no celular. Lá os aparelhos consultam o estado de 2 em 2 segundos (em vez de receber na hora).
  Para ficar confiável, ligue um banco Redis gratuito: no painel da Vercel, **Storage → Marketplace → Upstash (Redis)**,
  conecte ao projeto e publique de novo. Ele cria sozinho as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`
  (ou `UPSTASH_REDIS_REST_URL`/`_TOKEN`), que o `server.js` já reconhece. Sem o banco, a Vercel pode reiniciar a função e
  o celular e o telão ficarem um tempo sem se enxergar; o painel avisa quando está sem banco.

### Rolar a lista pelo controle

Vale para todos os cargos: nos deputados rola a lista inteira; em Presidente, Governador e Senador rolam os
"Demais candidatos" (os dois primeiros ficam fixos nos cartões grandes), ou a lista inteira no formato
**Lista completa**.

Na seção **Lista no ar** o controle mostra a mesma lista que está no telão. Rolar essa lista com o dedo move a lista
do telão junto (cada duas linhas do controle = uma linha do telão). Presidente, Governador e Senador podem ir ao ar
como **Lista completa** para mostrar todos os candidatos; nos deputados, escolha **Todos** para a lista inteira.

### Fonte dos dados e atualização

Só **TSE oficial, ao vivo**: a tela busca os arquivos do TSE a cada 10 segundos.

### Listas de deputados

Quantidade: 10, 20, 30, 50, todas as vagas ou só os escolhidos. Acima de 10 nomes: páginas de 10, rolagem
automática (sobe devagar e recomeça) ou rolagem manual (setas ▲ ▼ no controle). A cena fica no ar até a lista passar.

Parâmetros de URL do telão: `?uf=CE`, `?cidade=Aracati`, `?tempo=15`, `?cena=destaques`.

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

## Conectar os resultados do TSE

Tudo em `public/js/config.js`:

1. `tse.eleicao`: já preenchido com `6257` (Eleição Geral Federal) e `6259` (Eleições Gerais Estaduais).
2. `tse.ambiente`: `oficial`.

Enquanto o TSE não começa a totalizar, o site mostra os candidatos oficiais com zero voto e o aviso
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
