"use client";
import { useRef, useState } from "react";
import { Modal, ask } from "./ui";

export type FieldDef<T> = {
  key: keyof T & string; label: string; type?: "text" | "number" | "select" | "image" | "date";
  options?: [string, string][]; datalist?: string[]; wide?: boolean; required?: boolean; hint?: string;
};

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

export default function MasterForm<T extends object>({ title, initial, fields, onSave, onClose, footer, validate }: {
  title: string; initial: T; fields: FieldDef<T>[]; onSave: (v: T) => void; onClose: () => void;
  footer?: (v: T) => React.ReactNode;
  validate?: (v: T) => Partial<Record<keyof T & string, string>>;
}) {
  const [v, setV] = useState<T>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const start = useRef(JSON.stringify(initial));
  const dirty = JSON.stringify(v) !== start.current;

  const errors: Record<string, string> = {};
  for (const f of fields) {
    const val = v[f.key] as unknown;
    if (f.required && (val === "" || val === undefined || val === null || (f.type === "number" && Number.isNaN(val)))) errors[f.key] = `${f.label} is required`;
  }
  Object.assign(errors, Object.fromEntries(Object.entries(validate?.(v) ?? {}).filter(([, m]) => m)));
  const show = (k: string) => (touched[k] ? errors[k] : undefined);

  const close = async () => {
    if (dirty && !(await ask({ title: "Discard your changes?", body: "You have unsaved edits in this form.", confirm: "Discard", danger: true }))) return;
    onClose();
  };
  const submit = () => {
    if (Object.keys(errors).length) {
      setTouched(Object.fromEntries(fields.map((f) => [f.key, true])));
      const first = fields.find((f) => errors[f.key]);
      if (first) (document.querySelector(`[data-field="${first.key}"]`) as HTMLElement | null)?.focus();
      return;
    }
    onSave(v);
  };

  return (
    <Modal open onClose={close} title={title} width={520}>
      <form className="grid grid-cols-2 gap-3" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {fields.map((f, i) => {
          const err = show(f.key);
          const common = { "data-field": f.key, "aria-invalid": !!err, onBlur: () => setTouched((t) => ({ ...t, [f.key]: true })) };
          return (
            <label key={f.key} className={`block ${f.wide || f.type === "image" ? "col-span-2" : ""}`}>
              <div className="th mb-1">{f.label}{f.required && <span className="ml-0.5 text-[var(--bad-fg)]">*</span>}</div>
              {f.type === "select" ? (
                <select className={`field ${err ? "field-err" : ""}`} {...common} value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                  {f.options!.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
                </select>
              ) : f.type === "image" ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v[f.key] ? <img src={String(v[f.key])} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-line2 text-[10px] text-ink3">none</span>}
                  <input type="file" accept="image/*" className="text-xs" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) setV({ ...v, [f.key]: await resize(fl) }); }} />
                  {v[f.key] ? <button type="button" className="btn h-7" onClick={() => setV({ ...v, [f.key]: undefined })}>Remove</button> : null}
                </div>
              ) : (
                <input className={`field ${err ? "field-err" : ""}`} {...common} autoFocus={i === 0} type={f.type ?? "text"} list={f.datalist ? `dl-${f.key}` : undefined}
                  value={String(v[f.key] ?? "")}
                  onChange={(e) => setV({ ...v, [f.key]: f.type === "number" ? (e.target.value === "" ? NaN : +e.target.value) : e.target.value })} />
              )}
              {f.datalist && <datalist id={`dl-${f.key}`}>{f.datalist.map((d) => <option key={d} value={d} />)}</datalist>}
              {err ? <div className="mt-1 text-[11.5px] font-semibold text-[var(--bad-fg)]">{err}</div> : f.hint ? <div className="mt-1 text-[11px] text-ink3">{f.hint}</div> : null}
            </label>
          );
        })}
        {footer && <div className="col-span-2">{footer(v)}</div>}
        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
