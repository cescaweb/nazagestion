import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCursos } from "@/lib/attendance.functions";
import { getMaterias } from "@/lib/grades.functions";
import {
  getPreInformes,
  savePreInformes,
  type Valoracion,
} from "@/lib/preinformes.functions";

export const Route = createFileRoute("/pre-informes/")({
  head: () => ({ meta: [{ title: "Cargar pre-informes · CESCA" }] }),
  component: CargarPreInformes,
});

type Periodo = "Mayo" | "Octubre";
type Reg = {
  dni: string;
  apellido: string;
  nombre: string;
  valoracion: Valoracion;
  observaciones: string;
};

const OPTS: { value: Exclude<Valoracion, "">; label: string; active: string }[] = [
  { value: "TEA", label: "TEA", active: "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-700 font-bold" },
  { value: "TEP", label: "TEP", active: "bg-amber-600 text-white border-amber-600 hover:bg-amber-600 font-bold" },
  { value: "TED", label: "TED", active: "bg-red-700 text-white border-red-700 hover:bg-red-700 font-bold" },
];

function CargarPreInformes() {
  const [cursoId, setCursoId] = useState("");
  const [materia, setMateria] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("Mayo");
  const [regs, setRegs] = useState<Reg[]>([]);

  const cursosFn = useServerFn(getCursos);
  const materiasFn = useServerFn(getMaterias);
  const piFn = useServerFn(getPreInformes);
  const saveFn = useServerFn(savePreInformes);
  const qc = useQueryClient();

  const cursosQ = useQuery({ queryKey: ["cursos"], queryFn: () => cursosFn() });
  const materiasQ = useQuery({
    queryKey: ["materias", cursoId],
    queryFn: () => materiasFn({ data: { cursoId } }),
    enabled: !!cursoId,
  });
  const piQ = useQuery({
    queryKey: ["preinformes", cursoId, materia, periodo],
    queryFn: () => piFn({ data: { cursoId, materia, periodo } }),
    enabled: !!cursoId && !!materia && !!periodo,
  });

  useEffect(() => {
    if (!piQ.data) return;
    const existMap = new Map(piQ.data.preinformes.map((p) => [p.dni, p]));
    setRegs(
      piQ.data.alumnos.map((a) => {
        const p = existMap.get(a.dni);
        return {
          dni: a.dni,
          apellido: a.apellido,
          nombre: a.nombre,
          valoracion: (p?.valoracion ?? "") as Valoracion,
          observaciones: p?.observaciones ?? "",
        };
      }),
    );
  }, [piQ.data]);

  useEffect(() => { setMateria(""); }, [cursoId]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          cursoId,
          materia,
          periodo,
          registros: regs.map((r) => ({
            dni: r.dni,
            valoracion: r.valoracion,
            observaciones: r.observaciones,
          })),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preinformes"] }),
  });

  function setValoracion(i: number, v: Exclude<Valoracion, "">) {
    setRegs((prev) =>
      prev.map((r, idx) =>
        idx === i ? { ...r, valoracion: r.valoracion === v ? "" : v } : r,
      ),
    );
  }
  function setObs(i: number, observaciones: string) {
    setRegs((prev) => prev.map((r, idx) => (idx === i ? { ...r, observaciones } : r)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Cargar pre-informes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seleccioná curso, materia y período. TEA: Trayectoria educativa avanzada · TEP: en proceso · TED: discontinua.
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
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Período</label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Mayo">Mayo</SelectItem>
              <SelectItem value="Octubre">Octubre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {cursoId && materia && (
        <div className="space-y-2">
          {piQ.isLoading ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : regs.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Sin alumnos en este curso.</div>
          ) : (
            regs.map((r, i) => (
              <div key={r.dni} className="rounded-lg border bg-card p-3 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium text-sm">{r.apellido}, {r.nombre}</div>
                  <div className="text-xs text-muted-foreground">DNI {r.dni}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {OPTS.map((o) => {
                    const isActive = r.valoracion === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setValoracion(i, o.value)}
                        className={cn(
                          "h-10 rounded-md border text-sm font-semibold tracking-wide transition-colors",
                          isActive ? o.active : "bg-background text-foreground hover:bg-accent",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Observaciones
                  </label>
                  <Textarea
                    value={r.observaciones}
                    onChange={(e) => setObs(i, e.target.value)}
                    placeholder="Observaciones (opcional)…"
                    className="min-h-[72px] text-sm"
                    maxLength={2000}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {cursoId && materia && regs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {saveMut.isSuccess && !saveMut.isPending && (
            <span className="text-sm text-emerald-700">
              Guardado ({saveMut.data?.updated} actualizadas, {saveMut.data?.inserted} nuevas)
            </span>
          )}
          {saveMut.isError && <span className="text-sm text-red-700">Error al guardar</span>}
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="h-10 w-full sm:w-auto">
            {saveMut.isPending ? "Guardando…" : "Guardar pre-informes"}
          </Button>
        </div>
      )}
    </div>
  );
}
