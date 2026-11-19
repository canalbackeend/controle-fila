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
    socket.on("connect", () => setOnline(true));
    socket.on("disconnect", () => setOnline(false));
    socket.on("connect_error", () => setOnline(false));
    configure(socket);
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [auth, configure, enabled]);
  return enabled && online;
}
