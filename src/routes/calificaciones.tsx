import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { guardSection } from "@/lib/route-guards";

export const Route = createFileRoute("/calificaciones")({
  beforeLoad: guardSection("calificaciones"),
  head: () => ({
    meta: [
      { title: "Calificaciones · NAZARETH" },
      { name: "description", content: "Carga y consulta de calificaciones por curso, materia y cuatrimestre." },
    ],
  }),
  component: CalificacionesLayout,
});

function CalificacionesLayout() {
  const base =
    "shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground";
  const active =
    "shrink-0 rounded-md px-3 py-1.5 text-sm bg-accent text-accent-foreground font-medium";
  return (
    <div className="space-y-6">
      <div className="-mx-4 overflow-x-auto border-b md:mx-0">
        <div className="flex items-center gap-1 px-4 pb-2 md:px-0">
          <Link to="/calificaciones" activeOptions={{ exact: true }} className={base} activeProps={{ className: active }}>
            Cargar notas
          </Link>
          <Link to="/calificaciones/boletin" className={base} activeProps={{ className: active }}>
            Boletín
          </Link>
          <Link to="/calificaciones/reporte" className={base} activeProps={{ className: active }}>
            Reporte
          </Link>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
