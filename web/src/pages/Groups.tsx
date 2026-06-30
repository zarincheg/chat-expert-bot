import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function Groups() {
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string>("");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.groups().then(setGroups).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.moderation(selected).then(setSettings).catch(console.error);
  }, [selected]);

  async function save() {
    if (!selected || !settings) return;
    await api.updateModeration(selected, settings);
    alert("Saved");
  }

  return (
    <div>
      <h1>Groups — Moderation</h1>
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
      </div>

      {settings && (
        <div className="card">
          <label>
            <input
              type="checkbox"
              checked={Boolean(settings.enabled)}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />{" "}
            Moderation enabled
          </label>

          <h3>Newcomer policy</h3>
          <label>Grace period (hours)</label>
          <input
            type="number"
            value={Number((settings.newcomer as Record<string, unknown>)?.gracePeriodHours ?? 24)}
            onChange={(e) =>
              setSettings({
                ...settings,
                newcomer: {
                  ...(settings.newcomer as object),
                  gracePeriodHours: Number(e.target.value),
                },
              })
            }
          />

          <label>Max messages/hour</label>
          <input
            type="number"
            value={Number((settings.newcomer as Record<string, unknown>)?.maxMessagesPerHour ?? 5)}
            onChange={(e) =>
              setSettings({
                ...settings,
                newcomer: {
                  ...(settings.newcomer as object),
                  maxMessagesPerHour: Number(e.target.value),
                },
              })
            }
          />

          <h3>Trust score</h3>
          <label>Ban above</label>
          <input
            type="number"
            value={Number(
              (settings.autoBan as Record<string, unknown>)?.trustScore
                ? ((settings.autoBan as Record<string, unknown>).trustScore as Record<string, unknown>)
                    .blockAbove
                : 80,
            )}
            onChange={(e) =>
              setSettings({
                ...settings,
                autoBan: {
                  ...(settings.autoBan as object),
                  trustScore: {
                    ...(((settings.autoBan as Record<string, unknown>)?.trustScore as object) ?? {}),
                    blockAbove: Number(e.target.value),
                  },
                },
              })
            }
          />

          <button onClick={save}>Save settings</button>
        </div>
      )}
    </div>
  );
}