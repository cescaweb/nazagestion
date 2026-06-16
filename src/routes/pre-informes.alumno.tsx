import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getAlumnos } from "@/lib/attendance.functions";
import { getPreInformeAlumno } from "@/lib/preinformes.functions";
import { PreInformePrintable } from "@/components/PreInformePrintable";
import { exportElementToPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/pre-informes/alumno")({
  head: () => ({ meta: [{ title: "Pre-Informe por alumno · NAZARETH" }] }),
  component: PreInformeAlumno,
});

function PreInformeAlumno() {
  const [q, setQ] = useState("");
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const alumnosFn = useServerFn(getAlumnos);
  const piFn = useServerFn(getPreInformeAlumno);

  const alumnosQ = useQuery({ queryKey: ["alumnos"], queryFn: () => alumnosFn() });
  const piQ = useQuery({
    queryKey: ["preinforme-alumno", dni],
    queryFn: () => piFn({ data: { dni } }),
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
    if (!printRef.current || !piQ.data) return;
    setBusy(true);
    setError(null);
    try {
      const al = piQ.data.alumno;
      const fileName = `preinforme-${al?.dni ?? dni}-${al?.apellido ?? ""}.pdf`;
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
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Pre-Informe por alumno</h1>
        <p className="mt-1 text-sm text-muted-foreground">Buscá un alumno por DNI o nombre y descargá su pre-informe en PDF.</p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <Input
          placeholder="DNI, apellido o nombre"
          value={q}
          onChange={(e) => { setQ(e.target.value); setDni(""); }}
          className="h-10"
        />
        {matches.length > 0 && !dni && (
          <ul className="mt-2 max-h-56 divide-y overflow-auto rounded-md border">
            {matches.map((a) => (
              <li key={a.dni}>
                <button
                  onClick={() => { setDni(a.dni); setQ(`${a.apellido}, ${a.nombre}`); }}
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

      {dni && piQ.isLoading && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Cargando pre-informe…
        </div>
      )}
      {dni && piQ.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          No se pudo cargar el pre-informe: {(piQ.error as Error).message}
        </div>
      )}

      {dni && piQ.data && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {piQ.data.alumno ? `${piQ.data.alumno.apellido}, ${piQ.data.alumno.nombre}` : "Alumno"}
            </h2>
            <div className="flex flex-col items-end gap-1">
              <Button onClick={handleDownload} disabled={busy}>
                <Download className="mr-2 h-4 w-4" />
                {busy ? "Generando…" : "Descargar PDF"}
              </Button>
              {error && <span className="text-xs text-red-700">{error}</span>}
            </div>
          </div>

          {piQ.data.filas.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              Sin valoraciones cargadas.
            </div>
          ) : (
            <div className="space-y-3">
              {piQ.data.filas.map((f, i) => {
                const cls =
                  f.valoracion === "TEA" ? "bg-emerald-100 text-emerald-900" :
                  f.valoracion === "TEP" ? "bg-amber-100 text-amber-900" :
                  f.valoracion === "TED" ? "bg-red-100 text-red-900" : "bg-muted text-muted-foreground";
                return (
                  <div key={`${f.materia}-${f.periodo}-${i}`} className="rounded-lg border bg-card p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold text-foreground">{f.materia}</div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{f.periodo}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
                        {f.valoracion || "—"}
                      </span>
                    </div>
                    {f.observaciones && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{f.observaciones}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
            <PreInformePrintable
              ref={printRef}
              alumno={piQ.data.alumno}
              filas={piQ.data.filas}
            />
          </div>
        </>
      )}
    </div>
  );
}
