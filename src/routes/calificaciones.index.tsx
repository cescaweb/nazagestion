import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCursos } from "@/lib/attendance.functions";
import {
  getCalificaciones,
  getMaterias,
  saveCalificaciones,
} from "@/lib/grades.functions";

export const Route = createFileRoute("/calificaciones/")({
  head: () => ({
    meta: [
      { title: "Cargar calificaciones · NAZARETH" },
    ],
  }),
  component: CargarNotas,
});

type Reg = {
  dni: string;
  apellido: string;
  nombre: string;
  nota1: string;
  nota2: string;
  nota3: string;
  nota4: string;
  notaFinal: string;
  observaciones: string;
};

function calcProm(r: Reg): string {
  const nums = [r.nota1, r.nota2, r.nota3, r.nota4]
    .map((n) => Number(n))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (nums.length === 0) return "";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

function estadoBadge(notaFinal: string, prom: string) {
  const ref = notaFinal !== "" ? Number(notaFinal) : Number(prom);
  if (!Number.isFinite(ref) || ref === 0) return null;
  const ok = ref >= 7;
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        ok ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
      }`}
    >
      {ok ? "Aprobado" : "Intensifica"}
    </span>
  );
}

function CargarNotas() {
  const [cursoId, setCursoId] = useState("");
  const [materia, setMateria] = useState("");
  const [cuatrimestre, setCuatrimestre] = useState("1");
  const [regs, setRegs] = useState<Reg[]>([]);

  const cursosFn = useServerFn(getCursos);
  const materiasFn = useServerFn(getMaterias);
  const calFn = useServerFn(getCalificaciones);
  const saveFn = useServerFn(saveCalificaciones);
  const qc = useQueryClient();

  const cursosQ = useQuery({ queryKey: ["cursos"], queryFn: () => cursosFn() });
  const materiasQ = useQuery({
    queryKey: ["materias", cursoId],
    queryFn: () => materiasFn({ data: { cursoId } }),
    enabled: !!cursoId,
  });
  const calQ = useQuery({
    queryKey: ["calificaciones", cursoId, materia, cuatrimestre],
    queryFn: () => calFn({ data: { cursoId, materia, cuatrimestre } }),
    enabled: !!cursoId && !!materia && !!cuatrimestre,
  });

  useEffect(() => {
    if (!calQ.data) return;
    const existMap = new Map(calQ.data.calificaciones.map((c) => [c.dni, c]));
    setRegs(
      calQ.data.alumnos.map((a) => {
        const c = existMap.get(a.dni);
        return {
          dni: a.dni,
          apellido: a.apellido,
          nombre: a.nombre,
          nota1: c?.nota1 ?? "",
          nota2: c?.nota2 ?? "",
          nota3: c?.nota3 ?? "",
          nota4: c?.nota4 ?? "",
          notaFinal: c?.notaFinal ?? "",
          observaciones: c?.observaciones ?? "",
        };
      }),
    );
  }, [calQ.data]);

  useEffect(() => {
    setMateria("");
  }, [cursoId]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          cursoId,
          materia,
          cuatrimestre,
          registros: regs.map((r) => ({
            dni: r.dni,
            nota1: r.nota1,
            nota2: r.nota2,
            nota3: r.nota3,
            nota4: r.nota4,
            notaFinal: r.notaFinal,
            observaciones: r.observaciones,
          })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calificaciones"] });
    },
  });

  function update(i: number, patch: Partial<Reg>) {
    setRegs((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const hayCargados = useMemo(
    () => regs.some((r) => r.nota1 || r.nota2 || r.nota3 || r.nota4 || r.notaFinal),
    [regs],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Cargar calificaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seleccioná curso, materia y cuatrimestre. Las notas se guardan en la hoja `calificaciones`.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Curso</label>
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
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
            <SelectTrigger className="h-10"><SelectValue placeholder={cursoId ? "Seleccionar materia" : "Elegí curso primero"} /></SelectTrigger>
            <SelectContent>
              {(materiasQ.data?.materias ?? []).map((m) => (
                <SelectItem key={m.id || m.materia} value={m.materia}>
                  {m.materia} {m.docente ? `· ${m.docente}` : ""}
                </SelectItem>
              ))}
              {materiasQ.data && materiasQ.data.materias.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  No hay materias cargadas para este curso en la hoja MATERIAS.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cuatrimestre</label>
          <Select value={cuatrimestre} onValueChange={setCuatrimestre}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1° Cuatrimestre</SelectItem>
              <SelectItem value="2">2° Cuatrimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {cursoId && materia && (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {calQ.isLoading ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : regs.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Sin alumnos en este curso.</div>
            ) : (
              regs.map((r, i) => {
                const prom = calcProm(r);
                return (
                  <div key={r.dni} className="rounded-lg border bg-card p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{r.apellido}, {r.nombre}</div>
                        <div className="text-xs text-muted-foreground">DNI {r.dni}</div>
                      </div>
                      {estadoBadge(r.notaFinal, prom)}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(["nota1", "nota2", "nota3", "nota4"] as const).map((k, idx) => (
                        <div key={k} className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wide text-muted-foreground text-center">N{idx + 1}</label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={1}
                            max={10}
                            step={0.5}
                            className="h-10 text-center"
                            value={r[k]}
                            onChange={(e) => update(i, { [k]: e.target.value } as Partial<Reg>)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Promedio</label>
                        <div className="h-10 flex items-center justify-center rounded-md border bg-muted/40 text-sm font-medium">
                          {prom || "—"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Nota Final</label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={10}
                          step={0.5}
                          className="h-10 text-center font-semibold"
                          value={r.notaFinal}
                          onChange={(e) => update(i, { notaFinal: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Observaciones</label>
                      <Input
                        className="h-10"
                        value={r.observaciones}
                        onChange={(e) => update(i, { observaciones: e.target.value })}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop/tablet: table with horizontal scroll fallback */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-2 py-2 text-center">N1</th>
                  <th className="px-2 py-2 text-center">N2</th>
                  <th className="px-2 py-2 text-center">N3</th>
                  <th className="px-2 py-2 text-center">N4</th>
                  <th className="px-2 py-2 text-center">Prom.</th>
                  <th className="px-2 py-2 text-center">Final</th>
                  <th className="px-2 py-2">Estado</th>
                  <th className="px-2 py-2">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {calQ.isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
                ) : regs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Sin alumnos en este curso.</td></tr>
                ) : (
                  regs.map((r, i) => {
                    const prom = calcProm(r);
                    return (
                      <tr key={r.dni} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{r.apellido}, {r.nombre}</div>
                          <div className="text-xs text-muted-foreground">{r.dni}</div>
                        </td>
                        {(["nota1", "nota2", "nota3", "nota4"] as const).map((k) => (
                          <td key={k} className="px-1 py-1">
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              step={0.5}
                              className="h-8 w-16 text-center"
                              value={r[k]}
                              onChange={(e) => update(i, { [k]: e.target.value } as Partial<Reg>)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center text-sm font-medium text-muted-foreground">{prom || "—"}</td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            step={0.5}
                            className="h-8 w-16 text-center"
                            value={r.notaFinal}
                            onChange={(e) => update(i, { notaFinal: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2">{estadoBadge(r.notaFinal, prom)}</td>
                        <td className="px-1 py-1">
                          <Input
                            className="h-8 min-w-32"
                            value={r.observaciones}
                            onChange={(e) => update(i, { observaciones: e.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {cursoId && materia && regs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {hayCargados ? "Hay notas cargadas para esta selección." : "Sin notas aún."}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {saveMut.isSuccess && !saveMut.isPending && (
              <span className="text-sm text-emerald-700">
                Guardado ({saveMut.data?.updated} actualizadas, {saveMut.data?.inserted} nuevas)
              </span>
            )}
            {saveMut.isError && (
              <span className="text-sm text-red-700">Error al guardar</span>
            )}
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="h-10 w-full sm:w-auto">
              {saveMut.isPending ? "Guardando..." : "Guardar calificaciones"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
