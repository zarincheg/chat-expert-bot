import { NavLink, Outlet } from "react-router-dom";

export function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h2 style={{ marginTop: 0 }}>Bot Admin</h2>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/groups">Groups</NavLink>
          <NavLink to="/rules">Rules</NavLink>
          <NavLink to="/lists">Lists</NavLink>
          <NavLink to="/welcome">Welcome</NavLink>
          <NavLink to="/logs">Logs</NavLink>
        </nav>
        <button className="secondary" style={{ marginTop: "2rem" }} onClick={onLogout}>
          Sign out
        </button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}