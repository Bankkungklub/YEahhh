import { apiClient } from "../api/apiClient.js";
import { createMessage } from "./modalManager.js";

export function createShopPanel({ state, onAccountChanged }) {
  const root = document.createElement("div");
  root.className = "shop-panel";
  renderLoading();
  refresh();

  async function refresh() {
    try {
      const catalog = await apiClient.getCatalog();
      if (catalog.account) {
        state.account = catalog.account;
        onAccountChanged?.(state.account);
      }
      renderCatalog(catalog);
    } catch (error) {
      root.replaceChildren(createMessage(error.message, "error"));
    }
  }

  function renderLoading() {
    root.replaceChildren(createMessage("Loading shop...", "muted"));
  }

  function renderCatalog(catalog) {
    root.replaceChildren();
    const account = catalog.account ?? state.account;
    root.append(createMessage(account ? `Coins: ${account.coins}` : "Log in to buy and equip cosmetics.", account ? "ready" : "muted"));
    const grid = document.createElement("div");
    grid.className = "shop-grid";
    for (const item of catalog.items) {
      const card = document.createElement("article");
      card.className = "shop-card";
      const swatch = document.createElement("span");
      swatch.className = "shop-swatch";
      if (item.slot === "bodyColor" || item.slot === "outlineColor") {
        swatch.style.background = item.value;
      } else {
        swatch.textContent = item.value === "star" ? "*" : "-";
      }
      const name = document.createElement("strong");
      const price = document.createElement("span");
      const action = document.createElement("button");
      name.textContent = item.name;
      price.textContent = item.price === 0 ? "Free" : `${item.price} coins`;
      action.type = "button";
      action.textContent = item.equipped ? "Equipped" : item.owned ? "Equip" : "Buy";
      action.disabled = !account || item.equipped;
      action.addEventListener("click", async () => {
        action.disabled = true;
        try {
          const result = item.owned ? await apiClient.equipItem(item.id) : await apiClient.buyItem(item.id);
          state.account = result.account;
          onAccountChanged?.(state.account);
          await refresh();
        } catch (error) {
          root.prepend(createMessage(error.message, "error"));
          action.disabled = false;
        }
      });
      card.append(swatch, name, price, action);
      grid.append(card);
    }
    root.append(grid);
  }

  return root;
}
