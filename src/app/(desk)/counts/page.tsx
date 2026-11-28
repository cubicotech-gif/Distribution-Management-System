"use client";
import { Suspense, useMemo, useState } from "react";
import { can } from "@/lib/perm";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt } from "@/lib/calc";
import { ABC_NOTE, FREQ, abcClasses, dueInfo, lineDelta, lineFinal, needsRecount, sessionValue } from "@/lib/counts";
import { ADJ_CODES, type AdjCode, type CountLine, type CountSession, type Product } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import { Chips, Empty, Modal, Spinner, Thumb, ask, toast, useBusy } from "@/components/ui";

type Tab = "schedule" | "sessions" | "adjust";
const ctnOf = (pcs: number, p: Product) => Math.round((pcs / p.packSize) * 10) / 10;
const issueCodes: AdjCode[] = ["sample", "internal", "display"];
const countCodes: AdjCode[] = ["miscount", "damage", "theft", "found", "wrong-receipt", "unit-error"];

function CountsInner() {
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const counts = useStore((s) => s.counts);
  const adjustments = useStore((s) => s.adjustments);
  const start = useStore((s) => s.startCount);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canAct = can(user, "count");
  const showMoney = user?.role === "admin";
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "schedule");
  const [sel, setSel] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [issue, setIssue] = useState(false);
  const [sheet, setSheet] = useState<CountLine[] | null>(null);
  const cls = useMemo(() => abcClasses(products), [products]);
  const rows = products.filter((p) => p.status !== "unlisted" && p.batches.some((b) => b.qty > 0)).map((p) => ({ p, c: cls[p.id], d: dueInfo(p, cls[p.id]) })).sort((a, b) => Number(b.d.due) - Number(a.d.due) || b.d.overdue - a.d.overdue);
  const dueRows = rows.filter((r) => r.d.due);
  const openSessions = counts.filter((c) => c.status === "counting" || c.status === "review");
  const cur = counts.find((c) => c.id === open) ?? openSessions[0] ?? counts[0];
  const linesFor = (ids: string[]) => products.filter((p) => ids.includes(p.id)).flatMap((p) => p.batches.filter((b) => b.qty > 0).map((b) => ({ productId: p.id, bin: b.bin, batch: b.no, expiry: b.expiry, systemPcs: b.qty })));

  const begin = (ids: string[] | "all", mode: "cycle" | "full") => { const id = start(ids, mode, by); setOpen(id); setTab("sessions"); setSel([]); toast(mode === "full" ? "Full stock take started" : "Count started. Count blind, the system quantity is hidden"); };
  const tabs: [Tab, string, number][] = [["schedule", "Count schedule", dueRows.length], ["sessions", "Counts", openSessions.length], ["adjust", "Adjustments", adjustments.filter((a) => a.status === "pending").length]];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-panel p-1">{tabs.map(([k, l, n]) => <button key={k} onClick={() => setTab(k)} className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${tab === k ? "bg-accent text-accentink" : "text-ink2"}`}>{l}{n ? <span className="num rounded bg-black/10 px-1 text-[10.5px]">{n}</span> : null}</button>)}</div>
        <div className="text-xs text-ink2">
          {tab === "schedule" && `A-class products every ${FREQ.A} days, B every ${FREQ.B}, C every ${FREQ.C}. ${ABC_NOTE}`}
          {tab === "sessions" && "Count blind: the system quantity stays hidden until you submit."}
          {tab === "adjust" && "Every stock correction, with the reason code and who approved it."}
        </div>
        {canAct && <div className="ml-auto flex gap-2"><button className="btn" onClick={() => setIssue(true)}>Issue stock (sample / internal)</button>
          <button className="btn" onClick={async () => { if (await ask({ title: "Start a full stock take?", body: "Every bin and batch in the warehouse is listed to count. Pause picking and putaway while counting.", confirm: "Start full stock take" })) begin("all", "full"); }}>Full stock take</button></div>}
      </div>

      {tab === "schedule" && (
        <div className="panel min-h-0 flex-1 overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="w-8 pl-4" /><th className="py-2.5">Product</th><th>Class</th><th>Last counted</th><th>Status</th><th className="text-right">Bins</th></tr></thead>
            <tbody>{rows.map(({ p, c, d }) => (
              <tr key={p.id} className={`row-hover border-t border-line ${sel.includes(p.id) ? "bg-accentwash" : ""}`}>
                <td className="pl-4">{canAct && <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={sel.includes(p.id)} onChange={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id])} />}</td>
                <td className="py-2.5"><div className="flex items-center gap-2.5"><Thumb p={p} size={26} /><div><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code}</div></div></div></td>
                <td><span className={`chip ${c === "A" ? "chip-bad" : c === "B" ? "chip-warn" : "chip-mute"}`}>{c} · every {FREQ[c]}d</span></td>
                <td className="text-ink2">{p.lastCount ? ago(p.lastCount) : "Never"}</td>
                <td>{d.due ? <span className={`chip ${d.overdue > 0 ? "chip-bad" : "chip-warn"}`}>{d.overdue > 0 ? `Overdue by ${d.overdue}d` : "Due today"}</span> : <span className="chip chip-ok">OK, next in {d.nextIn}d</span>}</td>
                <td className="num text-right">{new Set(p.batches.filter((b) => b.qty > 0).map((b) => b.bin)).size}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {tab === "schedule" && canAct && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5">
          <span className="text-[13px]"><b className="num">{sel.length}</b> selected · <b className="num">{dueRows.length}</b> due or overdue</span>
          <button className="btn" onClick={() => setSel(dueRows.map((r) => r.p.id))}>Select all due</button>
          <button className="btn" disabled={!sel.length} onClick={() => setSheet(linesFor(sel))}><Printer size={14} /> Print count sheet</button>
          <button className="btn btn-primary ml-auto" disabled={!sel.length} onClick={() => begin(sel, "cycle")}>Start count ({sel.length})</button>
        </div>
      )}

      {tab === "sessions" && (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(250px,26%)_1fr] gap-3">
          <div className="panel min-h-0 overflow-auto">
            {counts.length === 0 && <Empty title="No counts yet" hint="Start one from the Count schedule tab." action={{ label: "Go to the schedule", onClick: () => setTab("schedule") }} />}
            {counts.map((c) => (
              <button key={c.id} onClick={() => setOpen(c.id)} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.id === c.id ? "row-sel" : ""}`}>
                <div className="min-w-0 flex-1"><div className="num font-semibold">{c.folio}</div><div className="text-[11px] text-ink3">{c.mode === "full" ? "Full stock take" : "Count"} · {c.lines.length} lines · {ago(c.createdAt)}</div></div>
                <span className={`chip ${c.status === "counting" ? "chip-info" : c.status === "review" ? "chip-warn" : c.status === "posted" ? "chip-ok" : "chip-mute"}`}>{c.status === "counting" ? "Counting" : c.status === "review" ? "Review" : c.status === "posted" ? "Posted" : "Cancelled"}</span>
              </button>))}
          </div>
          <div className="panel flex min-h-0 flex-col">{cur ? <Session s={cur} canAct={canAct} by={by} showMoney={showMoney} onSheet={() => setSheet(cur.lines)} /> : <Empty title="Select a count" />}</div>
        </div>
      )}

      {tab === "adjust" && <Adjustments showMoney={showMoney || user?.role === "purchasing"} />}
      {issue && <IssueModal onClose={() => setIssue(false)} />}
      {sheet && <CountSheet lines={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Qty({ pcs, pack, onChange, disabled, danger }: { pcs: number | undefined; pack: number; onChange: (n: number | undefined) => void; disabled?: boolean; danger?: boolean }) {
  const c = pcs === undefined ? "" : Math.floor(pcs / pack);
  const l = pcs === undefined ? "" : pcs % pack;
  const set = (ctn: string, loose: string) => onChange(ctn === "" && loose === "" ? undefined : Math.max(0, Math.floor(+ctn || 0)) * pack + Math.max(0, Math.floor(+loose || 0)));
  return (
    <div className="flex items-center justify-end gap-1">
      <input className="cell num w-14 font-semibold" style={{ borderColor: danger ? "var(--bad-fg)" : undefined }} type="number" min={0} placeholder="ctn" disabled={disabled} value={c} onChange={(e) => set(e.target.value, String(l))} />
      <input className="cell num w-14" type="number" min={0} placeholder="pcs" disabled={disabled} value={l} onChange={(e) => set(String(c), e.target.value)} />
    </div>
  );
}

function Session({ s, canAct, by, showMoney, onSheet }: { s: CountSession; canAct: boolean; by: string; showMoney: boolean; onSheet: () => void }) {
  const products = useStore((s2) => s2.products);
  const setLine = useStore((s2) => s2.setCountLine);
  const submit = useStore((s2) => s2.submitCount);
  const discard = useStore((s2) => s2.discardCount);
  const post = useStore((s2) => s2.postCount);
  const [zone, setZone] = useState("all");
  const [busy, run] = useBusy();
  const P = (id: string) => products.find((p) => p.id === id)!;
  const zones = Array.from(new Set(s.lines.map((l) => l.bin[0]))).sort();
  const vis = s.lines.map((l, i) => ({ l, i })).filter(({ l }) => zone === "all" || l.bin[0] === zone).sort((a, b) => a.l.bin.localeCompare(b.l.bin) || a.l.productId.localeCompare(b.l.productId));
  const counted = s.lines.filter((l) => l.counted !== undefined).length;
  const review = s.status === "review";
  const flagged = s.lines.filter((l) => needsRecount(l, P(l.productId)));
  const changed = s.lines.filter((l) => lineDelta(l) !== 0);
  const missingCode = changed.filter((l) => !l.code);
  const editable = canAct && s.status === "counting";
  const canPost = canAct && review && flagged.length === 0;

  return (
    <>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div><div className="flex items-center gap-2.5"><h2 className="num text-[20px] font-bold">{s.folio}</h2><span className="chip chip-mute">{s.mode === "full" ? "Full stock take" : "Count"}</span><span className={`chip ${s.status === "counting" ? "chip-info" : s.status === "review" ? "chip-warn" : s.status === "posted" ? "chip-ok" : "chip-mute"}`}>{s.status === "counting" ? "Counting" : s.status === "review" ? "Review variances" : s.status === "posted" ? "Posted" : "Cancelled"}</span></div>
            <div className="mt-1 text-xs text-ink2">{s.lines.length} lines · started {ago(s.createdAt)} by {s.by}{s.status === "counting" && <> · <b className="num">{counted}</b> counted</>}</div></div>
          <button className="btn" onClick={onSheet}><Printer size={14} /> Count sheet</button>
        </div>
        {s.status === "counting" && <div className="mt-2 text-xs text-ink2">Count each bin and batch. Enter full cartons and loose pieces. The system quantity is hidden so the count stays honest.</div>}
        {review && <div className="mt-2 rounded-xl bg-accentwash px-3 py-2 text-xs text-ink2">Variances are now visible. Lines with a big difference must be <b>recounted</b> by someone else. Give every difference a reason, then post.</div>}
        {s.mode === "full" && zones.length > 1 && <div className="mt-3"><Chips value={zone} onChange={setZone} items={[{ k: "all", label: "All zones" }, ...zones.map((z) => ({ k: z, label: `Zone ${z}`, count: s.lines.filter((l) => l.bin[0] === z && (review ? true : l.counted === undefined)).length }))]} /></div>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th text-left"><th className="py-2">Bin</th><th>Product</th><th>Batch</th>{review && <th className="text-right">System</th>}<th className="text-right">{review ? "Counted" : "Your count (ctn / pcs)"}</th>{review && <th className="text-right">Difference</th>}{review && <th className="text-right">Recount</th>}{review && <th className="pl-4">Reason</th>}</tr></thead>
          <tbody>
            {vis.map(({ l, i }) => {
              const p = P(l.productId);
              const d = lineDelta(l);
              const rc = needsRecount(l, p);
              return (
                <tr key={i} className={`border-t border-line align-top ${rc ? "bg-[var(--bad-bg)]" : ""}`}>
                  <td className="num py-2 font-bold">{l.bin}</td>
                  <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={24} /><div className="font-medium">{p.name}</div></div></td>
                  <td className="num py-2 text-[11.5px]">{l.batch} <span className="text-ink3">exp {l.expiry}</span></td>
                  {review && <td className="num py-2 text-right text-ink2">{ctnOf(l.systemPcs, p)}</td>}
                  <td className="py-2 text-right">{review ? <span className="num font-semibold">{ctnOf(l.counted ?? 0, p)}</span> : <Qty pcs={l.counted} pack={p.packSize} disabled={!editable} onChange={(n) => setLine(s.id, i, { counted: n })} />}</td>
                  {review && <td className="num py-2 text-right font-semibold" style={{ color: d === 0 ? "var(--ink-3)" : d > 0 ? "var(--ok-fg)" : "var(--bad-fg)" }}>{d === 0 ? "—" : `${d > 0 ? "+" : "−"}${ctnOf(Math.abs(d), p)} ctn`}{showMoney && d !== 0 && <div className="text-[10.5px] font-normal text-ink3">Rs. {fmt(Math.abs(d) * (p.costPrice / p.packSize))}</div>}</td>}
                  {review && <td className="py-2 text-right">{rc || l.recount !== undefined ? <Qty pcs={l.recount} pack={p.packSize} disabled={!canAct} danger={rc} onChange={(n) => setLine(s.id, i, { recount: n })} /> : <span className="text-ink3">—</span>}{rc && <div className="mt-0.5 text-[10.5px] font-semibold text-[var(--bad-fg)]">Recount needed</div>}</td>}
                  {review && <td className="py-2 pl-4">{d !== 0 && !rc ? <select className={`field h-7 text-[11.5px] ${!l.code ? "field-err" : ""}`} disabled={!canAct} value={l.code ?? ""} onChange={(e) => setLine(s.id, i, { code: (e.target.value || undefined) as AdjCode })}><option value="">Choose reason…</option>{countCodes.map((c) => <option key={c} value={c}>{ADJ_CODES[c]}</option>)}</select> : <span className="text-ink3">{d === 0 ? "Matches" : ""}</span>}</td>}
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <div className="text-xs text-ink2">
          {s.status === "counting" && (counted === s.lines.length ? "Everything counted. Submit to see the variances." : `${s.lines.length - counted} line${s.lines.length - counted === 1 ? "" : "s"} still to count`)}
          {review && `${changed.length} difference${changed.length === 1 ? "" : "s"}${flagged.length ? ` · ${flagged.length} need a recount` : ""}${missingCode.length ? ` · ${missingCode.length} without a reason` : ""}`}
          {s.status === "posted" && `Posted ${s.postedAt ? ago(s.postedAt) : ""}. Total difference ${showMoney ? `Rs. ${fmt(sessionValue(s, products))}` : `${changed.length} lines`}.`}
        </div>
        <div className="flex gap-2">
          {canAct && (s.status === "counting" || review) && <button className="btn btn-danger" onClick={async () => { if (await ask({ title: `Cancel ${s.folio}?`, body: "Nothing is changed in stock.", confirm: "Cancel count", danger: true })) { discard(s.id); toast("Count cancelled"); } }}>Cancel count</button>}
          {editable && <button className="btn btn-primary h-9" disabled={counted < s.lines.length} onClick={() => { submit(s.id); toast("Count submitted. Variances are now visible"); }}>Submit count</button>}
          {canAct && review && <button className="btn btn-primary h-9" disabled={busy || !canPost || missingCode.length > 0} onClick={() => run(() => { const r = post(s.id, by); toast(`${r.applied} adjustment${r.applied === 1 ? "" : "s"} applied${r.pending ? `. ${r.pending} large one${r.pending === 1 ? "" : "s"} sent to the owner` : ""}`); })}>{busy ? <Spinner /> : null}Post adjustments</button>}
        </div>
      </div>
    </>
  );
}

function Adjustments({ showMoney }: { showMoney: boolean }) {
  const adjustments = useStore((s) => s.adjustments);
  const products = useStore((s) => s.products);
  const [code, setCode] = useState<"all" | AdjCode>("all");
  const rows = adjustments.filter((a) => code === "all" || a.code === code);
  const byCode = (Object.keys(ADJ_CODES) as AdjCode[]).map((c) => { const xs = adjustments.filter((a) => a.code === c); return { c, n: xs.length, net: xs.reduce((s, a) => s + a.deltaPcs, 0), v: xs.reduce((s, a) => s + a.value, 0) }; }).filter((x) => x.n > 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-4 gap-3">{byCode.slice(0, 4).map((x) => <div key={x.c} className="panel p-3.5"><div className="th">{ADJ_CODES[x.c]}</div><div className="num mt-1 text-[22px] font-bold">{x.n}</div><div className="text-[11.5px] text-ink2">{x.net > 0 ? "+" : ""}{fmt(x.net)} pcs net{showMoney && <> · Rs. {fmt(x.v)}</>}</div></div>)}</div>
      <Chips value={code} onChange={setCode} items={[{ k: "all", label: "All reasons", count: adjustments.length }, ...byCode.map((x) => ({ k: x.c, label: ADJ_CODES[x.c], count: x.n }))]} />
      <div className="panel min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? <Empty title="No adjustments yet" hint="Corrections from counts and stock issues are listed here with their reason." /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">When</th><th>Product</th><th>Reason</th><th>Bin · batch</th><th className="text-right">Change</th>{showMoney && <th className="text-right">Value</th>}<th className="pl-5">Status</th><th>By</th></tr></thead>
            <tbody>{rows.map((a) => { const p = products.find((x) => x.id === a.productId); return (
              <tr key={a.id} className="border-t border-line"><td className="px-4 py-2 text-ink3">{ago(a.at)}</td><td className="font-medium">{p?.name}</td><td>{a.code ? ADJ_CODES[a.code] : a.reason}<div className="text-[10.5px] text-ink3">{a.reason}</div></td><td className="num text-ink2">{a.bin ?? "—"} {a.batch ? `· ${a.batch}` : ""}</td>
                <td className="num text-right font-semibold" style={{ color: a.deltaPcs > 0 ? "var(--ok-fg)" : "var(--bad-fg)" }}>{a.deltaPcs > 0 ? "+" : "−"}{p ? ctnOf(Math.abs(a.deltaPcs), p) : ""} ctn</td>{showMoney && <td className="num text-right">{fmt(a.value)}</td>}
                <td className="pl-5"><span className={`chip ${a.status === "applied" ? "chip-ok" : a.status === "pending" ? "chip-warn" : "chip-bad"}`}>{a.status === "pending" ? "Waiting for owner" : a.status}</span></td><td>{a.by}</td></tr>); })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IssueModal({ onClose }: { onClose: () => void }) {
  const products = useStore((s) => s.products).filter((p) => p.stock > 0);
  const issueStock = useStore((s) => s.issueStock);
  const user = useUser();
  return (
    <MasterForm<{ productId: string; ctn: number; code: AdjCode; note: string }> title="Issue stock (sample or internal use)" initial={{ productId: products[0]?.id ?? "", ctn: 1, code: "sample", note: "" }} onClose={onClose}
      fields={[{ key: "productId", label: "Product", type: "select", options: products.map((p) => [p.id, `${p.name} (${Math.floor(p.stock / p.packSize)} ctn)`] as [string, string]), wide: true }, { key: "ctn", label: "Cartons", type: "number", required: true }, { key: "code", label: "Purpose", type: "select", options: issueCodes.map((c) => [c, ADJ_CODES[c]] as [string, string]) }, { key: "note", label: "Who is it for / why?", required: true, wide: true }]}
      validate={(v) => { const p = products.find((x) => x.id === v.productId); return { ctn: p && (!(v.ctn > 0) || v.ctn * p.packSize > p.stock) ? `Between 1 and ${p ? Math.floor(p.stock / p.packSize) : 0} cartons` : "" }; }}
      footer={() => <div className="text-xs text-ink2">Oldest-expiry stock is taken first. Large issues are sent to the owner for approval before stock moves.</div>}
      onSave={(v) => { const p = products.find((x) => x.id === v.productId)!; const a = issueStock(v.productId, v.ctn * p.packSize, v.code, v.note, user?.initials ?? "—"); onClose(); toast(a?.status === "pending" ? "Large issue sent to the owner for approval" : `${v.ctn} ctn of ${p.name} issued`); }} />
  );
}

function CountSheet({ lines, onClose }: { lines: CountLine[]; onClose: () => void }) {
  const products = useStore((s) => s.products);
  const sorted = [...lines].sort((a, b) => a.bin.localeCompare(b.bin));
  return (
    <Modal open onClose={onClose} title={`Count sheet · ${lines.length} lines`} width={760}>
      <div className="printable rounded-xl border border-line bg-white p-5 text-[#16201b]">
        <div className="flex justify-between"><div><div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">Stock count sheet (blind: no system quantities)</div></div><div className="text-right text-xs"><div>Date ____________</div><div className="mt-1">Counter ____________</div></div></div>
        <table className="mt-4 w-full text-xs"><thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Bin</th><th>Product</th><th>Batch</th><th>Expiry</th><th className="text-right">Cartons</th><th className="text-right">Loose pcs</th></tr></thead>
          <tbody>{sorted.map((l, i) => <tr key={i} className="border-b border-[#e4e8e2]"><td className="num py-2 font-bold">{l.bin}</td><td>{products.find((p) => p.id === l.productId)?.name}</td><td className="num">{l.batch}</td><td className="num">{l.expiry}</td><td className="text-right">________</td><td className="text-right">________</td></tr>)}</tbody></table>
        <div className="mt-6 text-[11px] text-[#8a968f]">Counted by ____________ · Checked by ____________</div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}

export default function Counts() {
  return <Suspense><CountsInner /></Suspense>;
}
