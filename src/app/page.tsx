"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HOME, useUser } from "@/lib/store";
import { useHydrated } from "@/components/ui";
import { homeFor } from "@/lib/perm";

export default function Index() {
  const router = useRouter();
  const user = useUser();
  const ok = useHydrated();
  useEffect(() => {
    if (!ok) return;
    router.replace(user ? (homeFor(user) ?? HOME[user.role]) : "/login");
  }, [ok, user, router]);
  return <div className="grid h-screen place-items-center text-ink3">Loading…</div>;
}
