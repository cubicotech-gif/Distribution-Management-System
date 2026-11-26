import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <div className="num text-[56px] font-bold text-accent">404</div>
        <div className="text-[18px] font-bold">This page does not exist</div>
        <p className="mx-auto mt-1 max-w-sm text-ink2">The link may be old, or you may not have access to this screen with your role.</p>
        <Link href="/" className="btn btn-primary mt-5 inline-flex">Back to my home screen</Link>
      </div>
    </div>
  );
}
