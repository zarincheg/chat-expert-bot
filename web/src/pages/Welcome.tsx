import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function Welcome() {
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("Welcome {name} to {group}!");
  const [photoUrl, setPhotoUrl] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    api.groups().then(setGroups).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.welcome(selected).then((cfg) => {
      if (!cfg) return;
      setText(String(cfg.text ?? text));
      setPhotoUrl(String(cfg.photoUrl ?? ""));
      setEnabled(Boolean(cfg.enabled));
    });
  }, [selected]);

  async function save() {
    if (!selected) return;
    await api.updateWelcome(selected, {
      text,
      photoUrl: photoUrl || null,
      enabled,
      buttons: [],
      deleteJoinMessage: true,
    });
    alert("Welcome config saved");
  }

  return (
    <div>
      <h1>Welcome Messages</h1>
      <div className="card">
        <label>Group</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select group</option>
          {groups.map((g) => (
            <option key={String(g.chatId)} value={String(g.chatId)}>
              {String(g.title ?? g.chatId)}
            </option>
          ))}
        </select>

        <label>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>

        <label>Message (use {"{name}"}, {"{username}"}, {"{group}"})</label>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />

        <label>Photo URL (optional)</label>
        <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />

        <button onClick={save}>Save</button>
      </div>
    </div>
  );
}