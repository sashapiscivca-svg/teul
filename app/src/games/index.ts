// Every table game by its id.
import { BACKGAMMON } from './backgammon';
import { CHECKERS } from './checkers';
import { CHESS } from './chess';
import { DOMINOES } from './dominoes';
import { DURAK } from './durak';
import type { GameId, Rules } from './types';

export const GAMES: Record<GameId, Rules<any, any>> = { chess: CHESS, checkers: CHECKERS, backgammon: BACKGAMMON, durak: DURAK, dominoes: DOMINOES };
export const GAME_IDS = Object.keys(GAMES) as GameId[];
