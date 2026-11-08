import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";

export function AdminLayout() {
  return (
    <div className="flex min-h-dvh bg-black-950">
      <Sidebar />
      <main className="min-w-0 flex-1 p-12">
        <Outlet />
      </main>
    </div>
  );
}
