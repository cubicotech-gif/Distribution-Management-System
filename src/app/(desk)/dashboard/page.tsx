"use client";
import { useUser } from "@/lib/store";
import Owner from "@/components/dashboards/Owner";
import BackOffice from "@/components/dashboards/BackOffice";
import Warehouse from "@/components/dashboards/Warehouse";
import Purchasing from "@/components/dashboards/Purchasing";

export default function Dashboard() {
  const user = useUser();
  if (!user) return null;
  if (user.role === "admin") return <Owner />;
  if (user.role === "warehouse") return <Warehouse />;
  if (user.role === "purchasing") return <Purchasing />;
  return <BackOffice />;
}
