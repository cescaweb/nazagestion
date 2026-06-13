import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCursos, getReporteCurso } from "@/lib/attendance.functions";
import { guardSection } from "@/lib/route-guards";

export const Route = createFileRoute("/reportes")({
  beforeLoad: guardSection("reportes"),
  head: () => ({
    meta: [
      { title: "Reportes por curso · CESCA" },
      { name: "description", content: "Reportes de asistencia por curso y rango de fechas." },
    ],
  }),
  component: Reportes,
});

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function Reportes() {
  const [cursoId, setCursoId] = useState("");
  const [desde, setDesde] = useState(firstOfMonth());
  const [hasta, setHasta] = useState(today());

  const cursosFn = useServerFn(getCursos);
  const reporteFn = useServerFn(getReporteCurso);

  const cursosQ = useQuery({ queryKey: ["cursos"], queryFn: () => cursosFn() });
  const reporteQ = useQuery({
    queryKey: ["reporte", cursoId, desde, hasta],
    queryFn: () => reporteFn({ data: { cursoId, desde, hasta } }),
    enabled: !!cursoId && !!desde && !!hasta,
  });

  function exportCSV() {
    if (!reporteQ.data) return;
    const header = [
      "DNI",
      "Apellido",
      "Nombre",
      "Total",
      "Presentes",
      "Ausentes",
      "Tardes",
      "Justificados",
      "Dias_Esperados",
      "% Asistencia",
    ];
    const lines = [header.join(",")];
    for (const f of reporteQ.data.filas) {
      lines.push(
        [f.dni, f.apellido, f.nombre, f.total, f.presentes, f.ausentes, f.tardes, f.justificados, f.diasEsperados, f.pct]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${reporteQ.data.curso?.label ?? "curso"}_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Reportes por curso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estadísticas de asistencia por alumno en un rango de fechas.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr,180px,180px,auto]">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">Curso</label>
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Seleccionar curso" />
            </SelectTrigger>
            <SelectContent>
              {(cursosQ.data?.cursos ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-10" />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button
            variant="outline"
            onClick={exportCSV}
            disabled={!reporteQ.data || reporteQ.data.filas.length === 0}
            className="h-10 w-full lg:w-auto"
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {cursoId && (
        <div className="space-y-2">
          {reporteQ.data && (
            <div className="text-xs text-muted-foreground">
              Días hábiles esperados en el rango (lun-vie, sin receso ni feriados):{" "}
              <span className="font-semibold text-foreground">{reporteQ.data.diasEsperados}</span>.
              Tarde = ½ asistencia. Justificado computa como asistido.
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Alumno</th>
                  <th className="px-4 py-2">DNI</th>
                  <th className="px-4 py-2 text-right">P</th>
                  <th className="px-4 py-2 text-right">A</th>
                  <th className="px-4 py-2 text-right">T</th>
                  <th className="px-4 py-2 text-right">J</th>
                  <th className="px-4 py-2 text-right">Cargados</th>
                  <th className="px-4 py-2 text-right">Esperados</th>
                  <th className="px-4 py-2 text-right">% Asist. (real)</th>
                </tr>
              </thead>
              <tbody>
                {reporteQ.isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Cargando...
                    </td>
                  </tr>
                ) : (reporteQ.data?.filas ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Sin datos en el rango.
                    </td>
                  </tr>
                ) : (
                  reporteQ.data!.filas.map((f) => (
                    <tr key={f.dni} className="border-t">
                      <td className="px-4 py-2 font-medium">
                        {f.apellido}, {f.nombre}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{f.dni}</td>
                      <td className="px-4 py-2 text-right">{f.presentes}</td>
                      <td className="px-4 py-2 text-right">{f.ausentes}</td>
                      <td className="px-4 py-2 text-right">{f.tardes}</td>
                      <td className="px-4 py-2 text-right">{f.justificados}</td>
                      <td className="px-4 py-2 text-right">{f.total}</td>
                      <td className="px-4 py-2 text-right">{f.diasEsperados}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {f.diasEsperados > 0 ? `${f.pct}%` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
