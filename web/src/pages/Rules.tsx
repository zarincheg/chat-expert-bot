import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function Rules() {
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("");
  const [ruleType, setRuleType] = useState("keyword_first_message");
  const [action, setAction] = useState("ban");

  function reload() {
    api.rules().then(setRules).catch(console.error);
  }

  useEffect(() => {
    reload();
  }, []);

  async function create() {
    await api.createRule({ name, pattern, ruleType, action });
    setName("");
    setPattern("");
    reload();
  }

  return (
    <div>
      <h1>Moderation Rules</h1>
      <div className="card">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>Pattern (substring)</label>
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <label>Type</label>
        <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
          <option value="keyword_first_message">First message keyword</option>
          <option value="nickname">Nickname</option>
        </select>
        <label>Action</label>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="ban">Ban</option>
          <option value="restrict">Restrict</option>
        </select>
        <button onClick={create}>Add rule</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Pattern</th>
              <th>Action</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.name)}</td>
                <td>{String(r.ruleType)}</td>
                <td>{String(r.pattern)}</td>
                <td>{String(r.action)}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => api.deleteRule(String(r.id)).then(reload)}
                  >
                    Delete
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