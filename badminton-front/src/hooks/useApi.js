import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export function useApi(url, deps = []) {
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
