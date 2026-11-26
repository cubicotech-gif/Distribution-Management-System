"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <div className="text-[18px] font-bold">Something went wrong on this screen</div>
        <p className="mx-auto mt-1 max-w-md text-ink2">Your data is safe. Try again, or go back to the start.</p>
        <p className="num mx-auto mt-2 max-w-md truncate text-[11px] text-ink3">{error.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn btn-primary" onClick={() => reset()}>Try again</button>
          <a className="btn" href="/">Go to start</a>
        </div>
      </div>
    </div>
  );
}
