// Every word table of the client. Each area keeps its own file (keys are prefixed by the area or file they serve).
import type { Table } from './types';
import { NAMES } from './names';
import { GAME } from './game';
import { SHEETS } from './sheets';
import { PANELS } from './panels';
import { WORLD } from './world';
import { SETTINGS } from './settings';
import { PLATFORM } from './platform';

export const TABLES: Readonly<Record<string, Table>> = { NAMES, GAME, SHEETS, PANELS, WORLD, SETTINGS, PLATFORM };
