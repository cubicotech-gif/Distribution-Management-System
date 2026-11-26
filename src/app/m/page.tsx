"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Route as RouteIcon, ClipboardList, Boxes, Truck, Wallet, LogOut, Moon, Sun, ChevronLeft, Minus, Plus, MapPin } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { available, creditUsedPct, fmt, lineNet, orderTotal, rateFor, totals, ago, withScheme } from "@/lib/calc";
import type { Customer, Line, Product, ReturnReason, Unit } from "@/lib/types";
import { Avatar, CreditMeter, Meter, StatusChip, Thumb, Toaster, toast, useHydrated } from "@/components/ui";
import { useTheme } from "@/components/AppShell";

type Tab = "route" | "orders" | "stock" | "trip" | "collect";

export default function Mobile() {
  const ok = useHydrated();
  const user = useUser();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const { t, toggle } = useTheme();
  const role = user?.role;
  const tabs: { k: Tab; l: string; icon: React.ReactNode }[] =
    role === "delivery"
      ? [{ k: "trip", l: "Deliveries", icon: <Truck size={20} /> }, { k: "stock", l: "Stock", icon: <Boxes size={20} /> }]
      : role === "recovery"
      ? [{ k: "collect", l: "Collect", icon: <Wallet size={20} /> }, { k: "orders", l: "Invoices", icon: <ClipboardList size={20} /> }]
      : [{ k: "route", l: "Route", icon: <RouteIcon size={20} /> }, { k: "orders", l: "Orders", icon: <ClipboardList size={20} /> }, { k: "stock", l: "Stock", icon: <Boxes size={20} /> }];
  const [tab, setTab] = useState<Tab | null>(null);
  const [order, setOrder] = useState<string | null>(null); // customer id for new order

  useEffect(() => {
    if (!ok) return;
    if (!user) router.replace("/login");
    else if (!["booker", "delivery", "recovery"].includes(user.role)) router.replace("/orders");
  }, [ok, user, router]);

  if (!ok || !user || !["booker", "delivery", "recovery"].includes(user.role)) return <div className="grid h-full place-items-center text-ink3">Loading…</div>;
  const cur = tab ?? tabs[0].k;

  if (order) return <NewOrderM customerId={order} onBack={() => setOrder(null)} onDone={() => { setOrder(null); setTab("orders"); }} />;

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-3">
        <Avatar initials={user.initials} size={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[14px] font-bold">{user.name}</div>
          <div className="text-[11px] text-ink3">{user.title} · Lahore Depot</div>
        </div>
        <button className="p-2 text-ink2" onClick={toggle}>{t === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="p-2 text-ink2" onClick={() => { logout(); router.replace("/login"); }}><LogOut size={18} /></button>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">
        {cur === "route" && <RouteView onStart={setOrder} />}
        {cur === "orders" && <OrdersView />}
        {cur === "stock" && <StockView />}
        {cur === "trip" && <TripView />}
        {cur === "collect" && <CollectView />}
      </main>
      <nav className="flex shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
        {tabs.map((x) => (
          <button key={x.k} onClick={() => setTab(x.k)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${cur === x.k ? "text-accent" : "text-ink3"}`}>
            {x.icon}{x.l}
          </button>
        ))}
      </nav>
      <Toaster />
    </>
  );
}

function RouteView({ onStart }: { onStart: (c: string) => void }) {
  const user = useUser()!;
  const customers = useStore((s) => s.customers).filter((c) => c.bookerId === user.id);
  const orders = useStore((s) => s.orders);
  const route = customers[0]?.route ?? "";
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const done = (c: Customer) => orders.some((o) => o.customerId === c.id && o.bookerId === user.id && o.createdAt >= todayStart.getTime() && o.status !== "cancelled");
  const visited = customers.filter(done).length;
  const next = customers.find((c) => !done(c));
  return (
    <div className="p-4">
      <div className="mb-3">
        <div className="th">Today&apos;s route</div>
        <div className="text-[20px] font-bold leading-tight">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</div>
        <div className="mt-2 flex items-center justify-between text-xs text-ink2"><span><span className="num font-semibold text-ink">{visited}</span> of {customers.length} visits done</span><span className="num">{route}</span></div>
        <div className="mt-1.5"><Meter pct={customers.length ? (visited / customers.length) * 100 : 0} /></div>
      </div>
      <div className="space-y-2.5">
        {customers.map((c, i) => {
          const d = done(c);
          const isNext = next?.id === c.id;
          return (
            <div key={c.id} className={`panel p-3.5 ${isNext ? "border-accent" : ""}`} style={isNext ? { boxShadow: "inset 4px 0 0 var(--accent), var(--shadow)" } : undefined}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="text-[14.5px] font-semibold">{c.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink3"><MapPin size={12} /> {c.area} · {(0.4 + i * 0.7).toFixed(1)} km</div>
                  <div className="num mt-1 text-xs text-ink2">Bal Rs. {fmt(c.balance)}</div>
                </div>
                <span className={`chip ${d ? "chip-ok" : "chip-mute"}`}>{d ? "Ordered" : "Pending"}</span>
              </div>
              {(isNext || !d) && <button className={`btn mt-3 h-11 w-full justify-center text-[14px] ${isNext ? "btn-primary" : ""}`} onClick={() => onStart(c.id)}>{d ? "Add another order" : "Start order →"}</button>}
            </div>
          );
        })}
        {customers.length === 0 && <div className="p-8 text-center text-ink3">No customers assigned</div>}
      </div>
    </div>
  );
}

function NewOrderM({ customerId, onBack, onDone }: { customerId: string; onBack: () => void; onDone: () => void }) {
  const user = useUser()!;
  const c = useStore((s) => s.customers.find((x) => x.id === customerId))!;
  const allProducts = useStore((s) => s.products);
  const products = allProducts.filter((p) => p.status === "active");
  const orders = useStore((s) => s.orders);
  const create = useStore((s) => s.createOrder);
  const schemes = useStore((s) => s.schemes);
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const last = orders.find((o) => o.customerId === c.id && o.status !== "cancelled");
  const priced = lines.map((l) => withScheme(schemes, l));
  const t = totals(priced);
  const hits = q ? products.filter((p) => (p.name + p.code).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const add = (p: Product) => { setLines((ls) => ls.some((l) => l.productId === p.id) ? ls.map((l) => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l) : [...ls, { productId: p.id, unit: "ctn", qty: 1, rate: rateFor(p, "ctn"), discPct: 0 }]); setQ(""); };
  const projected = c.balance + t.total;
  return (
    <>
      <header className="shrink-0 border-b border-line bg-panel px-3 py-3">
        <div className="flex items-center gap-2"><button className="p-1.5" onClick={onBack}><ChevronLeft size={22} /></button>
          <div className="flex-1"><div className="text-[11px] text-ink3">New order</div><div className="text-[16px] font-bold leading-tight">{c.name}</div></div></div>
        <div className="mt-2 rounded-xl border border-line bg-panel2 p-2.5">
          <div className="flex justify-between text-xs"><span className="num">Bal Rs. {fmt(c.balance)}</span><span className={`font-semibold ${creditUsedPct(c) >= 70 ? "text-[var(--warn-fg)]" : "text-ink2"}`}>{c.type === "credit" ? `${creditUsedPct(c)}% used` : "Cash"}</span></div>
          {c.type === "credit" && <div className="mt-1.5"><Meter pct={creditUsedPct(c)} /></div>}
          {c.type === "credit" && projected > c.creditLimit && <div className="mt-1.5 text-[11.5px] font-semibold text-[var(--bad-fg)]">This order exceeds the credit limit. The desk will review it.</div>}
        </div>
      </header>
      <main className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {last && <button className="btn h-11 w-full justify-center border-accent text-accent" onClick={() => setLines(last.lines.map((l) => ({ ...l, pickedQty: undefined })))}>Repeat last order</button>}
        <div className="relative">
          <input className="field h-11 text-[14px]" placeholder="Add product…" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.length > 0 && <div className="panel absolute z-10 mt-1 w-full p-1">{hits.map((p) => (
            <button key={p.id} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left active:bg-accentsoft" onClick={() => add(p)}>
              <Thumb p={p} size={30} /><span className="flex-1 font-medium">{p.name}</span><span className="chip chip-ok num">{Math.floor(available(p) / p.packSize)} ctn</span>
            </button>))}</div>}
        </div>
        {lines.length === 0 && <div className="py-10 text-center text-ink3">Search a product or repeat the last order</div>}
        {lines.map((l, i) => {
          const p = products.find((x) => x.id === l.productId)!;
          const avCtn = Math.floor(available(p) / (l.unit === "ctn" ? p.packSize : 1));
          const low = l.qty > avCtn;
          return (
            <div key={i} className="panel p-3">
              <div className="flex items-center gap-3">
                <Thumb p={p} size={40} />
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{p.name}</div><div className="num text-xs text-ink3">Rs. {fmt(l.rate)} / {l.unit}</div>{priced[i].scheme && <div className="text-[11px] font-semibold text-accent">{priced[i].scheme}</div>}</div>
                <div className="num text-[14px] font-bold">{fmt(lineNet(priced[i]))}</div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex rounded-lg border border-line2 p-0.5 text-xs font-semibold">
                  {(["ctn", "pcs"] as Unit[]).map((u) => <button key={u} onClick={() => set(i, { unit: u, rate: rateFor(p, u) })} className={`rounded-md px-2.5 py-1 uppercase ${l.unit === u ? "bg-accent text-accentink" : "text-ink2"}`}>{u}</button>)}
                </div>
                <span className={`chip num ${low ? "chip-warn" : "chip-ok"}`}>{low ? `Short · ${avCtn}` : `In stock ${avCtn}`}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button className="grid h-10 w-10 place-items-center rounded-xl border border-line2 active:bg-panel2" onClick={() => l.qty <= 1 ? setLines(lines.filter((_, k) => k !== i)) : set(i, { qty: l.qty - 1 })}><Minus size={18} /></button>
                  <input className="num h-10 w-12 rounded-xl border border-line2 bg-panel text-center text-[16px] font-bold outline-none" type="number" inputMode="numeric" value={l.qty} onChange={(e) => set(i, { qty: Math.max(0, +e.target.value) })} />
                  <button className="grid h-10 w-10 place-items-center rounded-xl border border-line2 active:bg-panel2" onClick={() => set(i, { qty: l.qty + 1 })}><Plus size={18} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </main>
      <footer className="shrink-0 border-t border-line bg-panel p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-end justify-between"><span className="text-xs text-ink2"><span className="num font-semibold text-ink">{lines.length}</span> items · incl. 18% tax</span><span className="num text-[22px] font-bold text-accent">Rs. {fmt(t.total)}</span></div>
        <button className="btn btn-primary h-12 w-full justify-center text-[15px]" disabled={!lines.length}
          onClick={() => { create(c.id, lines.filter((l) => l.qty > 0), user.id); toast("Order submitted to Sales Desk"); onDone(); }}>Submit order →</button>
      </footer>
      <Toaster />
    </>
  );
}

function OrdersView() {
  const user = useUser()!;
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const mine = orders.filter((o) => user.role === "booker" ? o.bookerId === user.id : ["invoiced", "delivered", "paid"].includes(o.status));
  return (
    <div className="space-y-2.5 p-4">
      <div className="text-[18px] font-bold">{user.role === "booker" ? "My orders" : "Invoices"}</div>
      {mine.map((o) => (
        <div key={o.id} className="panel flex items-center gap-3 p-3.5">
          <div className="min-w-0 flex-1"><div className="truncate font-semibold">{customers.find((c) => c.id === o.customerId)?.name}</div><div className="num text-[11px] text-ink3">{o.invoiceNo ?? o.folio} · {ago(o.createdAt)}</div></div>
          <div className="flex flex-col items-end gap-1"><span className="num font-semibold">{fmt(orderTotal(o))}</span><StatusChip status={o.status} /></div>
        </div>
      ))}
      {mine.length === 0 && <div className="py-12 text-center text-ink3">Nothing yet</div>}
    </div>
  );
}

function StockView() {
  const products = useStore((s) => s.products).filter((p) => p.status === "active");
  const [q, setQ] = useState("");
  return (
    <div className="p-4">
      <div className="mb-2 text-[18px] font-bold">Live stock</div>
      <input className="field mb-3 h-11 text-[14px]" placeholder="Search product…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {products.filter((p) => (p.name + p.code).toLowerCase().includes(q.toLowerCase())).map((p) => {
          const a = Math.floor(available(p) / p.packSize);
          return <div key={p.id} className="panel flex items-center gap-3 p-3"><Thumb p={p} size={34} /><div className="flex-1"><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">Rs. {fmt(p.cartonPrice)} / ctn</div></div><span className={`chip num ${a < p.reorder / p.packSize ? "chip-warn" : "chip-ok"}`}>{a} ctn</span></div>;
        })}
      </div>
    </div>
  );
}

function TripView() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const trips = useStore((s) => s.trips);
  const deliver = useStore((s) => s.deliverOrder);
  const report = useStore((s) => s.reportReturn);
  const user = useUser()!;
  const [ret, setRet] = useState<string | null>(null);
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<ReturnReason>("refused");
  const myTrips = trips.filter((t) => t.driverId === user.id && t.status !== "closed");
  const out = myTrips.filter((t) => t.status === "out");
  const stops = out.flatMap((t) => t.orderIds.map((id) => orders.find((o) => o.id === id)!)).filter(Boolean);
  const todo = stops.filter((o) => o.status === "invoiced");
  const done = stops.filter((o) => o.status !== "invoiced");
  const waiting = myTrips.filter((t) => t.status === "loading");
  const rOrder = orders.find((o) => o.id === ret);
  return (
    <div className="space-y-3 p-4">
      <div><div className="th">Trip sheet · {out[0]?.folio ?? "no trip"}</div><div className="text-[20px] font-bold">{todo.length} deliveries to go</div></div>
      {waiting.length > 0 && <div className="rounded-xl border border-line bg-panel p-3 text-xs text-ink2">{waiting[0].folio} is being loaded at the warehouse. You will see the stops when it is dispatched.</div>}
      {todo.map((o, i) => {
        const c = customers.find((x) => x.id === o.customerId)!;
        return (
          <div key={o.id} className="panel p-3.5">
            <div className="flex items-start justify-between">
              <div className="flex gap-3"><span className="num grid h-7 w-7 place-items-center rounded-full bg-accentsoft text-[12px] font-bold text-accent">{i + 1}</span><div><div className="text-[15px] font-semibold">{c.name}</div><div className="flex items-center gap-1 text-[11.5px] text-ink3"><MapPin size={12} />{c.area} · {c.phone}</div></div></div>
              <span className="num text-xs text-ink2">{o.invoiceNo}</span>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-ink2">{o.lines.map((l, k) => <div key={k} className="flex justify-between"><span>{products.find((p) => p.id === l.productId)?.name}</span><span className="num font-semibold">{l.qty} {l.unit}</span></div>)}</div>
            <div className="mt-3 flex gap-2">
              <button className="btn h-12 flex-1 justify-center" onClick={() => { setRet(o.id); setPid(o.lines[0].productId); setQty(1); }}>Return / refuse</button>
              <button className="btn btn-primary h-12 flex-[2] justify-center text-[15px]" onClick={() => { deliver(o.id, user.initials); toast("Delivered. KE will collect the signature"); }}>Delivered ✓</button>
            </div>
          </div>
        );
      })}
      {todo.length === 0 && out.length > 0 && <div className="py-8 text-center text-ink3">All stops done. Head back to the depot.</div>}
      {out.length === 0 && waiting.length === 0 && <div className="py-12 text-center text-ink3">No trip assigned. The warehouse creates a load sheet when invoices are ready.</div>}
      {done.length > 0 && <div className="th pt-2">Done</div>}
      {done.map((o) => <div key={o.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-ink2"><span>{customers.find((c) => c.id === o.customerId)?.name}</span><StatusChip status={o.status} /></div>)}
      {rOrder && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setRet(null)}>
          <div className="mx-auto w-full max-w-[430px] space-y-3 rounded-t-2xl bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[16px] font-bold">Goods coming back</div>
            <select className="field h-11" value={pid} onChange={(e) => setPid(e.target.value)}>{rOrder.lines.map((l) => <option key={l.productId} value={l.productId}>{products.find((p) => p.id === l.productId)?.name}</option>)}</select>
            <div className="flex gap-2"><input className="field num h-11 flex-1 text-[16px] font-bold" type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} /><span className="grid place-items-center text-xs text-ink2">pcs</span>
              <select className="field h-11 flex-[2]" value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>{["refused", "damaged", "expired", "wrong item", "old packaging"].map((r) => <option key={r}>{r}</option>)}</select></div>
            <button className="btn btn-primary h-12 w-full justify-center text-[15px]" onClick={() => { report(rOrder.id, pid, qty, reason, user.initials); toast("Return noted. Bring it back to the warehouse"); setRet(null); }}>Save return</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Signature({ onSave }: { onSave: (d: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [has, setHas] = useState(false);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return (
    <div>
      <canvas ref={ref} width={360} height={110} className="w-full touch-none rounded-xl border border-dashed border-line2 bg-white"
        onPointerDown={(e) => { drawing.current = true; const g = ref.current!.getContext("2d")!; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const g = ref.current!.getContext("2d")!; const [x, y] = pos(e); g.lineWidth = 2; g.lineCap = "round"; g.strokeStyle = "#16201b"; g.lineTo(x, y); g.stroke(); setHas(true); }}
        onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)} />
      <div className="mt-2 flex gap-2">
        <button className="btn h-10 flex-1 justify-center" onClick={() => { ref.current!.getContext("2d")!.clearRect(0, 0, 360, 110); setHas(false); }}>Clear</button>
        <button className="btn btn-primary h-10 flex-[2] justify-center" disabled={!has} onClick={() => onSave(ref.current!.toDataURL())}>Save signature</button>
      </div>
    </div>
  );
}

function CollectView() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const sign = useStore((s) => s.signOrder);
  const file = useStore((s) => s.fileOrder);
  const collect = useStore((s) => s.collect);
  const payments = useStore((s) => s.payments);
  const user = useUser()!;
  const [amt, setAmt] = useState<Record<string, number>>({});
  const trips = useStore((s) => s.trips);
  const mine = trips.filter((t) => t.keId === user.id && t.status !== "closed").flatMap((t) => t.orderIds);
  const open = useMemo(() => orders.filter((o) => mine.includes(o.id) && o.status === "delivered" && !o.filed), [orders, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const cash = payments.filter((p) => p.by === user.initials && p.mode === "cash" && Date.now() - p.at < 86400000).reduce((s, p) => s + p.amount, 0);
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-end justify-between"><div><div className="th">KE · recovery</div><div className="text-[20px] font-bold">{open.length} to sign & collect</div></div>
        <div className="text-right"><div className="th">Cash today</div><div className="num text-[16px] font-bold text-accent">Rs. {fmt(cash)}</div></div></div>
      {open.map((o) => {
        const c = customers.find((x) => x.id === o.customerId)!;
        const due = Math.round(orderTotal(o) - o.paid);
        const a = amt[o.id] ?? (c.type === "cash" ? due : 0);
        return (
          <div key={o.id} className="panel space-y-3 p-3.5">
            <div className="flex items-start justify-between"><div><div className="text-[15px] font-semibold">{c.name}</div><div className="num text-[11.5px] text-ink3">{o.invoiceNo} · {c.type === "credit" ? `Credit ${c.creditDays}d` : "Cash sale"}</div></div><span className="num font-bold">{fmt(due)}</span></div>
            {!o.signature ? (
              <div><div className="th mb-1.5">Customer signature on invoice</div><Signature onSave={(d) => { sign(o.id, d); toast("Signature saved"); }} /></div>
            ) : <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ok-fg)]">✓ Signed <img src={o.signature} alt="signature" className="h-8 rounded border border-line bg-white" /></div>}
            {o.signature && (
              <div className="flex items-center gap-2">
                <input className="field num h-11 flex-1 text-[16px] font-bold" type="number" inputMode="numeric" value={a} onChange={(e) => setAmt({ ...amt, [o.id]: Math.max(0, +e.target.value) })} />
                <button className="btn btn-primary h-11 px-5 text-[14px]" onClick={() => { if (a > 0) collect(o.customerId, Math.min(a, due), user.initials, o.id); if (a < due) file(o.id); toast(a > 0 ? "Payment collected" : "Invoice filed on credit"); }}>{a > 0 ? "Collect" : "File invoice"}</button>
              </div>
            )}
          </div>
        );
      })}
      {open.length === 0 && <div className="py-12 text-center text-ink3">Nothing waiting. Delivered orders appear here for signature and cash.</div>}
    </div>
  );
}
