import { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);
const API = "http://127.0.0.1:8000";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("director_access"));
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("director_user")); } catch { return null; }
  });

  const login = useCallback(async (username, password) => {
    const res  = await fetch(`${API}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    localStorage.setItem("director_access",  data.access);
    localStorage.setItem("director_refresh", data.refresh);
    localStorage.setItem("director_user",    JSON.stringify({ username }));
    setToken(data.access);
    setUser({ username });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("director_access");
    localStorage.removeItem("director_refresh");
    localStorage.removeItem("director_user");
    setToken(null);
    setUser(null);
  }, []);

  const authFetch = useCallback(async (url, opts = {}) => {
    const t = localStorage.getItem("director_access");
    const res = await fetch(`${API}${url}`, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: `Bearer ${t}`,
        ...(opts.body && !(opts.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
    });
    if (res.status === 401) { logout(); throw new Error("Session expired"); }
    return res;
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
