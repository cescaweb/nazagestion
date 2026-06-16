import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getAlumnos } from "@/lib/attendance.functions";
import { getBoletinAlumno } from "@/lib/grades.functions";
import { BoletinPrintable } from "@/components/BoletinPrintable";
import { exportElementToPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/calificaciones/boletin")({
  head: () => ({ meta: [{ title: "Boletín por alumno · NAZARETH" }] }),
  component: Boletin,
});

function Boletin() {
  const [q, setQ] = useState("");
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const alumnosFn = useServerFn(getAlumnos);
  const boletinFn = useServerFn(getBoletinAlumno);

  const alumnosQ = useQuery({ queryKey: ["alumnos"], queryFn: () => alumnosFn() });
  const boletinQ = useQuery({
    queryKey: ["boletin", dni],
    queryFn: () => boletinFn({ data: { dni } }),
    enabled: !!dni,
  });

  const matches = useMemo(() => {
    if (!q.trim() || !alumnosQ.data) return [];
    const lower = q.toLowerCase();
    return alumnosQ.data.alumnos
      .filter(
        (a) =>
          a.dni.includes(lower) ||
          a.apellido.toLowerCase().includes(lower) ||
          a.nombre.toLowerCase().includes(lower),
      )
      .slice(0, 8);
  }, [q, alumnosQ.data]);

  async function handleDownload() {
    if (!printRef.current || !boletinQ.data) return;
    setBusy(true);
    setError(null);
    try {
      const al = boletinQ.data.alumno;
      const fileName = `boletin-${al?.dni ?? dni}-${al?.apellido ?? ""}.pdf`;
      await exportElementToPDF(printRef.current, fileName);
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
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Boletín por alumno</h1>
        <p className="mt-1 text-sm text-muted-foreground">Buscá un alumno por DNI o nombre.</p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <Input
          placeholder="DNI, apellido o nombre"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setDni("");
          }}
          className="h-10"
        />
        {matches.length > 0 && !dni && (
          <ul className="mt-2 max-h-56 divide-y overflow-auto rounded-md border">
            {matches.map((a) => (
              <li key={a.dni}>
                <button
                  onClick={() => {
                    setDni(a.dni);
                    setQ(`${a.apellido}, ${a.nombre}`);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">{a.apellido}, {a.nombre}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    DNI {a.dni} · {a.curso}° {a.division} ({a.turno})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dni && boletinQ.isLoading && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Cargando boletín…
        </div>
      )}
      {dni && boletinQ.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          No se pudo cargar el boletín: {(boletinQ.error as Error).message}
        </div>
      )}

      {dni && boletinQ.data && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {boletinQ.data.alumno
                ? `${boletinQ.data.alumno.apellido}, ${boletinQ.data.alumno.nombre}`
                : "Alumno"}
            </h2>
            <div className="flex flex-col items-end gap-1">
              <Button onClick={handleDownload} disabled={busy}>
                <Download className="mr-2 h-4 w-4" />
                {busy ? "Generando…" : "Descargar PDF"}
              </Button>
              {error && <span className="text-xs text-red-700">{error}</span>}
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <Stat label="Materias" value={String(boletinQ.data.stats.total)} />
            <Stat label="Aprobadas" value={String(boletinQ.data.stats.aprobadas)} />
            <div className="col-span-2 sm:col-span-1">
              <Stat label="Promedio general" value={boletinQ.data.stats.promedioGeneral || "—"} />
            </div>
          </div>


          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Materia</th>
                  <th className="px-2 py-2 text-center">1°C Prom.</th>
                  <th className="px-2 py-2 text-center">1°C Final</th>
                  <th className="px-2 py-2 text-center">2°C Prom.</th>
                  <th className="px-2 py-2 text-center">2°C Final</th>
                  <th className="px-2 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {boletinQ.data.filas.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin calificaciones cargadas.</td></tr>
                ) : (
                  boletinQ.data.filas.map((f) => {
                    const finalRef = Number(f.c2?.notaFinal || f.c2?.promedio || f.c1?.notaFinal || f.c1?.promedio || 0);
                    const aprob = finalRef >= 7;
                    return (
                      <tr key={f.materia} className="border-t">
                        <td className="px-4 py-2 font-medium">{f.materia}</td>
                        <td className="px-2 py-2 text-center">{f.c1?.promedio || "—"}</td>
                        <td className="px-2 py-2 text-center font-semibold">{f.c1?.notaFinal || "—"}</td>
                        <td className="px-2 py-2 text-center">{f.c2?.promedio || "—"}</td>
                        <td className="px-2 py-2 text-center font-semibold">{f.c2?.notaFinal || "—"}</td>
                        <td className="px-2 py-2">
                          {finalRef > 0 && (
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${aprob ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                              {aprob ? "Aprobado" : "Intensifica"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Off-screen printable used for PDF capture */}
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: "-10000px",
              top: 0,
              pointerEvents: "none",
            }}
          >
            <BoletinPrintable
              ref={printRef}
              alumno={boletinQ.data.alumno}
              filas={boletinQ.data.filas}
              stats={boletinQ.data.stats}
            />
          </div>
        </>
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
