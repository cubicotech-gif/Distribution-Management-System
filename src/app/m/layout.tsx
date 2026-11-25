export default function MLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex h-[100dvh] max-w-[430px] flex-col overflow-hidden bg-bg sm:my-0 sm:border-x sm:border-line">{children}</div>;
}
