import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Groups } from "./pages/Groups";
import { Rules } from "./pages/Rules";
import { Lists } from "./pages/Lists";
import { Welcome } from "./pages/Welcome";
import { Logs } from "./pages/Logs";
import { api } from "./lib/api";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const session = await api.session();
      setAuthed(Boolean(session.user?.id));
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.publicConfig().then((c) => setBotUsername(c.botUsername)).catch(console.error);
    checkSession();
  }, [checkSession]);

  async function logout() {
    await fetch("/auth/signout", { method: "POST", credentials: "include" });
    setAuthed(false);
  }

  if (loading) return <p style={{ padding: "2rem" }}>Loading...</p>;

  if (!authed) {
    if (!botUsername) return <p className="login">Bot username not available. Start the API server.</p>;
    return <Login botUsername={botUsername} onSuccess={checkSession} />;
  }

  return (
    <Routes>
      <Route element={<Layout onLogout={logout} />}>
        <Route index element={<Dashboard />} />
        <Route path="groups" element={<Groups />} />
        <Route path="rules" element={<Rules />} />
        <Route path="welcome" element={<Welcome />} />
        <Route path="lists" element={<Lists />} />
        <Route path="logs" element={<Logs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}