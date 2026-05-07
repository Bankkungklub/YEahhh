import { apiClient } from "../api/apiClient.js";
import { createMessage } from "./modalManager.js";

export function createRoomsPanel({ onJoinRoom, close }) {
  const root = document.createElement("div");
  root.className = "rooms-panel";
  renderLoading();
  refresh();

  async function refresh() {
    try {
      const result = await apiClient.listRooms();
      renderRooms(result.rooms);
    } catch (error) {
      root.replaceChildren(createMessage(error.message, "error"));
    }
  }

  function renderLoading() {
    root.replaceChildren(createMessage("Loading rooms...", "muted"));
  }

  function renderRooms(rooms) {
    root.replaceChildren();
    const createForm = document.createElement("form");
    createForm.className = "modal-form room-create";
    const name = document.createElement("input");
    const create = document.createElement("button");
    name.placeholder = "Custom room name";
    create.type = "submit";
    create.textContent = "Create Room";
    createForm.append(name, create);
    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      create.disabled = true;
      try {
        await apiClient.createRoom(name.value || "Custom Room");
        await refresh();
      } catch (error) {
        root.prepend(createMessage(error.message, "error"));
      } finally {
        create.disabled = false;
      }
    });
    root.append(createForm);

    const list = document.createElement("div");
    list.className = "room-list";
    for (const room of rooms) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "room-row";
      row.textContent = `${room.name} | ${room.players}/${room.maxPlayers} players | ${room.bots} bots`;
      row.disabled = room.players >= room.maxPlayers;
      row.addEventListener("click", () => {
        onJoinRoom?.(room);
        close?.();
      });
      list.append(row);
    }
    root.append(list);
  }

  return root;
}
