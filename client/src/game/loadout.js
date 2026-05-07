export function getAccountLoadout(account) {
  return account?.loadout ?? {
    bodyColor: "#3da9fc",
    outlineColor: "#1f2933",
    badge: "none"
  };
}
