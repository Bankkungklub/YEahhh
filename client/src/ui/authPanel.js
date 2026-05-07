import { apiClient } from "../api/apiClient.js";
import { createMessage } from "./modalManager.js";

export function createAuthPanel({ state, onAccountChanged, close }) {
  const root = document.createElement("div");
  root.className = "auth-panel";

  function renderProfile() {
    root.replaceChildren();
    const account = state.account;
    if (!account) {
      renderForm("login");
      return;
    }
    const summary = createMessage(`Signed in as ${account.username}. Coins: ${account.coins}`, "ready");
    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = "Log Out";
    logout.addEventListener("click", async () => {
      const result = await apiClient.logout();
      state.account = result.account;
      onAccountChanged?.(state.account);
      renderForm("login");
    });
    root.append(summary, logout);
  }

  function renderForm(mode) {
    root.replaceChildren();
    const form = document.createElement("form");
    form.className = "modal-form";
    const message = createMessage(
      mode === "login" ? "Log in to save coins and cosmetics." : "Create an account to persist your shop items.",
      "muted"
    );
    const username = document.createElement("input");
    const password = document.createElement("input");
    const submit = document.createElement("button");
    const switchMode = document.createElement("button");

    username.placeholder = "Username";
    username.autocomplete = "username";
    password.placeholder = "Password";
    password.type = "password";
    password.autocomplete = mode === "login" ? "current-password" : "new-password";
    submit.type = "submit";
    submit.textContent = mode === "login" ? "Log In" : "Register";
    switchMode.type = "button";
    switchMode.className = "secondary-button";
    switchMode.textContent = mode === "login" ? "Create Account" : "Use Existing Account";

    form.append(message, username, password, submit, switchMode);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const result = mode === "login"
          ? await apiClient.login(username.value, password.value)
          : await apiClient.register(username.value, password.value);
        state.account = result.account;
        onAccountChanged?.(state.account);
        close?.();
      } catch (error) {
        message.textContent = error.message;
        message.className = "modal-message error";
      } finally {
        submit.disabled = false;
      }
    });
    switchMode.addEventListener("click", () => renderForm(mode === "login" ? "register" : "login"));
    root.append(form);
  }

  renderProfile();
  return root;
}
