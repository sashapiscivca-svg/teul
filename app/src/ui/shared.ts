// Narrow views of the engine for UI modules, so they can be driven without the whole GameEngine.
import type { Catalog, InventoryEntry, ShopEntry, WalletView } from '../types';

export interface GameEngineLike {
  catalog: Catalog;
  inventory(): InventoryEntry[];
  shop(now?: number): ShopEntry[];
  wallet?(): WalletView;
}

export type { Cost } from '../types';
