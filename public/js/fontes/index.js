import { tse } from './tse.js';

// Única fonte de dados: os resultados oficiais do TSE, ao vivo.
// Expõe: id, intervaloMs, resultado(cargo, uf, cidade), regiao(cargo, sigla), mapa(cargo) e cidades(uf).
export const fonte = tse;
