import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

export function useRealtime(
  configure: (socket: Socket) => void,
  auth?: Record<string, string>,
  enabled = true,
) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const socket = io({ auth, autoConnect: false });
    let retry: number | undefined;
    const reconnect = () => {
      if (retry !== undefined) return;
      retry = window.setTimeout(() => {
        retry = undefined;
        socket.connect();
      }, 10000);
    };
    socket.on("connect", () => {
      window.clearTimeout(retry);
      retry = undefined;
      setOnline(true);
    });
    socket.on("disconnect", (reason) => {
      setOnline(false);
      if (reason === "io server disconnect") reconnect();
    });
    socket.on("connect_error", () => {
      setOnline(false);
      if (!socket.active) reconnect();
    });
    configure(socket);
    socket.connect();
    return () => {
      window.clearTimeout(retry);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [auth, configure, enabled]);
  return enabled && online;
}
