"use client";
import { useMemo, useState } from "react";
import { Ban, CheckCircle2, MoveRight, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt, monthsLeft } from "@/lib/calc";
import { DOCK, HOLD, binContents, binUsed, fillOf, isStorage, levelOf, rackOf, replenishments, type Fill } from "@/lib/locations";
import { ZONES } from "@/lib/seed";
import type { Bin, Product, Batch } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import { BinLabels } from "@/components/BinLabels";
import { Chips, Empty, Modal, Thumb, ViewSwitch, ask, toast, useViewMode } from "@/components/ui";

const TONE: Record<Fill, { border: string; bg: string; bar: string; label: string }> = {
  empty: { border: "var(--line-strong)", bg: "transparent", bar: "var(--mute-bg)", label: "Empty" },
  ok: { border: "var(--line-strong)", bg: "var(--panel)", bar: "var(--accent)", label: "OK" },
  full: { border: "#d9a319", bg: "var(--warn-bg)", bar: "#d9a319", label: "Nearly full" },
  over: { border: "var(--bad-fg)", bg: "var(--bad-bg)", bar: "var(--bad-fg)", label: "Over capacity" },
  blocked: { border: "var(--ink-3)", bg: "repeating-linear-gradient(45deg, var(--mute-bg), var(--mute-bg) 6px, transparent 6px, transparent 12px)", bar: "var(--ink-3)", label: "Blocked" },
};

export default function Locations() {
  const products = useStore((s) => s.products);
  const bins = useStore((s) => s.bins);
  const upsertBin = useStore((s) => s.upsertBin);
  const setBlocked = useStore((s) => s.setBinBlocked);
  const delBin = useStore((s) => s.deleteBin);
  const move = useStore((s) => s.moveStock);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canEdit = user?.role === "warehouse";
  const [view, setView] = useViewMode("locations", "tiles");
  const [zone, setZone] = useState("all");
  const [flt, setFlt] = useState<"all" | Fill>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [mv, setMv] = useState<{ p: Product; b: Batch } | "free" | null>(null);
  const [form, setForm] = useState<Bin | null>(null);
  const [labels, setLabels] = useState<Bin[] | null>(null);

  const info = useMemo(() => bins.map((b) => {
    const used = binUsed(products, b.code);
    const { rows, q: hold } = binContents(products, b.code);
    return { bin: b, used, fill: fillOf(b, used), rows, hold };
  }), [bins, products]);
  const ql = q.trim().toLowerCase();
  const matches = (i: (typeof info)[number]) => !ql || i.bin.code.toLowerCase().includes(ql) || i.rows.some((r) => (r.p.name + r.p.code + r.b.no).toLowerCase().includes(ql)) || i.hold.some((r) => (r.p.name + r.p.code + r.b.no).toLowerCase().includes(ql));
  const shown = info.filter((i) => (zone === "all" || i.bin.zone === zone) && (flt === "all" || i.fill === flt) && matches(i));
  const zones = Array.from(new Set(bins.map((b) => b.zone))).sort();
  const cur = info.find((i) => i.bin.code === sel) ?? null;
  const repl = useMemo(() => replenishments(products, bins), [products, bins]);
  const counts = (f: Fill) => info.filter((i) => i.fill === f).length;
  const storage = info.filter((i) => isStorage(i.bin));
  const usedAll = storage.reduce((s, i) => s + i.used, 0), capAll = storage.reduce((s, i) => s + i.bin.capacity, 0);

  const tile = (i: (typeof info)[number], big = false) => {
    const t = TONE[i.fill];
    const names = Array.from(new Set(i.rows.map((r) => r.p.name)));
    const dim = ql && !matches(i);
    const pct = Math.min(100, (i.used / i.bin.capacity) * 100);
    return (
      <button key={i.bin.code} onClick={() => setSel(i.bin.code === sel ? null : i.bin.code)} title={`${i.bin.code}: ${fmt(i.used)} of ${i.bin.capacity} ctn`}
        className={`rounded-xl border-2 p-2 text-left transition hover:brightness-95 ${dim ? "opacity-30" : ""} ${sel === i.bin.code ? "ring-2 ring-accent" : ""} ${ql && matches(i) ? "ring-2 ring-accent" : ""} ${i.fill === "empty" ? "border-dashed" : ""}`}
        style={{ borderColor: t.border, background: t.bg, minHeight: big ? 84 : 72 }}>
        <div className="flex items-center justify-between gap-2 whitespace-nowrap"><span className="num text-[12px] font-bold">{i.bin.code}</span><span className="num text-[10.5px] text-ink2">{fmt(i.used)}/{i.bin.capacity}</span></div>
        <div className="mt-0.5 truncate text-[10.5px] text-ink2">{i.fill === "blocked" ? i.bin.note || "Blocked" : names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : "") : "Empty"}</div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--mute-bg)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.bar }} /></div>
      </button>
    );
  };

  const racks = Array.from(new Set(shown.filter((i) => levelOf(i.bin.code) > 0).map((i) => rackOf(i.bin.code)))).sort();
  const special = shown.filter((i) => levelOf(i.bin.code) === 0);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[270px]"><Search size={14} className="absolute left-2.5 top-2.5 text-ink3" /><input className="field" style={{ paddingLeft: 32 }} placeholder="Find a product, batch or bin…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-xs text-ink2">Space used <b className="num text-ink">{fmt(usedAll)}</b> of {fmt(capAll)} ctn ({Math.round((usedAll / capAll) * 100)}%)</span>
        <div className="ml-auto flex items-center gap-2">
          <ViewSwitch mode={view} onChange={setView} />
          {canEdit && <>
            <button className="btn" onClick={() => setMv("free")}><MoveRight size={14} /> Move stock</button>
            <button className="btn" onClick={() => setLabels(shown.filter((i) => isStorage(i.bin)).map((i) => i.bin))}><Printer size={14} /> Bin labels</button>
            <button className="btn btn-primary" onClick={() => setForm({ code: "", zone: "A", capacity: 40 })}><Plus size={14} /> Add bin</button></>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Chips value={zone} onChange={setZone} items={[{ k: "all", label: "All zones" }, ...zones.map((z) => ({ k: z, label: `${z} · ${ZONES[z] ?? z}` }))]} />
        <Chips value={flt} onChange={setFlt} items={[{ k: "all", label: "Any fill" }, { k: "empty", label: "Empty", count: counts("empty") }, { k: "full", label: "Nearly full", count: counts("full") }, { k: "over", label: "Over capacity", count: counts("over") }, { k: "blocked", label: "Blocked", count: counts("blocked") }]} />
      </div>

      {repl.length > 0 && canEdit && (
        <div className="rounded-xl border border-[var(--warn-fg)] bg-[var(--warn-bg)] px-3 py-2">
          <div className="mb-1 text-[12px] font-semibold text-[var(--warn-fg)]">{repl.length} pick face{repl.length > 1 ? "s" : ""} nearly empty while stock is stored higher up. Refill so pickers do not climb.</div>
          <div className="flex flex-wrap gap-2">{repl.map((r) => (
            <button key={r.p.id} className="btn h-7 bg-panel" onClick={() => { const ctn = Math.max(1, Math.floor(r.ctn)); const res = move({ productId: r.p.id, batch: r.from.no, from: r.from.bin, to: r.face.code, qtyPcs: ctn * r.p.packSize, kind: "transfer", reason: "Replenish pick face", by }); toast(res.ok ? `${ctn} ctn of ${r.p.name} moved to ${r.face.code}` : res.reason ?? "Could not move"); }}>
              {r.p.name}: {r.from.bin} → {r.face.code} ({Math.max(1, Math.floor(r.ctn))} ctn)</button>))}</div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          {shown.length === 0 && <div className="panel"><Empty title="No bins match" hint="Clear the search or a filter to see the whole warehouse." action={{ label: "Clear filters", onClick: () => { setQ(""); setZone("all"); setFlt("all"); } }} /></div>}

          {view === "tiles" && shown.length > 0 && (
            <div className="space-y-5">
              {zones.filter((z) => shown.some((i) => i.bin.zone === z)).map((z) => {
                const zi = info.filter((i) => i.bin.zone === z);
                const zu = zi.reduce((s, i) => s + i.used, 0), zc = zi.reduce((s, i) => s + i.bin.capacity, 0);
                const zr = racks.filter((r) => r[0] === z);
                const zs = special.filter((i) => i.bin.zone === z);
                return (
                  <div key={z}>
                    <div className="mb-2 flex items-baseline gap-2"><h3 className="text-[14px] font-bold">Zone {z}</h3><span className="text-xs text-ink2">{ZONES[z]}</span><span className="num ml-auto text-xs text-ink3">{fmt(zu)} / {fmt(zc)} ctn · {Math.round((zu / zc) * 100)}%</span></div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                      {zr.map((r) => (
                        <div key={r} className="rounded-2xl border border-line bg-panel2 p-2">
                          <div className="num mb-1.5 whitespace-nowrap px-1 text-[11px] font-bold text-ink2">Rack {r}</div>
                          <div className="space-y-1.5">{[3, 2, 1].map((l) => { const i = shown.find((x) => x.bin.code === `${r}-${l}`); return i ? tile(i) : <div key={l} className="h-[72px] rounded-xl border border-dashed border-line opacity-40" />; })}</div>
                        </div>
                      ))}
                      {zs.map((i) => <div key={i.bin.code} className="self-start">{tile(i, true)}</div>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view !== "tiles" && shown.length > 0 && (
            <div className="panel overflow-hidden">
              {view === "table" ? (
                <table className="w-full text-[12.5px]">
                  <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Bin</th><th>Zone</th><th>Contents</th><th className="w-40">Used</th><th className="text-right">Free</th><th className="pl-5">Status</th></tr></thead>
                  <tbody>{shown.map((i) => (
                    <tr key={i.bin.code} onClick={() => setSel(i.bin.code)} className={`row-hover cursor-pointer border-t border-line ${sel === i.bin.code ? "row-sel" : ""}`}>
                      <td className="num px-4 py-2 font-bold">{i.bin.code}</td><td className="text-ink2">{ZONES[i.bin.zone]}</td>
                      <td className="text-ink2">{i.rows.length ? Array.from(new Set(i.rows.map((r) => r.p.name))).join(", ") : "—"}</td>
                      <td className="pr-6"><div className="mb-1 num text-[10.5px] text-ink3">{fmt(i.used)} / {i.bin.capacity} ctn</div><div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--mute-bg)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, (i.used / i.bin.capacity) * 100)}%`, background: TONE[i.fill].bar }} /></div></td>
                      <td className="num text-right">{fmt(Math.max(0, i.bin.capacity - i.used))}</td>
                      <td className="pl-5"><span className={`chip ${i.fill === "over" || i.fill === "blocked" ? "chip-bad" : i.fill === "full" ? "chip-warn" : i.fill === "empty" ? "chip-mute" : "chip-ok"}`}>{TONE[i.fill].label}</span></td>
                    </tr>))}</tbody>
                </table>
              ) : shown.map((i) => (
                <div key={i.bin.code} onClick={() => setSel(i.bin.code)} className={`row-hover flex cursor-pointer items-center gap-3 border-b border-line px-3 py-1.5 text-[12.5px] ${sel === i.bin.code ? "row-sel" : ""}`}>
                  <span className="num w-20 font-bold">{i.bin.code}</span><span className="min-w-0 flex-1 truncate text-ink2">{i.rows.length ? Array.from(new Set(i.rows.map((r) => r.p.name))).join(", ") : "Empty"}</span>
                  <span className="num w-24 text-right">{fmt(i.used)} / {i.bin.capacity}</span><span className={`chip w-24 justify-center ${i.fill === "over" || i.fill === "blocked" ? "chip-bad" : i.fill === "full" ? "chip-warn" : "chip-mute"}`}>{TONE[i.fill].label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {cur && (
          <div className="panel slidein flex min-h-0 w-[340px] shrink-0 flex-col">
            <div className="flex items-start justify-between border-b border-line px-4 py-3">
              <div><div className="num text-[20px] font-bold leading-tight">{cur.bin.code}</div><div className="text-xs text-ink2">{ZONES[cur.bin.zone]}{cur.bin.note ? ` · ${cur.bin.note}` : ""}</div></div>
              <button className="rounded-md p-1 text-ink3 hover:bg-panel2" onClick={() => setSel(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
              <div className="mb-3 flex items-center gap-2"><span className={`chip ${cur.fill === "over" || cur.fill === "blocked" ? "chip-bad" : cur.fill === "full" ? "chip-warn" : cur.fill === "empty" ? "chip-mute" : "chip-ok"}`}>{TONE[cur.fill].label}</span><span className="num text-xs text-ink2">{fmt(cur.used)} of {cur.bin.capacity} ctn</span></div>
              <div className="th mb-1.5">Contents</div>
              {cur.rows.length === 0 && cur.hold.length === 0 && <div className="rounded-xl border border-dashed border-line2 p-4 text-center text-xs text-ink3">This bin is empty.</div>}
              {cur.rows.map(({ p, b, ctn }) => { const m = monthsLeft(b.expiry); return (
                <div key={b.id} className="mb-2 rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-2"><Thumb p={p} size={26} /><div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{p.name}</div><div className="num text-[10.5px] text-ink3">{b.no} · exp {b.expiry}</div></div><span className="num text-[13px] font-bold">{fmt(ctn)}</span></div>
                  <div className="mt-1.5 flex items-center justify-between">{m <= 2 ? <span className="chip chip-warn !py-0 text-[10px]">expiring in {m} mo</span> : <span />}{canEdit && cur.bin.code !== HOLD && <button className="btn h-7" onClick={() => setMv({ p, b })}><MoveRight size={13} /> Move</button>}</div>
                </div>); })}
              {cur.hold.map(({ p, b, ctn }) => (
                <div key={b.id} className="mb-2 rounded-xl border border-[var(--warn-fg)] bg-[var(--warn-bg)] p-2.5 text-xs"><b>{p.name}</b> · {b.no} · {fmt(ctn)} ctn <div className="mt-0.5 text-[var(--warn-fg)]">On quality hold. Decide in Inbound → On hold.</div></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-3">
              <button className="btn h-8" onClick={() => setLabels([cur.bin])}><Printer size={13} /> Label</button>
              {canEdit && isStorage(cur.bin) && <>
                <button className="btn h-8" onClick={() => setForm(cur.bin)}><Pencil size={13} /> Edit</button>
                <button className="btn h-8" onClick={async () => { if (cur.bin.blocked) { setBlocked(cur.bin.code, false); toast(`${cur.bin.code} unblocked`); } else if (await ask({ title: `Block ${cur.bin.code}?`, body: "Nothing can be put into a blocked bin (for example a broken shelf). Stock already inside stays.", confirm: "Block bin", danger: true })) { setBlocked(cur.bin.code, true, "Blocked by warehouse"); toast(`${cur.bin.code} blocked`, { undo: () => setBlocked(cur.bin.code, false) }); } }}>{cur.bin.blocked ? <><CheckCircle2 size={13} /> Unblock</> : <><Ban size={13} /> Block</>}</button>
                {cur.used === 0 && <button className="btn btn-danger h-8" onClick={async () => { if (await ask({ title: `Delete bin ${cur.bin.code}?`, body: "It is empty, so nothing is lost.", confirm: "Delete", danger: true })) { delBin(cur.bin.code); setSel(null); toast("Bin deleted"); } }}><Trash2 size={13} /> Delete</button>}</>}
            </div>
          </div>
        )}
      </div>

      {form && (
        <MasterForm<Bin> title={bins.some((b) => b.code === form.code) ? `Edit bin ${form.code}` : "Add bin"} initial={form} onClose={() => setForm(null)}
          fields={[{ key: "code", label: "Bin code", required: true, hint: "Zone-rack-level, e.g. A-07-1. Overflow bins look like A-OV." }, { key: "capacity", label: "Capacity (cartons)", type: "number", required: true }, { key: "note", label: "Note", wide: true }]}
          validate={(v) => ({
            code: v.code && !/^[A-E]-(\d{2}-[1-5]|OV)$/.test(v.code.toUpperCase()) ? "Use the pattern A-07-1 (zone A to E, two-digit rack, level 1 to 5)" : v.code && !bins.some((b) => b.code === form.code && form.code) && bins.some((b) => b.code === v.code.toUpperCase()) ? "This bin already exists" : "",
            capacity: !(v.capacity > 0) ? "Capacity must be more than 0" : v.capacity > 500 ? "Capacity cannot be more than 500 cartons" : v.capacity < binUsed(products, form.code) ? `Bin already holds ${fmt(binUsed(products, form.code))} cartons` : "",
          })}
          onSave={(v) => { const code = (form.code || v.code).toUpperCase(); upsertBin({ ...form, ...v, code, zone: code[0] }); setForm(null); setSel(code); toast("Bin saved"); }} />
      )}
      {mv && <MoveModal start={mv === "free" ? null : mv} onClose={() => setMv(null)} />}
      {labels && <BinLabels bins={labels} onClose={() => setLabels(null)} />}
      <div className="hidden">{DOCK}</div>
    </div>
  );
}

function MoveModal({ start, onClose }: { start: { p: Product; b: Batch } | null; onClose: () => void }) {
  const products = useStore((s) => s.products);
  const bins = useStore((s) => s.bins);
  const move = useStore((s) => s.moveStock);
  const user = useUser();
  const sources = products.flatMap((p) => p.batches.filter((b) => b.qty > 0 && b.bin !== HOLD).map((b) => ({ p, b, key: `${p.id}|${b.no}|${b.bin}` })));
  const [src, setSrc] = useState(start ? `${start.p.id}|${start.b.no}|${start.b.bin}` : "");
  const s = sources.find((x) => x.key === src);
  const [to, setTo] = useState("");
  const [qty, setQty] = useState<number>(NaN);
  const [reason, setReason] = useState("Consolidate stock");
  const [tried, setTried] = useState(false);
  const maxCtn = s ? s.b.qty / s.p.packSize : 0;
  const dest = bins.find((b) => b.code === to);
  const free = dest ? dest.capacity - binUsed(products, dest.code) : 0;
  const errs = {
    src: !s ? "Choose what to move" : "",
    to: !dest ? "Choose where it goes" : dest.code === s?.b.bin ? "That is where it already is" : "",
    qty: !(qty > 0) ? "Enter how many cartons" : qty > maxCtn ? `Only ${fmt(maxCtn)} cartons there` : "",
  };
  const bad = Object.values(errs).some(Boolean);
  const go = async () => {
    setTried(true);
    if (bad || !s || !dest) return;
    const over = qty > free + 0.001;
    if (over && !(await ask({ title: `${dest.code} will be over capacity`, body: `It has room for ${Math.floor(free)} more cartons.`, confirm: "Move anyway", danger: true }))) return;
    const r = move({ productId: s.p.id, batch: s.b.no, from: s.b.bin, to: dest.code, qtyPcs: Math.round(qty * s.p.packSize), kind: "transfer", reason, by: user?.initials ?? "—", force: over });
    if (r.ok) { toast(`${qty} ctn moved to ${dest.code}`); onClose(); } else toast(r.reason ?? "Could not move");
  };
  return (
    <Modal open onClose={onClose} title="Move stock between bins" width={500}>
      <div className="space-y-3">
        <label className="block"><div className="th mb-1">From</div>
          <select className={`field ${tried && errs.src ? "field-err" : ""}`} value={src} onChange={(e) => { setSrc(e.target.value); setQty(NaN); }}><option value="">Choose bin and batch…</option>{sources.map((x) => <option key={x.key} value={x.key}>{x.b.bin} · {x.p.name} · {x.b.no} · {fmt(x.b.qty / x.p.packSize)} ctn</option>)}</select>
          {tried && errs.src && <div className="mt-1 text-[11.5px] font-semibold text-[var(--bad-fg)]">{errs.src}</div>}</label>
        <label className="block"><div className="th mb-1">To</div>
          <select className={`field ${tried && errs.to ? "field-err" : ""}`} value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a bin…</option>{bins.filter((b) => isStorage(b) && !b.blocked).map((b) => <option key={b.code} value={b.code}>{b.code} · {Math.max(0, Math.floor(b.capacity - binUsed(products, b.code)))} ctn free</option>)}</select>
          {tried && errs.to && <div className="mt-1 text-[11.5px] font-semibold text-[var(--bad-fg)]">{errs.to}</div>}</label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><div className="th mb-1">Cartons {s && <span className="font-normal normal-case text-ink3">(max {fmt(maxCtn)})</span>}</div>
            <input className={`field num font-semibold ${tried && errs.qty ? "field-err" : ""}`} type="number" min={1} value={Number.isNaN(qty) ? "" : qty} onChange={(e) => setQty(e.target.value === "" ? NaN : +e.target.value)} />
            {tried && errs.qty && <div className="mt-1 text-[11.5px] font-semibold text-[var(--bad-fg)]">{errs.qty}</div>}</label>
          <label className="block"><div className="th mb-1">Reason</div><select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{["Consolidate stock", "Replenish pick face", "Damaged rack", "Make room for a delivery", "Moved to the right zone"].map((r) => <option key={r}>{r}</option>)}</select></label>
        </div>
        {dest && qty > free + 0.001 && <div className="text-xs font-semibold text-[var(--warn-fg)]">{dest.code} has room for {Math.floor(free)} cartons. You will be asked to confirm.</div>}
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={go}>Move stock</button></div>
      </div>
    </Modal>
  );
}
