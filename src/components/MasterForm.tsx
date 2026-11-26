"use client";
import { useState } from "react";
import { Modal } from "./ui";

export type FieldDef<T> = { key: keyof T & string; label: string; type?: "text" | "number" | "select" | "image" | "date"; options?: [string, string][]; datalist?: string[]; wide?: boolean };

function resize(file: File): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const k = 160 / Math.max(img.width, img.height);
      c.width = Math.round(img.width * Math.min(1, k)); c.height = Math.round(img.height * Math.min(1, k));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function MasterForm<T extends object>({ title, initial, fields, onSave, onClose, footer }: {
  title: string; initial: T; fields: FieldDef<T>[]; onSave: (v: T) => void; onClose: () => void; footer?: (v: T) => React.ReactNode;
}) {
  const [v, setV] = useState<T>(initial);
  const submit = () => onSave(v);
  return (
    <Modal open onClose={onClose} title={title} width={520}>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {fields.map((f, i) => (
          <label key={f.key} className={`block ${f.wide || f.type === "image" ? "col-span-2" : ""}`}>
            <div className="th mb-1">{f.label}</div>
            {f.type === "select" ? (
              <select className="field" value={String(v[f.key])} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                {f.options!.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
              </select>
            ) : f.type === "image" ? (
              <div className="flex items-center gap-3">
                {v[f.key] ? <img src={String(v[f.key])} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-line2 text-[10px] text-ink3">none</span>}
                <input type="file" accept="image/*" className="text-xs" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) setV({ ...v, [f.key]: await resize(fl) }); }} />
                {v[f.key] ? <button type="button" className="btn h-7" onClick={() => setV({ ...v, [f.key]: undefined })}>Remove</button> : null}
              </div>
            ) : (
              <input className="field" autoFocus={i === 0} type={f.type ?? "text"} list={f.datalist ? `dl-${f.key}` : undefined} value={String(v[f.key] ?? "")}
                onChange={(e) => setV({ ...v, [f.key]: f.type === "number" ? +e.target.value : e.target.value })} />
            )}
            {f.datalist && <datalist id={`dl-${f.key}`}>{f.datalist.map((d) => <option key={d} value={d} />)}</datalist>}
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
