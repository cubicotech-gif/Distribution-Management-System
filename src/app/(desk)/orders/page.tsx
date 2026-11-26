"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, orderTotal } from "@/lib/calc";
import { checkOrder } from "@/lib/check";
import { Avatar, Empty, Kbd, Spark, StatusChip, toast } from "@/components/ui";
import OrderDetail from "@/components/OrderDetail";
import NewOrder from "@/components/NewOrder";

type Tab = "all" | "approval" | "owner" | "invoice" | "delivery" | "overdue";

function Orders() {
  const params = useSearchParams();
  const router = useRouter();
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const users = useStore((s) => s.users);
  const approve = useStore((s) => s.approveOrder);
  const approvals = useStore((s) => s.approvals);
  const approveRequest = useStore((s) => s.approveRequest);
  const invoice = useStore((s) => s.invoiceOrder);
    const user = useUser();
  const by = user?.initials ?? "—";

  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(params.get("id"));
  const [creating, setCreating] = useState(params.get("new") === "1");
  const search = useRef<HTMLInputElement>(null);

  const enriched = useMemo(
    () => orders.map((o) => ({ o, c: customers.find((x) => x.id === o.customerId)!, chk: checkOrder(o, customers.find((x) => x.id === o.customerId), products) })),
    [orders, customers, products]
  );

  const counts = {
    over: enriched.filter((e) => e.o.status === "booked" && e.chk.over).length,
    short: enriched.filter((e) => e.o.status === "booked" && e.chk.short.length).length,
    ready: enriched.filter((e) => e.o.status === "picked" && e.o.packed).length,
  };

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return enriched.filter(({ o, c, chk }) => {
      if (tab === "approval" && !(o.status === "booked" || (o.status === "hold" && !o.needsOwner))) return false;
      if (tab === "owner" && !(o.status === "hold" && o.needsOwner)) return false;
      if (tab === "invoice" && !(o.status === "picked" && o.packed)) return false;
      if (tab === "delivery" && o.status !== "invoiced") return false;
      if (tab === "overdue" && !(c.type === "credit" && c.oldestDue > c.creditDays)) return false;
      if (ql && !(o.folio + c.name + (o.invoiceNo ?? "")).toLowerCase().includes(ql)) return false;
      void chk;
      return true;
    });
  }, [enriched, tab, q]);

  const cur = list.find((e) => e.o.id === sel) ?? list[0];

  const isOwner = user?.role === "admin";
  const primary = (() => {
    if (!cur) return undefined;
    const { o } = cur;
    if (isOwner) {
      const req = approvals.find((a) => a.kind === "order" && a.refId === o.id && a.status === "pending");
      return req ? { label: "Approve as owner", run: () => { approveRequest(req.id, by); toast(`${o.folio} approved by owner`); } } : undefined;
    }
    if (o.status === "hold" && o.needsOwner) return undefined;
    if (o.status === "booked" || o.status === "hold")
      return { label: "Approve order", run: () => {
        const r = approve(o.id, by);
        toast(r.ok ? `${o.folio} approved. Stock reserved, sent to warehouse` : `Needs owner approval: ${r.reasons?.[0]}`);
      } };
    if (o.status === "picked" && o.packed)
      return { label: "Create invoice", run: () => { invoice(o.id, by); toast(`Invoice issued for ${o.folio}`); } };
    return undefined;
  })();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || creating || e.ctrlKey || e.metaKey) return;
      const i = list.findIndex((x) => x.o.id === cur?.o.id);
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); const n = list[Math.min(list.length - 1, i + 1)]; if (n) setSel(n.o.id); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); const n = list[Math.max(0, i - 1)]; if (n) setSel(n.o.id); }
      else if (e.key === "n" && !isOwner) { e.preventDefault(); setCreating(true); }
      else if (e.key === "/") { e.preventDefault(); search.current?.focus(); }
      else if (e.key === "Enter" && primary) { e.preventDefault(); primary.run(); }
      else if (e.key === "h" && !isOwner && cur?.o.status === "booked") { useStore.getState().holdOrder(cur.o.id, by); toast("Order put on hold"); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [list, cur, primary, creating, by, isOwner]);

  useEffect(() => {
    cur && document.getElementById(`row-${cur.o.id}`)?.scrollIntoView({ block: "nearest" });
  }, [cur?.o.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { k: Tab; l: string; n?: number }[] = [
    { k: "all", l: "All" },
    { k: "approval", l: "Needs approval", n: enriched.filter((e) => e.o.status === "booked" || (e.o.status === "hold" && !e.o.needsOwner)).length },
    { k: "owner", l: "Waiting for owner", n: enriched.filter((e) => e.o.status === "hold" && e.o.needsOwner).length },
    { k: "invoice", l: "Ready to invoice", n: counts.ready },
    { k: "delivery", l: "Out for delivery" },
    { k: "overdue", l: "Overdue customers" },
  ];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setTab("approval")} className="chip chip-warn cursor-pointer !px-3 !py-1.5">⚠ {counts.over} over credit limit</button>
        <button onClick={() => setTab("approval")} className="chip chip-bad cursor-pointer !px-3 !py-1.5">● {counts.short} short on stock</button>
        <button onClick={() => setTab("invoice")} className="chip chip-ok cursor-pointer !px-3 !py-1.5">✓ {counts.ready} ready to invoice</button>
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-panel p-1">
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors ${tab === t.k ? "bg-accent text-accentink" : "text-ink2 hover:bg-panel2"}`}>
              {t.l}{t.n ? <span className="num rounded bg-black/10 px-1 text-[10.5px]">{t.n}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,38%)_1fr] gap-3">
        <div className="panel flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-line p-2.5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2.5 text-ink3" />
              <input ref={search} className="field" style={{ paddingLeft: 32 }} placeholder="Filter orders…  ( / )" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (e.target as HTMLElement).blur()} />
            </div>
            {!isOwner && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> New <Kbd>N</Kbd></button>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {list.length === 0 && <Empty title="No orders here" hint="Try another view or clear the filter" />}
            {list.map(({ o, c, chk }, idx) => {
              const bk = users.find((u) => u.id === o.bookerId);
              return (
                <button id={`row-${o.id}`} key={o.id} onClick={() => setSel(o.id)}
                  className={`row-hover flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left ${cur?.o.id === o.id ? "row-sel" : ""} ${idx === 0 ? "slidein" : ""}`}>
                  <Avatar initials={bk?.initials ?? "—"} size={30} tone={bk ? users.indexOf(bk) : 0} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{c.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink3">
                      <span className="num">{o.folio}</span><span>·</span><span>{ago(o.createdAt)}</span>
                      {(chk.over || chk.short.length > 0) && o.status === "booked" && <span className="font-semibold text-[var(--warn-fg)]">· needs attention</span>}
                    </div>
                  </div>
                  <Spark seed={parseInt(c.id.slice(1), 10)} />
                  <div className="flex flex-col items-end gap-1">
                    <span className="num text-[13px] font-semibold">{fmt(orderTotal(o))}</span>
                    <StatusChip status={o.status} packed={o.packed} held={!!o.pickHold} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel min-h-0 overflow-hidden">
          {cur ? <OrderDetail o={cur.o} primary={primary} /> : <Empty title="Select an order" hint="Use J / K to move through the list" />}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-3 text-[11px] text-ink3">
        <span><Kbd>J</Kbd> <Kbd>K</Kbd> move</span><span><Kbd>/</Kbd> filter</span><span><Kbd>N</Kbd> new order</span><span><Kbd>↵</Kbd> primary action</span><span><Kbd>Ctrl</Kbd> <Kbd>K</Kbd> commands</span>
      </div>

      {creating && (
        <NewOrder
          onClose={() => { setCreating(false); router.replace("/orders"); }}
          onCreated={(id) => { setCreating(false); setSel(id); setTab("all"); router.replace("/orders"); }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><Orders /></Suspense>;
}
