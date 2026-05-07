import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { SHOP_CATALOG, getCatalogItem } from "../../shared/config/shopCatalog.js";
import { normalizeAccountCosmetics } from "../../shared/sim/cosmetics.js";
import { clonePublicAccount } from "./accountStore.js";

export class ShopService {
  constructor({ store, config = APP_CONFIG, catalog = SHOP_CATALOG }) {
    this.store = store;
    this.config = config;
    this.catalog = catalog;
  }

  getCatalog(account = null) {
    const publicAccount = account?.id ? clonePublicAccount(this.store.getAccountById(account.id) ?? account) : null;
    const inventory = new Set(publicAccount?.inventory ?? []);
    const equipped = publicAccount?.equipped ?? {};
    return {
      account: publicAccount,
      items: this.catalog.map((item) => ({
        ...item,
        owned: inventory.has(item.id),
        equipped: equipped[item.slot] === item.id
      }))
    };
  }

  buyItem(accountId, itemId) {
    const item = getCatalogItem(itemId, this.catalog);
    if (!item) {
      throwHttp(404, "Item not found.");
    }
    return this.store.updateAccount(accountId, (account) => {
      if (account.inventory.includes(item.id)) {
        return;
      }
      if (account.coins < item.price) {
        throwHttp(409, "Not enough coins.");
      }
      account.coins -= item.price;
      account.inventory.push(item.id);
    });
  }

  equipItem(accountId, itemId) {
    const item = getCatalogItem(itemId, this.catalog);
    if (!item) {
      throwHttp(404, "Item not found.");
    }
    return this.store.updateAccount(accountId, (account) => {
      if (!account.inventory.includes(item.id)) {
        throwHttp(409, "Item is not owned.");
      }
      account.equipped[item.slot] = item.id;
      const cosmetics = normalizeAccountCosmetics(account, this.config, this.catalog);
      account.inventory = cosmetics.inventory;
      account.equipped = cosmetics.equipped;
    });
  }

  getDebugState() {
    return {
      catalogItems: this.catalog.length,
      slots: [...new Set(this.catalog.map((item) => item.slot))]
    };
  }
}

function throwHttp(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
