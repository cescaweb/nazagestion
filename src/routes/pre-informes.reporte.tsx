import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCursos } from "@/lib/attendance.functions";
import { getMaterias } from "@/lib/grades.functions";
import { getReportePreInformes } from "@/lib/preinformes.functions";
import { BatchExportButton } from "@/components/BatchExportButton";

export const Route = createFileRoute("/pre-informes/reporte")({
  head: () => ({ meta: [{ title: "Reporte de pre-informes · CESCA" }] }),
  component: ReportePreInformes,
});

function ReportePreInformes() {
  const [cursoId, setCursoId] = useState("");
  const [materia, setMateria] = useState("");
  const [periodo, setPeriodo] = useState<"Mayo" | "Octubre">("Mayo");

  const cursosFn = useServerFn(getCursos);
  const materiasFn = useServerFn(getMaterias);
  const repFn = useServerFn(getReportePreInformes);

  const cursosQ = useQuery({ queryKey: ["cursos"], queryFn: () => cursosFn() });
  const materiasQ = useQuery({
    queryKey: ["materias", cursoId],
    queryFn: () => materiasFn({ data: { cursoId } }),
    enabled: !!cursoId,
  });
  const repQ = useQuery({
    queryKey: ["repPreInforme", cursoId, materia, periodo],
    queryFn: () => repFn({ data: { cursoId, materia, periodo } }),
    enabled: !!cursoId && !!materia,
  });

  useEffect(() => { setMateria(""); }, [cursoId]);

  const cursoLabel = cursosQ.data?.cursos.find((c) => c.id === cursoId)?.label.replace(/[^a-zA-Z0-9]/g, "_") ?? "curso";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Reporte de pre-informes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estado de carga por curso, materia y período.</p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Curso</label>
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Curso" /></SelectTrigger>
            <SelectContent>
              {(cursosQ.data?.cursos ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Materia</label>
          <Select value={materia} onValueChange={setMateria} disabled={!cursoId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Materia" /></SelectTrigger>
            <SelectContent>
              {(materiasQ.data?.materias ?? []).map((m) => (
                <SelectItem key={m.id || m.materia} value={m.materia}>{m.materia}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Período</label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as "Mayo" | "Octubre")}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Mayo">Mayo</SelectItem>
              <SelectItem value="Octubre">Octubre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {cursoId && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-medium text-foreground">Exportar curso completo</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Genera un ZIP con un PDF de pre-informe por cada alumno del curso (incluye todas sus materias y períodos cargados).
          </p>
          <BatchExportButton
            tipo="preinforme"
            cursoId={cursoId}
            zipName={`preinformes-${cursoLabel}.zip`}
          />
        </div>
      )}

      {repQ.data && (
        <div className="grid gap-3 grid-cols-2">
          <Stat label="Cargados" value={String(repQ.data.stats.cargados)} />
          <Stat label="Total alumnos" value={String(repQ.data.stats.total)} />
        </div>
      )}

      {cursoId && materia && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Alumno</th>
                <th className="px-2 py-2 text-center">Valoración</th>
                <th className="px-2 py-2">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {repQ.isLoading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
              ) : (repQ.data?.filas ?? []).length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Sin alumnos.</td></tr>
              ) : (
                repQ.data!.filas.map((f) => {
                  const cls =
                    f.valoracion === "TEA" ? "bg-emerald-100 text-emerald-900" :
                    f.valoracion === "TEP" ? "bg-amber-100 text-amber-900" :
                    f.valoracion === "TED" ? "bg-red-100 text-red-900" : "";
                  return (
                    <tr key={f.dni} className="border-t align-top">
                      <td className="px-4 py-2">
                        <div className="font-medium">{f.apellido}, {f.nombre}</div>
                        <div className="text-xs text-muted-foreground">{f.dni}</div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {f.valoracion ? (
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
                            {f.valoracion}
                          </span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Sin carga</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm text-foreground/90">
                        {f.observaciones ? (
                          <span className="line-clamp-3 whitespace-pre-wrap">{f.observaciones}</span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
