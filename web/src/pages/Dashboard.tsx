import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function Dashboard() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.stats(7).then(setStats).catch(console.error);
  }, []);

  if (!stats) return <p>Loading...</p>;

  const items = [
    ["Questions (7d)", stats.questions],
    ["Joins (7d)", stats.joins],
    ["Bans (7d)", stats.bans],
    ["Restricts (7d)", stats.restricts],
    ["Newcomer blocks", stats.newcomerBlocks],
    ["Active groups", stats.activeGroups],
    ["Active members", stats.activeMembers],
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid">
        {items.map(([label, value]) => (
          <div className="card" key={String(label)}>
            <div style={{ color: "#64748b", fontSize: "0.875rem" }}>{label}</div>
            <div className="stat">{String(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}