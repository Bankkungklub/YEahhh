import { APP_CONFIG } from "../config/appConfig.js";
import { SHOP_CATALOG, getCatalogItem } from "../config/shopCatalog.js";

const DEFAULT_LOADOUT = Object.freeze({
  bodyColor: "#3da9fc",
  outlineColor: "#1f2933",
  badge: "none"
});

export function getDefaultInventory(config = APP_CONFIG) {
  return [...config.shop.defaultItems];
}

export function getDefaultEquipped(config = APP_CONFIG, catalog = SHOP_CATALOG) {
  const equipped = {};
  for (const itemId of config.shop.defaultItems) {
    const item = getCatalogItem(itemId, catalog);
    if (item) {
      equipped[item.slot] = item.id;
    }
  }
  return equipped;
}

export function getDefaultLoadout() {
  return { ...DEFAULT_LOADOUT };
}

export function resolveLoadout(equipped = {}, inventory = [], catalog = SHOP_CATALOG) {
  const owned = new Set(inventory);
  const loadout = getDefaultLoadout();

  for (const [slot, itemId] of Object.entries(equipped ?? {})) {
    const item = getCatalogItem(itemId, catalog);
    if (!item || item.slot !== slot || !owned.has(item.id)) {
      continue;
    }
    applyCosmetic(loadout, item);
  }

  return loadout;
}

export function normalizeAccountCosmetics(account, config = APP_CONFIG, catalog = SHOP_CATALOG) {
  const inventory = new Set(Array.isArray(account.inventory) ? account.inventory : []);
  for (const itemId of config.shop.defaultItems) {
    inventory.add(itemId);
  }

  const equipped = { ...getDefaultEquipped(config, catalog), ...(account.equipped ?? {}) };
  for (const [slot, itemId] of Object.entries(equipped)) {
    const item = getCatalogItem(itemId, catalog);
    if (!item || item.slot !== slot || !inventory.has(item.id)) {
      delete equipped[slot];
    }
  }

  return {
    inventory: [...inventory],
    equipped,
    loadout: resolveLoadout(equipped, [...inventory], catalog)
  };
}

export function canEquipItem(account, itemId, catalog = SHOP_CATALOG) {
  const item = getCatalogItem(itemId, catalog);
  return Boolean(item && account?.inventory?.includes(item.id));
}

function applyCosmetic(loadout, item) {
  if (item.slot === "bodyColor") {
    loadout.bodyColor = item.value;
  } else if (item.slot === "outlineColor") {
    loadout.outlineColor = item.value;
  } else if (item.slot === "badge") {
    loadout.badge = item.value;
  }
}
