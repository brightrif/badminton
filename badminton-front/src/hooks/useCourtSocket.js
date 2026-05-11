// src/hooks/useCourtSocket.js

import { useEffect, useRef, useState } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
const MAX_RETRIES = 15;

export function useCourtSocket(slug) {
  const [breakMode, setBreakMode] = useState(false);
  const [breakDisplayMode, setBreakDisplayMode] = useState("sponsors"); // "sponsors" | "video"
  const [breakVideoUrl, setBreakVideoUrl] = useState("");
  const [breakTournament, setBreakTournament] = useState("");
  const [breakSponsors, setBreakSponsors] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef(null);
  const cancelledRef = useRef(false);
  const retriesRef = useRef(0);
  const reconnectTimer = useRef(null);
  const slugRef = useRef(slug);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    cancelledRef.current = false;
    retriesRef.current = 0;

    const connectTimer = setTimeout(connect, 0);

    function connect() {
      if (cancelledRef.current) return;

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(`${WS_BASE}/ws/court/${slugRef.current}/`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelledRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        retriesRef.current = 0;
      };

      ws.onmessage = (evt) => {
        if (cancelledRef.current) return;
        let data;
        try {
          data = JSON.parse(evt.data);
        } catch {
          return;
        }

        if (data.type === "break_mode") {
          setBreakMode(data.active ?? false);
          setBreakDisplayMode(data.display_mode ?? "sponsors");
          setBreakVideoUrl(data.video_url ?? "");
          setBreakTournament(data.tournament_name ?? "");
          setBreakSponsors(Array.isArray(data.sponsors) ? data.sponsors : []);
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (cancelledRef.current) return;
        wsRef.current = null;
        setIsConnected(false);
        if (retriesRef.current < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
          retriesRef.current += 1;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };
    }

    return () => {
      cancelledRef.current = true;
      clearTimeout(connectTimer);
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [slug]);

  return {
    breakMode,
    breakDisplayMode,
    breakVideoUrl,
    breakTournament,
    breakSponsors,
    isConnected,
  };
}
