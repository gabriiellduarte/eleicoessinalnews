# Apuração Eleições 2026 · Sinal News


Cargos: Presidente, Governador, Senador, Deputado Federal e Deputado Estadual (Distrital no DF),
no país, por estado e por cidade.

## Rodar

Precisa apenas do Node 18 ou superior, sem instalar dependências.

```bash
node server.js
```

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
O `server.js` busca os arquivos em `resultados.tse.jus.br` pelo caminho `/api/tse/...`, com cache de 20 s,
então o público nunca consulta o TSE diretamente.

O conector (`public/js/fontes/tse.js`) entende os layouts de 2022 e de 2024 e tenta os dois.
**O layout de 2026 ainda não foi publicado**; se vier diferente, o ajuste fica nas funções `urls()` e `normalizar()`
desse arquivo. O resultado **por cidade** usa o código TSE do município, que já vem do cadastro; o nome do
arquivo municipal de 2026 é a parte que falta confirmar.
O conector tenta cada cargo nas duas eleições (federal e estadual), caso o TSE distribua os cargos de outro jeito.

## Logo

A logo está em `public/assets/logo-sinal-news.webp`. Para trocar, substitua o arquivo ou ajuste `logo` em `config.js`.
