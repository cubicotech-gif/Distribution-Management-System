"use client";

const B = ({ w = "100%", h = 14, r }: { w?: number | string; h?: number; r?: number }) => <div className="skel" style={{ width: w, height: h, borderRadius: r }} />;

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel p-4 ${className}`}>{children}</div>;
}

export default function SkeletonPage({ kind }: { kind: "tiles" | "split" | "table" }) {
  if (kind === "tiles")
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4" aria-busy="true" aria-label="Loading">
        <div><B w={220} h={24} /><div className="mt-2"><B w={380} /></div></div>
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Panel key={i}><B w={90} h={10} /><div className="mt-3"><B w={130} h={26} /></div><div className="mt-2"><B w={110} h={10} /></div></Panel>)}</div>
        <div className="grid grid-cols-3 gap-3"><Panel className="col-span-2"><B w={140} /><div className="mt-4"><B h={110} /></div></Panel><Panel><B w={120} /><div className="mt-4 space-y-3"><B /><B /><B /></div></Panel></div>
      </div>
    );
  if (kind === "split")
    return (
      <div className="flex h-full flex-col gap-3" aria-busy="true" aria-label="Loading">
        <div className="flex gap-2"><B w={150} h={30} r={999} /><B w={150} h={30} r={999} /><div className="ml-auto"><B w={420} h={34} /></div></div>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,36%)_1fr] gap-3">
          <Panel className="space-y-3">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="flex items-center gap-3"><B w={32} h={32} r={999} /><div className="flex-1 space-y-2"><B w="70%" /><B w="40%" h={10} /></div><B w={60} h={22} r={999} /></div>)}</Panel>
          <Panel className="space-y-4"><B w={260} h={24} /><B h={16} /><B h={64} /><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <B key={i} h={26} />)}</div></Panel>
        </div>
      </div>
    );
  return (
    <div className="flex h-full flex-col gap-3" aria-busy="true" aria-label="Loading">
      <div className="flex gap-2"><B w={240} h={34} /><B w={160} h={34} /><B w={140} h={34} /></div>
      <Panel className="flex-1 space-y-3"><B h={14} />{Array.from({ length: 9 }).map((_, i) => <div key={i} className="flex items-center gap-4"><B w={28} h={28} /><B w="28%" /><B w="14%" /><B w="10%" /><div className="flex-1" /><B w={70} /></div>)}</Panel>
    </div>
  );
}
