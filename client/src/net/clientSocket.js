export function createClientSocket({ onOpen, onMessage, onClose, onError }) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}`);
  let pingTimer = 0;

  socket.addEventListener("open", () => {
    pingTimer = window.setInterval(() => {
      send({ type: "ping", t: performance.now() });
    }, 1000);
    onOpen?.();
  });

  socket.addEventListener("message", (event) => {
    try {
      onMessage?.(JSON.parse(event.data));
    } catch {
      onError?.("Received malformed server message.");
    }
  });

  socket.addEventListener("close", (event) => {
    window.clearInterval(pingTimer);
    onClose?.({
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      message: getSocketCloseMessage(event)
    });
  });

  socket.addEventListener("error", () => {
    onError?.("WebSocket connection failed.");
  });

  function send(message) {
    if (socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }

  return {
    join(name, roomId = "") {
      return send({ type: "join", name, roomId });
    },
    input(payload) {
      return send({ type: "input", ...payload });
    },
    upgrade(key) {
      return send({ type: "upgrade", key });
    },
    selectClass(classId) {
      return send({ type: "selectClass", classId });
    },
    respawn() {
      return send({ type: "respawn" });
    },
    close() {
      socket.close();
    },
    isOpen() {
      return socket.readyState === WebSocket.OPEN;
    }
  };
}

export function getSocketCloseMessage(event) {
  if (event?.reason) {
    return event.reason;
  }
  switch (event?.code) {
    case 1000:
    case 1001:
      return "Server connection closed.";
    case 1006:
      return "Connection lost. The server may be restarting.";
    case 1008:
      return "Connection rejected by the server.";
    case 4000:
      return "Connection timed out. Please rejoin.";
    default:
      return "Disconnected from server.";
  }
}
