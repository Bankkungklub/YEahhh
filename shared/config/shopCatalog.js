export const SHOP_CATALOG = Object.freeze([
  { id: "body-blue", slot: "bodyColor", name: "Blue Body", price: 0, value: "#3da9fc" },
  { id: "body-red", slot: "bodyColor", name: "Red Body", price: 80, value: "#f25f4c" },
  { id: "body-green", slot: "bodyColor", name: "Green Body", price: 80, value: "#2cb67d" },
  { id: "body-orange", slot: "bodyColor", name: "Orange Body", price: 100, value: "#ff8906" },
  { id: "body-purple", slot: "bodyColor", name: "Purple Body", price: 120, value: "#7f5af0" },
  { id: "outline-dark", slot: "outlineColor", name: "Dark Outline", price: 0, value: "#1f2933" },
  { id: "outline-white", slot: "outlineColor", name: "White Outline", price: 120, value: "#f7fbff" },
  { id: "outline-gold", slot: "outlineColor", name: "Gold Outline", price: 180, value: "#faae2b" },
  { id: "badge-none", slot: "badge", name: "No Badge", price: 0, value: "none" },
  { id: "badge-star", slot: "badge", name: "Star Badge", price: 220, value: "star" }
]);

export function validateShopCatalog(catalog = SHOP_CATALOG) {
  const issues = [];
  const ids = new Set();
  for (const item of catalog) {
    if (!item.id || ids.has(item.id)) {
      issues.push(`Invalid or duplicate shop item id: ${item.id}`);
    }
    ids.add(item.id);
    if (!["bodyColor", "outlineColor", "badge"].includes(item.slot)) {
      issues.push(`Invalid slot for ${item.id}.`);
    }
    if (!Number.isInteger(item.price) || item.price < 0) {
      issues.push(`Invalid price for ${item.id}.`);
    }
    if ((item.slot === "bodyColor" || item.slot === "outlineColor") && !isHexColor(item.value)) {
      issues.push(`Invalid color value for ${item.id}.`);
    }
  }
  return issues;
}

export function getCatalogItem(itemId, catalog = SHOP_CATALOG) {
  return catalog.find((item) => item.id === itemId) ?? null;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value));
}
