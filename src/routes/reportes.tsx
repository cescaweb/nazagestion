import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCursos, getReporteCurso } from "@/lib/attendance.functions";
import { guardSection } from "@/lib/route-guards";
import { canGeneratePdf } from "@/lib/permissions";
import { ReporteAsistenciaPrintable } from "@/components/ReporteAsistenciaPrintable";
import { exportElementToPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/reportes")({
  beforeLoad: guardSection("reportes"),
  head: () => ({
    meta: [
      { title: "Reportes por curso · NAZARETH" },
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
  const { session } = Route.useRouteContext() as {
    session: import("@/lib/auth.functions").PublicSession;
  };
  const puedePdf = !!session && canGeneratePdf(session.rol);

  const [cursoId, setCursoId] = useState("");
  const [desde, setDesde] = useState(firstOfMonth());
  const [hasta, setHasta] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const cursosFn = useServerFn(getCursos);
  const reporteFn = useServerFn(getReporteCurso);

  const cursosQ = useQuery({ queryKey: ["cursos"], queryFn: () => cursosFn() });
  const reporteQ = useQuery({
    queryKey: ["reporte", cursoId, desde, hasta],
    queryFn: () => reporteFn({ data: { cursoId, desde, hasta } }),
    enabled: !!cursoId && !!desde && !!hasta,
  });

  const cursoLabel =
    cursosQ.data?.cursos.find((c) => c.id === cursoId)?.label ?? "curso";

  async function handleDownloadPdf() {
    if (!printRef.current || !reporteQ.data) return;
    setBusy(true);
    setError(null);
    try {
      const safe = cursoLabel.replace(/[^a-zA-Z0-9]/g, "_");
      await exportElementToPDF(printRef.current, `reporte_${safe}_${desde}_${hasta}.pdf`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setBusy(false);
    }
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
        <div className="flex flex-col items-end gap-1 sm:col-span-2 lg:col-span-1">
          {puedePdf && (
            <Button
              onClick={handleDownloadPdf}
              disabled={!reporteQ.data || reporteQ.data.filas.length === 0 || busy}
              className="h-10 w-full lg:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              {busy ? "Generando…" : "Descargar PDF"}
            </Button>
          )}
          {error && <span className="text-xs text-red-700">{error}</span>}
        </div>
      </div>

      {cursoId && (
        <div className="space-y-2">
          {reporteQ.data && (
            <div className="text-xs text-muted-foreground">
              Días hábiles esperados en el rango (lun-vie, sin receso ni feriados):{" "}
              <span className="font-semibold text-foreground">{reporteQ.data.diasEsperados}</span>.
              Se registran solo excepciones (Ausente, Tarde, Justificado); los alumnos sin registro se consideran Presentes.
              Tarde = ½ ausencia. Justificado no resta.
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
                  <th className="px-4 py-2 text-right">Esperados</th>
                  <th className="px-4 py-2 text-right">% Asist.</th>
                </tr>
              </thead>
              <tbody>
                {reporteQ.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Cargando...
                    </td>
                  </tr>
                ) : (reporteQ.data?.filas ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
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

      {/* Off-screen printable used for PDF capture */}
      {reporteQ.data && (
        <div
          aria-hidden
          style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}
        >
          <ReporteAsistenciaPrintable
            ref={printRef}
            cursoLabel={cursoLabel}
            desde={desde}
            hasta={hasta}
            diasEsperados={reporteQ.data.diasEsperados}
            filas={reporteQ.data.filas}
          />
        </div>
      )}
    </div>
  );
}
