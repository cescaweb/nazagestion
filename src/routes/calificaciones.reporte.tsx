import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCursos } from "@/lib/attendance.functions";
import { getMaterias, getReporteMateria } from "@/lib/grades.functions";
import { BatchExportButton } from "@/components/BatchExportButton";

export const Route = createFileRoute("/calificaciones/reporte")({
  head: () => ({ meta: [{ title: "Reporte de calificaciones · NAZARETH" }] }),
  component: ReporteMateria,
});

function ReporteMateria() {
  const [cursoId, setCursoId] = useState("");
  const [materia, setMateria] = useState("");
  const [cuatrimestre, setCuatrimestre] = useState("1");

  const cursosFn = useServerFn(getCursos);
  const materiasFn = useServerFn(getMaterias);
  const repFn = useServerFn(getReporteMateria);

  const cursosQ = useQuery({ queryKey: ["cursos"], queryFn: () => cursosFn() });
  const materiasQ = useQuery({
    queryKey: ["materias", cursoId],
    queryFn: () => materiasFn({ data: { cursoId } }),
    enabled: !!cursoId,
  });
  const repQ = useQuery({
    queryKey: ["repMateria", cursoId, materia, cuatrimestre],
    queryFn: () => repFn({ data: { cursoId, materia, cuatrimestre } }),
    enabled: !!cursoId && !!materia,
  });

  useEffect(() => { setMateria(""); }, [cursoId]);

  function exportCSV() {
    if (!repQ.data) return;
    const header = ["DNI", "Apellido", "Nombre", "N1", "N2", "N3", "N4", "Promedio", "Nota_Final", "Estado"];
    const lines = [header.join(",")];
    for (const f of repQ.data.filas) {
      lines.push([f.dni, f.apellido, f.nombre, f.nota1, f.nota2, f.nota3, f.nota4, f.promedio, f.notaFinal, f.estado]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas_${materia}_C${cuatrimestre}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Reporte por materia</h1>
        <p className="mt-1 text-sm text-muted-foreground">Notas de un curso y materia para el cuatrimestre.</p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr,1fr,160px,auto]">
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
          <label className="text-xs font-medium text-muted-foreground">Cuatrimestre</label>
          <Select value={cuatrimestre} onValueChange={setCuatrimestre}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1°</SelectItem>
              <SelectItem value="2">2°</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={exportCSV} disabled={!repQ.data || repQ.data.filas.length === 0} className="h-10 w-full lg:w-auto">
            Exportar CSV
          </Button>
        </div>
      </div>

      {cursoId && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-medium text-foreground">Exportar curso completo</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Genera un ZIP con un PDF de boletín por cada alumno del curso seleccionado.
          </p>
          <BatchExportButton
            tipo="boletin"
            cursoId={cursoId}
            zipName={`boletines-${(cursosQ.data?.cursos.find((c) => c.id === cursoId)?.label ?? "curso").replace(/[^a-zA-Z0-9]/g, "_")}.zip`}
          />
        </div>
      )}


      {repQ.data && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Stat label="Alumnos" value={`${repQ.data.stats.cargados}/${repQ.data.stats.total}`} />
          <Stat label="Aprobados" value={String(repQ.data.stats.aprobados)} />
          <Stat label="% Aprob." value={`${repQ.data.stats.pctAprobados}%`} />
          <Stat label="Promedio curso" value={repQ.data.stats.promedioCurso || "—"} />
        </div>
      )}

      {cursoId && materia && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Alumno</th>
                <th className="px-2 py-2 text-center">N1</th>
                <th className="px-2 py-2 text-center">N2</th>
                <th className="px-2 py-2 text-center">N3</th>
                <th className="px-2 py-2 text-center">N4</th>
                <th className="px-2 py-2 text-center">Prom.</th>
                <th className="px-2 py-2 text-center">Final</th>
                <th className="px-2 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {repQ.isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
              ) : (repQ.data?.filas ?? []).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin alumnos.</td></tr>
              ) : (
                repQ.data!.filas.map((f) => (
                  <tr key={f.dni} className="border-t">
                    <td className="px-4 py-2">
                      <div className="font-medium">{f.apellido}, {f.nombre}</div>
                      <div className="text-xs text-muted-foreground">{f.dni}</div>
                    </td>
                    <td className="px-2 py-2 text-center">{f.nota1 || "—"}</td>
                    <td className="px-2 py-2 text-center">{f.nota2 || "—"}</td>
                    <td className="px-2 py-2 text-center">{f.nota3 || "—"}</td>
                    <td className="px-2 py-2 text-center">{f.nota4 || "—"}</td>
                    <td className="px-2 py-2 text-center text-muted-foreground">{f.promedio || "—"}</td>
                    <td className="px-2 py-2 text-center font-semibold">{f.notaFinal || "—"}</td>
                    <td className="px-2 py-2">
                      {f.estado && (
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${f.estado === "Aprobado" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                          {f.estado}
                        </span>
                      )}
                    </td>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
