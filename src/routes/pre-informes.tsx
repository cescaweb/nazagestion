import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { guardSection } from "@/lib/route-guards";

export const Route = createFileRoute("/pre-informes")({
  beforeLoad: guardSection("pre-informes"),
  head: () => ({
    meta: [
      { title: "Pre-Informes · CESCA" },
      { name: "description", content: "Carga y consulta de pre-informes pedagógicos por curso y materia." },
    ],
  }),
  component: PreInformesLayout,
});

function PreInformesLayout() {
  const base =
    "shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground";
  const active =
    "shrink-0 rounded-md px-3 py-1.5 text-sm bg-accent text-accent-foreground font-medium";
  return (
    <div className="space-y-6">
      <div className="-mx-4 overflow-x-auto border-b md:mx-0">
        <div className="flex items-center gap-1 px-4 pb-2 md:px-0">
          <Link to="/pre-informes" activeOptions={{ exact: true }} className={base} activeProps={{ className: active }}>
            Cargar
          </Link>
          <Link to="/pre-informes/alumno" className={base} activeProps={{ className: active }}>
            Por alumno
          </Link>
          <Link to="/pre-informes/reporte" className={base} activeProps={{ className: active }}>
            Reporte
          </Link>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
