export function createModalManager() {
  const overlay = document.createElement("div");
  const panel = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h2");
  const closeButton = document.createElement("button");
  const body = document.createElement("div");

  overlay.className = "modal-overlay hidden";
  panel.className = "modal-panel";
  header.className = "modal-header";
  body.className = "modal-body";
  closeButton.className = "modal-close";
  closeButton.type = "button";
  closeButton.textContent = "X";
  let activeTitle = "";

  header.append(title, closeButton);
  panel.append(header, body);
  overlay.append(panel);
  document.body.append(overlay);

  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && !overlay.classList.contains("hidden")) {
      close();
    }
  });

  function open(nextTitle, content) {
    activeTitle = nextTitle;
    title.textContent = nextTitle;
    body.replaceChildren(content);
    overlay.classList.remove("hidden");
  }

  function close() {
    activeTitle = "";
    overlay.classList.add("hidden");
    body.replaceChildren();
  }

  function isOpen() {
    return !overlay.classList.contains("hidden");
  }

  function getTitle() {
    return activeTitle;
  }

  return { open, close, isOpen, getTitle };
}

export function createMessage(text, tone = "muted") {
  const message = document.createElement("p");
  message.className = `modal-message ${tone}`;
  message.textContent = text;
  return message;
}
