import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  getCursos,
  getAlumnosByCurso,
  getAsistencia,
  saveAsistencia,
  type Estado,
} from "@/lib/attendance.functions";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const s = (context as { session: import("@/lib/auth.functions").PublicSession }).session;
    if (s && s.rol === "DOCENTE") {
      throw redirect({ to: "/calificaciones" });
    }
  },
  head: () => ({
    meta: [
      { title: "NAZARETH SGE" },
      { name: "description", content: "Sistema de Gestion Escolar" },
    ],
  }),
  component: TomarAsistencia,
});

// UI solo registra excepciones. Por defecto todos están Presente.
const ESTADOS_UI: Estado[] = ["Ausente", "Tarde", "Justificado"];

function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function TomarAsistencia() {
  const [cursoId, setCursoId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(today());
  // Solo guarda excepciones. Ausencia de clave = Presente por defecto.
  const [seleccion, setSeleccion] = useState<Record<string, Estado>>({});

  const cursosFn = useServerFn(getCursos);
  const alumnosFn = useServerFn(getAlumnosByCurso);
  const asistenciaFn = useServerFn(getAsistencia);
  const saveFn = useServerFn(saveAsistencia);

  const cursosQ = useQuery({ queryKey: ["cursos"], queryFn: () => cursosFn() });

  const alumnosQ = useQuery({
    queryKey: ["alumnos", cursoId],
    queryFn: () => alumnosFn({ data: { cursoId } }),
    enabled: !!cursoId,
  });

  const asistenciaQ = useQuery({
    queryKey: ["asistencia", cursoId, fecha],
    queryFn: () => asistenciaFn({ data: { cursoId, fecha } }),
    enabled: !!cursoId && !!fecha,
  });

  useEffect(() => {
    if (!asistenciaQ.data) return;
    const map: Record<string, Estado> = {};
    for (const r of asistenciaQ.data.registros) {
      // Solo excepciones cargadas anteriormente.
      if (r.estado && r.estado !== "Presente") map[r.dni] = r.estado;
    }
    setSeleccion(map);
  }, [asistenciaQ.data]);

  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: (r) => {
      toast.success(`Asistencia guardada (${r.inserted} nuevas, ${r.updated} actualizadas)`);
      asistenciaQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alumnos = alumnosQ.data?.alumnos ?? [];

  const resumen = useMemo(() => {
    const counts = { Presente: 0, Ausente: 0, Tarde: 0, Justificado: 0 } as Record<Estado, number>;
    for (const a of alumnos) {
      const e = seleccion[a.dni];
      if (e) counts[e]++;
    }
    counts.Presente = Math.max(0, alumnos.length - counts.Ausente - counts.Tarde - counts.Justificado);
    return counts;
  }, [alumnos, seleccion]);

  function toggleEstado(dni: string, estado: Estado) {
    setSeleccion((prev) => {
      const next = { ...prev };
      if (next[dni] === estado) delete next[dni];
      else next[dni] = estado;
      return next;
    });
  }

  function marcarTodos(estado: Estado) {
    const map: Record<string, Estado> = { ...seleccion };
    for (const a of alumnos) map[a.dni] = estado;
    setSeleccion(map);
  }

  function limpiarExcepciones() {
    setSeleccion({});
  }

  function onGuardar() {
    if (alumnos.length === 0) {
      toast.error("No hay alumnos en el curso.");
      return;
    }
    // Enviamos TODOS los alumnos: los sin excepción como "Presente" (el servidor limpiará
    // filas previas y no escribirá nuevas), y los marcados con su estado.
    const registros = alumnos.map((a) => ({
      dni: a.dni,
      estado: (seleccion[a.dni] ?? "Presente") as Estado,
    }));
    save.mutate({ data: { cursoId, fecha, registros } });
  }

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-right" />
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tomar asistencia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos los alumnos están <span className="font-medium text-foreground">Presente</span> por defecto.
          Marcá solo las excepciones (Ausente, Tarde o Justificado). Tocá el mismo botón para desmarcar.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr,200px,auto]">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Curso</label>
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={cursosQ.isLoading ? "Cargando..." : "Seleccionar curso"} />
            </SelectTrigger>
            <SelectContent>
              {(cursosQ.data?.cursos ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label} {c.preceptor ? `— ${c.preceptor}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-10" />
        </div>
        <div className="flex items-end">
          <Button
            onClick={onGuardar}
            disabled={!cursoId || save.isPending}
            className="h-10 w-full sm:w-auto"
          >
            {save.isPending ? "Guardando..." : "Guardar asistencia"}
          </Button>
        </div>
      </div>

      {cursoId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full text-xs font-medium text-muted-foreground sm:w-auto sm:mr-2">
              Marcar todos:
            </span>
            {ESTADOS_UI.map((e) => (
              <Button key={e} size="sm" variant="outline" onClick={() => marcarTodos(e)}>
                {e}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={limpiarExcepciones}>
              Limpiar
            </Button>
            <div className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>P: {resumen.Presente}</span>
              <span>A: {resumen.Ausente}</span>
              <span>T: {resumen.Tarde}</span>
              <span>J: {resumen.Justificado}</span>
            </div>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {alumnosQ.isLoading ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                Cargando alumnos...
              </div>
            ) : alumnos.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                No hay alumnos activos para este curso.
              </div>
            ) : (
              alumnos.map((a) => (
                <div key={a.dni} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{a.apellido}, {a.nombre}</div>
                      <div className="text-xs text-muted-foreground">DNI {a.dni}</div>
                    </div>
                    {!seleccion[a.dni] && (
                      <span className="text-[10px] uppercase tracking-wide text-emerald-700">Presente</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ESTADOS_UI.map((e) => {
                      const active = seleccion[a.dni] === e;
                      return (
                        <Button
                          key={e}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => toggleEstado(a.dni, e)}
                          className="h-10 px-0 text-xs"
                        >
                          {e}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop/tablet: table */}
          <div className="hidden md:block overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Alumno</th>
                  <th className="px-4 py-2">DNI</th>
                  <th className="px-4 py-2 text-right">Estado (por defecto: Presente)</th>
                </tr>
              </thead>
              <tbody>
                {alumnosQ.isLoading ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Cargando alumnos...</td></tr>
                ) : alumnos.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No hay alumnos activos para este curso.</td></tr>
                ) : (
                  alumnos.map((a) => (
                    <tr key={a.dni} className="border-t">
                      <td className="px-4 py-2 font-medium">{a.apellido}, {a.nombre}</td>
                      <td className="px-4 py-2 text-muted-foreground">{a.dni}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {!seleccion[a.dni] && (
                            <span className="mr-2 text-[10px] uppercase tracking-wide text-emerald-700">
                              Presente
                            </span>
                          )}
                          {ESTADOS_UI.map((e) => {
                            const active = seleccion[a.dni] === e;
                            return (
                              <Button
                                key={e}
                                size="sm"
                                variant={active ? "default" : "outline"}
                                onClick={() => toggleEstado(a.dni, e)}
                                className="h-8 px-2 text-xs"
                              >
                                {e}
                              </Button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
