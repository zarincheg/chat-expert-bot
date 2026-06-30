import { useEffect, useRef } from "react";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export function Login({
  botUsername,
  onSuccess,
}: {
  botUsername: string;
  onSuccess: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      const { api } = await import("../lib/api");
      const res = await api.signInTelegram(user);
      if (res.ok) onSuccess();
      else alert("Login failed");
    };

    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [botUsername, onSuccess]);

  return (
    <div className="login">
      <div className="card" style={{ textAlign: "center" }}>
        <h1>Bot Admin</h1>
        <p>Sign in with Telegram (admins only)</p>
        <div ref={containerRef} />
      </div>
    </div>
  );
}