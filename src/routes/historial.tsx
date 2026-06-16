import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { getAlumnos, getHistorialAlumno } from "@/lib/attendance.functions";
import { guardSection } from "@/lib/route-guards";

export const Route = createFileRoute("/historial")({
  beforeLoad: guardSection("historial"),
  head: () => ({
    meta: [
      { title: "Historial por alumno · NAZARETH" },
      { name: "description", content: "Historial de asistencias por alumno." },
    ],
  }),
  component: Historial,
});

function Historial() {
  const [query, setQuery] = useState("");
  const [dni, setDni] = useState<string>("");

  const alumnosFn = useServerFn(getAlumnos);
  const historialFn = useServerFn(getHistorialAlumno);

  const alumnosQ = useQuery({ queryKey: ["alumnos-all"], queryFn: () => alumnosFn() });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (alumnosQ.data?.alumnos ?? [])
      .filter(
        (a) =>
          a.dni.toLowerCase().includes(q) ||
          a.apellido.toLowerCase().includes(q) ||
          a.nombre.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, alumnosQ.data]);

  const histQ = useQuery({
    queryKey: ["historial", dni],
    queryFn: () => historialFn({ data: { dni } }),
    enabled: !!dni,
  });

  const seleccionado = (alumnosQ.data?.alumnos ?? []).find((a) => a.dni === dni);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Historial por alumno</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buscá por nombre, apellido o DNI.
        </p>
      </div>

      <div className="relative">
        <Input
          placeholder="Buscar alumno..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDni("");
          }}
          className="h-10"
        />
        {matches.length > 0 && !dni && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
            {matches.map((a) => (
              <button
                key={a.dni}
                onClick={() => {
                  setDni(a.dni);
                  setQuery(`${a.apellido}, ${a.nombre}`);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="font-medium">{a.apellido}, {a.nombre}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  DNI {a.dni} · {a.curso}° {a.division} ({a.turno})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {seleccionado && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-lg font-semibold">
                {seleccionado.apellido}, {seleccionado.nombre}
              </div>
              <div className="text-sm text-muted-foreground">
                DNI {seleccionado.dni} · {seleccionado.curso}° {seleccionado.division} ({seleccionado.turno})
              </div>
            </div>
            {histQ.data && (
              <div className="text-sm">
                <span className="font-semibold">{histQ.data.stats.pct}%</span>{" "}
                <span className="text-muted-foreground">
                  asistencia · {histQ.data.stats.total} registros
                </span>
              </div>
            )}
          </div>

          {histQ.data && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Presentes: {histQ.data.stats.presentes}</span>
              <span>Ausentes: {histQ.data.stats.ausentes}</span>
              <span>Tardes: {histQ.data.stats.tardes}</span>
              <span>Justificados: {histQ.data.stats.justificados}</span>
            </div>
          )}
        </div>
      )}

      {dni && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Hora</th>
              </tr>
            </thead>
            <tbody>
              {histQ.isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : (histQ.data?.registros ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    Sin registros.
                  </td>
                </tr>
              ) : (
                histQ.data!.registros.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-medium">{r.fecha}</td>
                    <td className="px-4 py-2">{r.estado}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.hora}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
