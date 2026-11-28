"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList, FileText, Truck, Boxes, Users, Wallet, PackageCheck, LayoutGrid, Package, Search,
  Moon, Sun, LogOut, Command, RotateCcw, Plus, ArrowRight, ShieldCheck, BarChart3, UserCog, Landmark, Route, Undo2, Gauge, MapPinned, Building2, History, MapPin, ArrowDownToLine, PackageOpen, ClipboardCheck, FileSpreadsheet, Hand,
} from "lucide-react";
import { HOME, useStore, useUser } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Avatar, ConfirmHost, Kbd, Modal, Toaster, ask, useHydrated, toast } from "./ui";
import SkeletonPage from "./Skeleton";
import { ACTION_BY_PATH, WH_ROLE_LABEL, can } from "@/lib/perm";
import { abcClasses, dueInfo } from "@/lib/counts";

type Badge = "counts" | "pack" | "putaway" | "orders" | "pick" | "invoice" | "receive" | "approvals" | "returns" | "dispatch" | "settle" | "plan";
type Nav = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; roles: Role[]; badge?: Badge };
const NAV: Nav[] = [
  { href: "/dashboard", label: "Today", icon: LayoutGrid, roles: ["admin", "sales", "purchasing", "warehouse"] },
  // Owner
  { href: "/approvals", label: "Approvals", icon: ShieldCheck, roles: ["admin"], badge: "approvals" },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { href: "/team", label: "Team & targets", icon: UserCog, roles: ["admin"] },
  // Back office
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ["admin", "sales"], badge: "orders" },
  { href: "/invoices", label: "Invoices", icon: FileText, roles: ["sales"], badge: "invoice" },
  { href: "/recovery", label: "Recovery", icon: Wallet, roles: ["sales"] },
  { href: "/settlements", label: "Trip settlement", icon: Landmark, roles: ["sales"], badge: "settle" },
  { href: "/customers", label: "Customers", icon: Users, roles: ["admin", "sales"] },
  { href: "/routes", label: "Routes", icon: MapPinned, roles: ["sales", "admin"] },
  { href: "/products", label: "Catalog & prices", icon: Package, roles: ["sales"] },
  { href: "/changelog", label: "Change log", icon: History, roles: ["sales", "admin"] },
  // Warehouse
  { href: "/receiving", label: "Inbound (GRN)", icon: PackageCheck, roles: ["warehouse"], badge: "receive" },
  { href: "/putaway", label: "Putaway", icon: ArrowDownToLine, roles: ["warehouse"], badge: "putaway" },
  { href: "/pick", label: "Pick & challan", icon: Truck, roles: ["warehouse"], badge: "pick" },
  { href: "/pack", label: "Pack & check", icon: PackageOpen, roles: ["warehouse"], badge: "pack" },
  { href: "/dispatch", label: "Dispatch", icon: Route, roles: ["warehouse"], badge: "dispatch" },
  { href: "/returns", label: "Returns", icon: Undo2, roles: ["warehouse"], badge: "returns" },
  { href: "/locations", label: "Locations", icon: MapPin, roles: ["warehouse", "admin"] },
  { href: "/counts", label: "Counts", icon: ClipboardCheck, roles: ["warehouse", "admin"], badge: "counts" },
  { href: "/wh-reports", label: "Warehouse reports", icon: FileSpreadsheet, roles: ["warehouse", "purchasing", "admin"] },
  // Purchasing
  { href: "/planner", label: "Reorder planner", icon: Gauge, roles: ["purchasing"], badge: "plan" },
  { href: "/receiving", label: "Orders & GRN", icon: PackageCheck, roles: ["purchasing"], badge: "receive" },
  { href: "/supplier-returns", label: "Supplier returns", icon: Undo2, roles: ["purchasing"] },
  { href: "/suppliers", label: "Suppliers", icon: Building2, roles: ["purchasing", "admin"] },
  { href: "/stock", label: "Stock", icon: Boxes, roles: ["admin", "sales", "warehouse", "purchasing"] },
];

export function useTheme() {
  const [t, setT] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const v = localStorage.getItem("theme") as "light" | "dark" | null;
      if (v) { setT(v); document.documentElement.dataset.theme = v; }
    } catch {}
  }, []);
  const toggle = () => {
    const n = t === "light" ? "dark" : "light";
    setT(n);
    document.documentElement.dataset.theme = n;
    try { localStorage.setItem("theme", n); } catch {}
  };
  return { t, toggle };
}

export function useDensity() {
  const [d, setD] = useState<"comfortable" | "touch">("comfortable");
  useEffect(() => {
    try {
      const v = localStorage.getItem("density") as "comfortable" | "touch" | null;
      const auto = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 1100;
      const pick = v ?? (auto ? "touch" : "comfortable");
      setD(pick); document.documentElement.dataset.density = pick;
    } catch {}
  }, []);
  const toggle = () => { const n = d === "touch" ? "comfortable" : "touch"; setD(n); document.documentElement.dataset.density = n; try { localStorage.setItem("density", n); } catch {} };
  return { d, toggle };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useUser();
  const router = useRouter();
  const path = usePathname();
  const orders = useStore((s) => s.orders);
  const purchases = useStore((s) => s.purchases);
  const logout = useStore((s) => s.logout);
  const reset = useStore((s) => s.reset);
  const { t, toggle } = useTheme();
  const { d: density, toggle: toggleDensity } = useDensity();
  const [pal, setPal] = useState(false);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);

  // short skeleton on every page change so screens never "pop" in half-drawn
  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), 320);
    return () => clearTimeout(t);
  }, [path]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.key === "?" || (e.key === "/" && e.shiftKey)) && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) { e.preventDefault(); setHelp((h) => !h); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/login");
    else if (["booker", "delivery", "recovery"].includes(user.role)) router.replace("/m");
  }, [hydrated, user, router]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal((p) => !p); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const returns = useStore((s) => s.returns);
  const trips = useStore((s) => s.trips);
  const approvals = useStore((s) => s.approvals);
  const grnsAll = useStore((s) => s.grns);
  const countSessions = useStore((s) => s.counts);
  const products = useStore((s) => s.products);
  useEffect(() => {
    const label = NAV.find((n) => path.startsWith(n.href))?.label;
    document.title = label ? `${label} · Zarie DMS` : "Zarie Distributors · DMS";
  }, [path]);

  const badges = useMemo(() => ({
    putaway: products.filter((p) => p.batches.some((b) => b.bin === "RCV" && b.qty > 0)).length,
    orders: orders.filter((o) => o.status === "booked" || (o.status === "hold" && !o.needsOwner)).length,
    pick: orders.filter((o) => o.status === "approved").length,
    invoice: orders.filter((o) => o.status === "picked" && o.packed).length,
    pack: orders.filter((o) => o.status === "picked" && !o.packed).length,
    counts: (() => { const cl = abcClasses(products); return products.filter((p) => p.status !== "unlisted" && p.batches.some((b) => b.qty > 0) && dueInfo(p, cl[p.id]).due).length + countSessions.filter((c) => c.status === "counting" || c.status === "review").length; })(),
    receive: user?.role === "purchasing"
      ? grnsAll.filter((g) => g.status === "counted").length + purchases.filter((p) => (p.status === "ordered" || p.status === "partial") && p.expectedAt < Date.now() - 12 * 3600000).length
      : purchases.filter((p) => (p.status === "ordered" || p.status === "partial") && p.expectedAt < new Date().setHours(23, 59, 59, 999)).length + grnsAll.filter((g) => g.status === "counting").length,
    approvals: approvals.filter((a) => a.status === "pending").length,
    returns: returns.filter((r) => r.status !== "graded").length,
    dispatch: orders.filter((o) => o.status === "invoiced" && !o.tripId).length + trips.filter((t) => t.status === "loading").length,
    settle: trips.filter((t) => t.status === "out" && t.orderIds.every((id) => orders.find((o) => o.id === id)?.status !== "invoiced")).length,
    plan: products.filter((p) => p.stock - p.reserved < p.reorder).length,
  }), [orders, purchases, returns, trips, approvals, products, grnsAll, countSessions, user?.role]);

  if (!hydrated || !user || ["booker", "delivery", "recovery"].includes(user.role)) {
    return <div className="grid h-screen place-items-center text-ink3">Loading…</div>;
  }
  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const current = nav.find((n) => path.startsWith(n.href));
  const kind = path.startsWith("/dashboard") ? "tiles" : ["/orders", "/pick", "/receiving", "/dispatch", "/returns", "/settlements", "/approvals", "/putaway", "/pack", "/counts"].some((x) => path.startsWith(x)) ? "split" : "table";

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-[210px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[15px] font-bold text-accentink">Z</div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-wide">ZARIE</div>
            <div className="text-[10px] font-medium tracking-[0.18em] text-ink3">DISTRIBUTORS</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {nav.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            const b = n.badge ? badges[n.badge] : 0;
            return (
              <Link key={n.href} href={n.href}
                className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${active ? "bg-accentsoft text-accent" : "text-ink2 hover:bg-panel2"}`}>
                <n.icon size={16} />
                <span className="flex-1">{n.label}</span>
                {b > 0 && <span className="num rounded-md bg-mute px-1.5 text-[11px] font-semibold" style={{ background: "var(--mute-bg)" }}>{b}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-line p-2">
          <button className="btn w-full justify-start border-transparent" onClick={async () => { if (await ask({ title: "Reset all demo data?", body: "Every order, stock change and setting you made returns to the starting data. This cannot be undone.", confirm: "Reset", danger: true })) { reset(); toast("Demo data reset"); } }}>
            <RotateCcw size={14} /> Reset demo data
          </button>
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <Avatar initials={user.initials} size={28} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-semibold">{user.name}</div>
              <div className="truncate text-[11px] text-ink3">{user.title}</div>
            </div>
            <button title="Sign out" className="rounded-md p-1.5 text-ink3 hover:bg-panel2" onClick={() => { logout(); router.replace("/login"); }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
          <div className="text-[13px] text-ink2">
            <span className="text-ink3">{user.title}</span> <span className="px-1 text-ink3">/</span>
            <span className="font-semibold text-ink">{nav.find((n) => path.startsWith(n.href))?.label ?? ""}</span>
          </div>
          <button onClick={() => setPal(true)}
            className="mx-auto flex h-9 w-full max-w-[460px] items-center gap-2 rounded-xl border border-line2 bg-bg px-3 text-ink3 hover:border-ink3">
            <Search size={15} /> <span className="flex-1 text-left text-[13px]">Search or jump to…</span>
            <Kbd>Ctrl</Kbd><Kbd>K</Kbd>
          </button>
          <span className="chip chip-mute">Lahore Depot</span>
          <button className={`btn h-9 w-9 justify-center px-0 ${density === "touch" ? "border-accent text-accent" : ""}`} onClick={toggleDensity} title={density === "touch" ? "Touch mode is on (bigger buttons). Click to switch off" : "Touch mode: bigger buttons for tablets"}><Hand size={15} /></button>
          <button className="btn h-9 w-9 justify-center px-0" onClick={toggle} title="Toggle theme">
            {t === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>
        {user.role === "warehouse" && (() => { const need = ACTION_BY_PATH.find(([p]) => path.startsWith(p))?.[1]; return need && !can(user, need) ? <div className="bg-[var(--info-bg)] px-5 py-1.5 text-center text-xs font-semibold text-[var(--info-fg)]">View only. Your role ({WH_ROLE_LABEL[user.whRole ?? "storekeeper"]}) cannot make changes on this screen. Ask the storekeeper.</div> : null; })()}
        {!online && <div className="bg-[var(--warn-bg)] px-5 py-1.5 text-center text-xs font-semibold text-[var(--warn-fg)]">You are offline. Changes are kept on this device and will not reach other devices until the connection returns.</div>}
        <main className="min-h-0 flex-1 overflow-auto p-4">{ready ? children : <SkeletonPage kind={kind} />}</main>
      </div>
      {pal && <Palette onClose={() => setPal(false)} role={user.role} />}
      {help && <HelpOverlay onClose={() => setHelp(false)} path={path} label={current?.label ?? ""} />}
      <Toaster />
      <ConfirmHost />
    </div>
  );
}

function Palette({ onClose, role }: { onClose: () => void; role: Role }) {
  const router = useRouter();
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const bins = useStore((s) => s.bins);
  const grns = useStore((s) => s.grns);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => inp.current?.focus(), []);

  const items = useMemo(() => {
    const out: { group: string; label: string; sub?: string; go: string }[] = [];
    const ql = q.toLowerCase().trim();
    for (const n of NAV.filter((n) => n.roles.includes(role))) out.push({ group: "Go to", label: n.label, go: n.href });
    if (role === "sales") out.unshift({ group: "Create", label: "New sales order", sub: "N", go: "/orders?new=1" });
    if (ql) {
      for (const o of orders) {
        const c = customers.find((x) => x.id === o.customerId);
        if ((o.folio + " " + (o.invoiceNo ?? "") + " " + (o.challanNo ?? "") + " " + (role === "warehouse" ? "" : c?.name ?? "")).toLowerCase().includes(ql))
          out.push({ group: "Orders", label: `${o.folio} · ${c?.name}${o.challanNo ? ` · ${o.challanNo}` : ""}`, go: role === "warehouse" ? "/pick" : `/orders?id=${o.id}` });
      }
      if (role === "warehouse" || role === "purchasing" || role === "admin") {
        const seen = new Set<string>();
        for (const p of products) for (const b of p.batches) { const k = `${p.id}|${b.no}`; if (!seen.has(k) && (b.no + " " + p.name).toLowerCase().includes(ql)) { seen.add(k); out.push({ group: "Batches", label: `${b.no} · ${p.name}`, sub: b.bin, go: `/stock?tab=trace&product=${p.id}&batch=${b.no}` }); } }
        for (const bn of bins) if (bn.code.toLowerCase().includes(ql)) out.push({ group: "Bins", label: bn.code, sub: bn.note ?? "", go: `/locations?q=${bn.code}` });
        for (const g of grns) if ((g.folio + " " + g.deliveryNote + " " + g.supplier).toLowerCase().includes(ql)) out.push({ group: "GRN", label: `${g.folio} · ${g.supplier}`, sub: g.deliveryNote, go: "/receiving" });
      }
      if (role !== "warehouse") for (const c of customers) if (c.name.toLowerCase().includes(ql)) out.push({ group: "Customers", label: c.name, sub: c.area, go: `/customers?id=${c.id}` });
      for (const p of products) if ((p.name + p.code).toLowerCase().includes(ql)) out.push({ group: "Products", label: p.name, sub: p.code, go: `/stock?q=${encodeURIComponent(p.name)}` });
    }
    return out.filter((x) => !ql || x.group !== "Go to" && x.group !== "Create" || (x.label + x.group).toLowerCase().includes(ql)).slice(0, 12);
  }, [q, role, customers, products, orders, bins, grns]);

  const go = (h: string) => { onClose(); router.push(h); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[14vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="panel pop w-full max-w-[560px] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Command size={16} className="text-ink3" />
          <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              if (e.key === "Enter" && items[i]) go(items[i].go);
            }}
            placeholder="Type an order, customer, product or page…" className="h-12 flex-1 bg-transparent text-[14px] outline-none" />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-[50vh] overflow-auto p-1.5">
          {items.length === 0 && <div className="p-6 text-center text-ink3">No matches</div>}
          {items.map((it, idx) => (
            <button key={idx} onMouseEnter={() => setI(idx)} onClick={() => go(it.go)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${idx === i ? "bg-accentsoft" : ""}`}>
              <span className="w-[74px] shrink-0 text-[10.5px] font-semibold uppercase tracking-wider text-ink3">{it.group}</span>
              <span className="flex-1 text-[13px] font-medium">{it.label}</span>
              {it.sub && <span className="text-xs text-ink3">{it.sub}</span>}
              {idx === i && <ArrowRight size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PAGE_KEYS: Record<string, [string, string][]> = {
  "/orders": [["J / K", "Move up and down the list"], ["Enter", "Main action (approve, invoice)"], ["N", "New order"], ["/", "Filter the list"], ["H", "Put order on hold"]],
  "/pick": [["Ctrl + Enter", "Confirm and create challan"]],
};
function HelpOverlay({ onClose, path, label }: { onClose: () => void; path: string; label: string }) {
  const page = Object.entries(PAGE_KEYS).find(([k]) => path.startsWith(k))?.[1] ?? [];
  const rows: [string, string][] = [["Ctrl + K", "Search or jump anywhere"], ["?", "Show this help"], ["Esc", "Close a window or cancel"], ["Tab / Shift + Tab", "Next / previous field"], ["Enter", "Save in a form"]];
  return (
    <Modal open onClose={onClose} title="Keyboard shortcuts" width={460}>
      <div className="space-y-4">
        {page.length > 0 && <div><div className="th mb-1.5">On {label}</div>{page.map(([k, d]) => <div key={k} className="flex items-center justify-between border-t border-line py-1.5 first:border-0"><span>{d}</span><Kbd>{k}</Kbd></div>)}</div>}
        <div><div className="th mb-1.5">Everywhere</div>{rows.map(([k, d]) => <div key={k} className="flex items-center justify-between border-t border-line py-1.5 first:border-0"><span>{d}</span><Kbd>{k}</Kbd></div>)}</div>
      </div>
    </Modal>
  );
}
export { Plus };
