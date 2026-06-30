import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function Logs() {
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api.logs({ limit: 100 }).then(setLogs).catch(console.error);
  }, []);

  return (
    <div>
      <h1>Moderation Logs</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Chat</th>
              <th>User</th>
              <th>Action</th>
              <th>OK</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={String(log.id)}>
                <td>{new Date(String(log.createdAt)).toLocaleString()}</td>
                <td>{String(log.chatId)}</td>
                <td>{String(log.targetUserId ?? "")}</td>
                <td>{String(log.actionType)}</td>
                <td>{String(log.success)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}