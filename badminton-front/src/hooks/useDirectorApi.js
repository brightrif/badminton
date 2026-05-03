// hooks/useDirectorApi.js
// Used ONLY by director portal pages. Uses authFetch (JWT auth).
// The big screen and umpire pages use plain fetch — they never import this.

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export function useDirectorApi(url, deps = []) {
  const { authFetch } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const refresh = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res  = await authFetch(url);
      const json = await res.json();
      setData(Array.isArray(json) ? json : (json.results ?? json));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url, authFetch]);

  useEffect(() => { refresh(); }, [refresh, ...deps]);
  return { data, loading, error, refresh };
}
