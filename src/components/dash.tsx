"use client";
import Link from "next/link";

export function Tile({ label, value, sub, href, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; tone?: "warn" | "bad" | "ok" }) {
  const col = tone === "bad" ? "var(--bad-fg)" : tone === "warn" ? "var(--warn-fg)" : tone === "ok" ? "var(--ok-fg)" : "var(--ink)";
  const inner = (
    <div className="panel h-full p-4 transition hover:border-accent">
      <div className="th">{label}</div>
      <div className="num mt-1 text-[26px] font-bold leading-tight" style={{ color: col }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-ink2">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export function Card({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`panel p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between"><div className="text-[13px] font-semibold">{title}</div>{action}</div>
      {children}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-0">{children}</div>;
}

export function Bars({ data, labels, h = 110 }: { data: number[]; labels?: string[]; h?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: h }}>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(4, (v / max) * (h - 18))}px`, background: i === data.length - 1 ? "var(--accent)" : "var(--accent-soft)" }} title={String(Math.round(v))} />
          {labels && <div className="num text-[9.5px] text-ink3">{labels[i]}</div>}
        </div>
      ))}
    </div>
  );
}
