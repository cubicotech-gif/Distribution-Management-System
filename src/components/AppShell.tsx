"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList, FileText, Truck, Boxes, Users, Wallet, PackageCheck, LayoutGrid, Package, Search,
  Moon, Sun, LogOut, Command, RotateCcw, Plus, ArrowRight, ShieldCheck, BarChart3, UserCog, Landmark, Route, Undo2, Gauge,
} from "lucide-react";
import { HOME, useStore, useUser } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Avatar, Kbd, Toaster, useHydrated, toast } from "./ui";

type Badge = "orders" | "pick" | "invoice" | "receive" | "approvals" | "returns" | "dispatch" | "settle" | "plan";
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
  { href: "/products", label: "Products & prices", icon: Package, roles: ["sales"] },
  // Warehouse
  { href: "/receiving", label: "Inbound (GRN)", icon: PackageCheck, roles: ["warehouse"], badge: "receive" },
  { href: "/pick", label: "Pick & challan", icon: Truck, roles: ["warehouse"], badge: "pick" },
  { href: "/dispatch", label: "Dispatch", icon: Route, roles: ["warehouse"], badge: "dispatch" },
  { href: "/returns", label: "Returns", icon: Undo2, roles: ["warehouse"], badge: "returns" },
  // Purchasing
  { href: "/planner", label: "Reorder planner", icon: Gauge, roles: ["purchasing"], badge: "plan" },
  { href: "/receiving", label: "Orders & GRN", icon: PackageCheck, roles: ["purchasing"], badge: "receive" },
  { href: "/supplier-returns", label: "Supplier returns", icon: Undo2, roles: ["purchasing"] },
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
  const [pal, setPal] = useState(false);

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
  const products = useStore((s) => s.products);
  const badges = useMemo(() => ({
    orders: orders.filter((o) => o.status === "booked" || (o.status === "hold" && !o.needsOwner)).length,
    pick: orders.filter((o) => o.status === "approved").length,
    invoice: orders.filter((o) => o.status === "picked").length,
    receive: purchases.filter((p) => p.status !== "approved").length,
    approvals: approvals.filter((a) => a.status === "pending").length,
    returns: returns.filter((r) => r.status === "pending").length,
    dispatch: orders.filter((o) => o.status === "invoiced" && !o.tripId).length + trips.filter((t) => t.status === "loading").length,
    settle: trips.filter((t) => t.status === "out" && t.orderIds.every((id) => orders.find((o) => o.id === id)?.status !== "invoiced")).length,
    plan: products.filter((p) => p.stock - p.reserved < p.reorder).length,
  }), [orders, purchases, returns, trips, approvals, products]);

  if (!hydrated || !user || ["booker", "delivery", "recovery"].includes(user.role)) {
    return <div className="grid h-screen place-items-center text-ink3">Loading…</div>;
  }
  const nav = NAV.filter((n) => n.roles.includes(user.role));

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
          <button className="btn w-full justify-start border-transparent" onClick={() => { reset(); toast("Demo data reset"); }}>
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
          <button className="btn h-9 w-9 justify-center px-0" onClick={toggle} title="Toggle theme">
            {t === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
      {pal && <Palette onClose={() => setPal(false)} role={user.role} />}
      <Toaster />
    </div>
  );
}

function Palette({ onClose, role }: { onClose: () => void; role: Role }) {
  const router = useRouter();
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
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
        if ((o.folio + " " + (o.invoiceNo ?? "") + " " + (c?.name ?? "")).toLowerCase().includes(ql))
          out.push({ group: "Orders", label: `${o.folio} · ${c?.name}`, go: `/orders?id=${o.id}` });
      }
      for (const c of customers) if (c.name.toLowerCase().includes(ql)) out.push({ group: "Customers", label: c.name, sub: c.area, go: `/customers?id=${c.id}` });
      for (const p of products) if ((p.name + p.code).toLowerCase().includes(ql)) out.push({ group: "Products", label: p.name, sub: p.code, go: `/stock?q=${encodeURIComponent(p.name)}` });
    }
    return out.filter((x) => !ql || x.group !== "Go to" && x.group !== "Create" || (x.label + x.group).toLowerCase().includes(ql)).slice(0, 12);
  }, [q, role, customers, products, orders]);

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
export { Plus };
