// src/hooks/usePlayerSearch.js
//
// Shared hook for searching players via the API.
// Used by: Players.jsx (paginated load-more), Manage Players panel, Manage Teams panel.
//
// Usage:
//   const { results, loading, search, setSearch, loadMore, hasMore, total } = usePlayerSearch();
//   const { results, loading, search, setSearch } = usePlayerSearch({ debounceMs: 300, pageSize: 20 });

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";

export function usePlayerSearch({
  debounceMs = 300,
  pageSize = 50,
  autoLoad = true, // load first page on mount (Players page behaviour)
} = {}) {
  const { authFetch } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextUrl, setNextUrl] = useState(null);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef(null);

  // ── Core fetch ──────────────────────────────────────────────────────────────
  const fetchPage = useCallback(
    async (url) => {
      setLoading(true);
      try {
        const res = await authFetch(url);
        const data = await res.json();

        if (Array.isArray(data)) {
          // Non-paginated response
          setResults(data);
          setNextUrl(null);
          setTotal(data.length);
        } else {
          // Paginated response { count, next, results }
          setResults((prev) =>
            url.includes("offset=0") || !url.includes("offset")
              ? data.results || []
              : [...prev, ...(data.results || [])],
          );
          setNextUrl(data.next || null);
          setTotal(data.count || 0);
        }
      } catch {
        // silently fail — UI shows empty state
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  // ── Build initial URL from search term ─────────────────────────────────────
  const buildUrl = useCallback(
    (q) => {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      params.set("limit", pageSize);
      params.set("offset", 0);
      return `/api/players/?${params.toString()}`;
    },
    [pageSize],
  );

  // ── Trigger on search change (debounced) ────────────────────────────────────
  useEffect(() => {
    if (!autoLoad && !search) {
      // Panels: don't load until user types something
      setResults([]);
      setNextUrl(null);
      setTotal(0);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => {
        fetchPage(buildUrl(search));
      },
      search ? debounceMs : 0,
    ); // no debounce for initial load

    return () => clearTimeout(debounceRef.current);
  }, [search, autoLoad, debounceMs, fetchPage, buildUrl]);

  // ── Load more (append next page) ────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (nextUrl && !loading) fetchPage(nextUrl);
  }, [nextUrl, loading, fetchPage]);

  const hasMore = Boolean(nextUrl);

  return { results, loading, search, setSearch, loadMore, hasMore, total };
}
