export function updateAccountHud(loginButton, account) {
  if (!loginButton) {
    return;
  }
  loginButton.textContent = account
    ? `${account.isDeveloper ? "DEV " : ""}${account.username} ${account.coins}`
    : "Log In";
}
