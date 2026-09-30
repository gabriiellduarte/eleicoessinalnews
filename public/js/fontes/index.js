import { CONFIG } from '../config.js';
import { simulador } from './simulador.js';
import { tse } from './tse.js';

// As duas fontes expõem: id, intervaloMs, resultado(cargo, uf) e mapa(cargo).
export const fonte = CONFIG.fonte === 'tse' ? tse : simulador;
