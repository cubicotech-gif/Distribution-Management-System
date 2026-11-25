"use client";
import { useRouter } from "next/navigation";
import { ClipboardList, Truck, PackageCheck, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { HOME, useStore } from "@/lib/store";
import { Avatar, useHydrated } from "@/components/ui";

const ICON: Record<string, React.ReactNode> = {
  admin: <ShieldCheck size={18} />, sales: <ClipboardList size={18} />, warehouse: <Truck size={18} />,
  purchasing: <PackageCheck size={18} />, booker: <Smartphone size={18} />, delivery: <Truck size={18} />, recovery: <Wallet size={18} />,
};
const DESC: Record<string, string> = {
  admin: "Read-only dashboards, approvals for exceptions, reports, team targets",
  sales: "Orders, invoices, recovery, trip settlement, customers and prices",
  warehouse: "Receive and count, pick by expiry, load trucks, inspect returns",
  purchasing: "Reorder planner, factory POs, GRN approval, supplier returns",
  booker: "Mobile: route, book orders, live stock",
  delivery: "Mobile: today's deliveries, signature",
  recovery: "Mobile: collect payments, day-end cash",
};

export default function Login() {
  const users = useStore((s) => s.users);
  const login = useStore((s) => s.login);
  const router = useRouter();
  const ok = useHydrated();
  const enter = (id: string, role: keyof typeof HOME) => { login(id); router.push(HOME[role]); };
  const desk = users.filter((u) => !["booker", "delivery", "recovery"].includes(u.role));
  const field = users.filter((u) => ["booker", "delivery", "recovery"].includes(u.role));
  return (
    <div className="mx-auto flex min-h-screen max-w-[880px] flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-xl font-bold text-accentink">Z</div>
        <div>
          <div className="text-xl font-bold tracking-wide">Zarie Distributors</div>
          <div className="text-ink2">Distribution Management System · interactive demo</div>
        </div>
      </div>
      <p className="mb-6 max-w-xl text-[14px] leading-relaxed text-ink2">
        Pick a role to sign in. Everything is connected: an order booked on the booker&apos;s phone shows up on the Sales Desk,
        then the Warehouse, then Billing, then the delivery and recovery app. Try the whole chain by switching roles.
      </p>
      {!ok ? null : (
        <>
          <div className="th mb-2">Office (desktop)</div>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {desk.map((u) => (
              <button key={u.id} onClick={() => enter(u.id, u.role)} className="panel flex items-center gap-3 p-3.5 text-left transition hover:border-accent">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accentsoft text-accent">{ICON[u.role]}</span>
                <span className="flex-1">
                  <span className="block text-[14px] font-semibold">{u.title}</span>
                  <span className="block text-xs text-ink2">{DESC[u.role]}</span>
                </span>
                <Avatar initials={u.initials} size={26} />
              </button>
            ))}
          </div>
          <div className="th mb-2">Field staff (mobile)</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[field[0], field[3], field[4]].map((u) => (
              <button key={u.id} onClick={() => enter(u.id, u.role)} className="panel flex items-center gap-3 p-3.5 text-left transition hover:border-accent">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accentsoft text-accent">{ICON[u.role]}</span>
                <span className="flex-1">
                  <span className="block text-[14px] font-semibold">{u.title}</span>
                  <span className="block text-xs text-ink2">{DESC[u.role]}</span>
                </span>
                <Avatar initials={u.initials} size={26} />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mt-8 text-xs text-ink3">Demo data lives in your browser only. Use “Reset demo data” in the sidebar to start over.</div>
    </div>
  );
}
