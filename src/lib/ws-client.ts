export function createBrowserSocket(onMessage: (event: unknown) => void): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  socket.addEventListener("message", (event) => {
    onMessage(JSON.parse(event.data as string));
  });

  return socket;
}
