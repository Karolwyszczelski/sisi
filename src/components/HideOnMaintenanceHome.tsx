"use client";

import { usePathname } from "next/navigation";
import { HOME_MAINTENANCE } from "@/config/homeMaintenance";

export default function HideOnMaintenanceHome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return HOME_MAINTENANCE && pathname === "/" ? null : children;
}
