// src/components/ProtectedUmpire.jsx
// Route guard for umpire dashboard.
// If no access_token exists, redirects to /umpire/login.

import { Navigate } from "react-router-dom";

export default function ProtectedUmpire({ children }) {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/umpire/login" replace />;
  }
  return children;
}
