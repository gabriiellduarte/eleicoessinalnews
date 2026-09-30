// Unidades da Federação. `eleitorado` é aproximado (usado só pela simulação);
// `col`/`lin` posicionam o estado no mapa em blocos; `federais` = cadeiras na Câmara.
export const UFS = [
  { sigla: 'RR', nome: 'Roraima', capital: 'Boa Vista', regiao: 'N', eleitorado: 370000, federais: 8, col: 1, lin: 0 },
  { sigla: 'AP', nome: 'Amapá', capital: 'Macapá', regiao: 'N', eleitorado: 550000, federais: 8, col: 2, lin: 0 },
  { sigla: 'AM', nome: 'Amazonas', capital: 'Manaus', regiao: 'N', eleitorado: 2650000, federais: 8, col: 1, lin: 1 },
  { sigla: 'PA', nome: 'Pará', capital: 'Belém', regiao: 'N', eleitorado: 6080000, federais: 17, col: 2, lin: 1 },
  { sigla: 'MA', nome: 'Maranhão', capital: 'São Luís', regiao: 'NE', eleitorado: 5040000, federais: 18, col: 3, lin: 1 },
  { sigla: 'CE', nome: 'Ceará', capital: 'Fortaleza', regiao: 'NE', eleitorado: 6820000, federais: 22, col: 4, lin: 1 },
  { sigla: 'RN', nome: 'Rio Grande do Norte', capital: 'Natal', regiao: 'NE', eleitorado: 2550000, federais: 8, col: 5, lin: 1 },
  { sigla: 'AC', nome: 'Acre', capital: 'Rio Branco', regiao: 'N', eleitorado: 590000, federais: 8, col: 0, lin: 2 },
  { sigla: 'RO', nome: 'Rondônia', capital: 'Porto Velho', regiao: 'N', eleitorado: 1230000, federais: 8, col: 1, lin: 2 },
  { sigla: 'TO', nome: 'Tocantins', capital: 'Palmas', regiao: 'N', eleitorado: 1090000, federais: 8, col: 2, lin: 2 },
  { sigla: 'PI', nome: 'Piauí', capital: 'Teresina', regiao: 'NE', eleitorado: 2570000, federais: 10, col: 3, lin: 2 },
  { sigla: 'PE', nome: 'Pernambuco', capital: 'Recife', regiao: 'NE', eleitorado: 7020000, federais: 25, col: 4, lin: 2 },
  { sigla: 'PB', nome: 'Paraíba', capital: 'João Pessoa', regiao: 'NE', eleitorado: 3090000, federais: 12, col: 5, lin: 2 },
  { sigla: 'MT', nome: 'Mato Grosso', capital: 'Cuiabá', regiao: 'CO', eleitorado: 2470000, federais: 8, col: 1, lin: 3 },
  { sigla: 'GO', nome: 'Goiás', capital: 'Goiânia', regiao: 'CO', eleitorado: 4870000, federais: 17, col: 2, lin: 3 },
  { sigla: 'BA', nome: 'Bahia', capital: 'Salvador', regiao: 'NE', eleitorado: 11290000, federais: 39, col: 3, lin: 3 },
  { sigla: 'SE', nome: 'Sergipe', capital: 'Aracaju', regiao: 'NE', eleitorado: 1670000, federais: 8, col: 4, lin: 3 },
  { sigla: 'AL', nome: 'Alagoas', capital: 'Maceió', regiao: 'NE', eleitorado: 2330000, federais: 9, col: 5, lin: 3 },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', capital: 'Campo Grande', regiao: 'CO', eleitorado: 1990000, federais: 8, col: 1, lin: 4 },
  { sigla: 'DF', nome: 'Distrito Federal', capital: 'Brasília', regiao: 'CO', eleitorado: 2200000, federais: 8, col: 2, lin: 4 },
  { sigla: 'MG', nome: 'Minas Gerais', capital: 'Belo Horizonte', regiao: 'SE', eleitorado: 16290000, federais: 53, col: 3, lin: 4 },
  { sigla: 'ES', nome: 'Espírito Santo', capital: 'Vitória', regiao: 'SE', eleitorado: 2920000, federais: 10, col: 4, lin: 4 },
  { sigla: 'SP', nome: 'São Paulo', capital: 'São Paulo', regiao: 'SE', eleitorado: 34670000, federais: 70, col: 2, lin: 5 },
  { sigla: 'RJ', nome: 'Rio de Janeiro', capital: 'Rio de Janeiro', regiao: 'SE', eleitorado: 12830000, federais: 46, col: 3, lin: 5 },
  { sigla: 'PR', nome: 'Paraná', capital: 'Curitiba', regiao: 'S', eleitorado: 8480000, federais: 30, col: 2, lin: 6 },
  { sigla: 'SC', nome: 'Santa Catarina', capital: 'Florianópolis', regiao: 'S', eleitorado: 5490000, federais: 16, col: 2, lin: 7 },
  { sigla: 'RS', nome: 'Rio Grande do Sul', capital: 'Porto Alegre', regiao: 'S', eleitorado: 8590000, federais: 31, col: 2, lin: 8 },
];

export const UF_POR_SIGLA = Object.fromEntries(UFS.map((u) => [u.sigla, u]));

export const nomeLocal = (uf, cidade) => (cidade ? `${cidade} (${uf})` : uf === 'BR' ? 'Brasil' : UF_POR_SIGLA[uf]?.nome || uf);

export const CARGOS = {
  presidente: { titulo: 'Presidente', nacional: true },
  governador: { titulo: 'Governador' },
  senador: { titulo: 'Senador' },
  depfederal: { titulo: 'Deputado Federal', abreviado: 'Dep. Federal', proporcional: true },
  depestadual: { titulo: 'Deputado Estadual', abreviado: 'Dep. Estadual', proporcional: true },
};

export function vagasDe(cargo, uf) {
  const f = UF_POR_SIGLA[uf]?.federais || 8;
  if (cargo === 'depfederal') return f;
  if (cargo === 'depestadual') return f <= 12 ? f * 3 : 36 + (f - 12);
  return cargo === 'senador' ? 2 : 1; // 2026 renova 2/3 do Senado
}

export const tituloCargo = (cargo, uf) => (cargo === 'depestadual' && uf === 'DF' ? 'Deputado Distrital' : CARGOS[cargo].titulo);

export const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
