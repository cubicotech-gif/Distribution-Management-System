"use client";
import { useState } from "react";
import { Modal } from "./ui";

export type FieldDef<T> = { key: keyof T & string; label: string; type?: "text" | "number" | "select"; options?: [string, string][] };

export default function MasterForm<T extends object>({ title, initial, fields, onSave, onClose, footer }: {
  title: string; initial: T; fields: FieldDef<T>[]; onSave: (v: T) => void; onClose: () => void; footer?: (v: T) => React.ReactNode;
}) {
  const [v, setV] = useState<T>(initial);
  const submit = () => onSave(v);
  return (
    <Modal open onClose={onClose} title={title} width={520}>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {fields.map((f, i) => (
          <label key={f.key} className="block">
            <div className="th mb-1">{f.label}</div>
            {f.type === "select" ? (
              <select className="field" value={String(v[f.key])} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                {f.options!.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
              </select>
            ) : (
              <input className="field" autoFocus={i === 0} type={f.type ?? "text"} value={String(v[f.key] ?? "")}
                onChange={(e) => setV({ ...v, [f.key]: f.type === "number" ? +e.target.value : e.target.value })} />
            )}
          </label>
        ))}
        {footer && <div className="col-span-2">{footer(v)}</div>}
        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
