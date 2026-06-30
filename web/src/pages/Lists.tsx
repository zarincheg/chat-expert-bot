import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function Lists() {
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([]);
  const [userId, setUserId] = useState("");
  const [listType, setListType] = useState<"BLACKLIST" | "WHITELIST">("BLACKLIST");
  const [reason, setReason] = useState("");

  function reload() {
    api.accessLists().then(setEntries).catch(console.error);
  }

  useEffect(() => {
    reload();
  }, []);

  async function add() {
    await api.addAccessList({ userId: Number(userId), listType, reason });
    setUserId("");
    setReason("");
    reload();
  }

  return (
    <div>
      <h1>Blacklist / Whitelist</h1>
      <div className="card">
        <label>User ID</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        <label>List</label>
        <select value={listType} onChange={(e) => setListType(e.target.value as "BLACKLIST" | "WHITELIST")}>
          <option value="BLACKLIST">Blacklist</option>
          <option value="WHITELIST">Whitelist</option>
        </select>
        <label>Reason</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>List</th>
              <th>Reason</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={String(e.id)}>
                <td>{String(e.userId)}</td>
                <td>{String(e.listType)}</td>
                <td>{String(e.reason ?? "")}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => api.deleteAccessList(String(e.id)).then(reload)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}