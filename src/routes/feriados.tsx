import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { addFeriado, deleteFeriado, getFeriados } from "@/lib/feriados.functions";
import { guardSection } from "@/lib/route-guards";
import { FERIADOS_2026, RECESO_INVIERNO } from "@/lib/school-calendar";

export const Route = createFileRoute("/feriados")({
  beforeLoad: guardSection("feriados"),
  head: () => ({
    meta: [
      { title: "Feriados · CESCA" },
      { name: "description", content: "Gestión de feriados que descuentan días hábiles del ciclo escolar." },
    ],
  }),
  component: FeriadosPage,
});

function formatFecha(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function FeriadosPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getFeriados);
  const addFn = useServerFn(addFeriado);
  const delFn = useServerFn(deleteFeriado);

  const q = useQuery({ queryKey: ["feriados"], queryFn: () => getFn() });

  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fecha) return;
    setBusy(true);
    try {
      const res = await addFn({ data: { fecha, descripcion } });
      if (!res.ok) setError(res.error ?? "No se pudo guardar");
      else {
        setFecha("");
        setDescripcion("");
        await qc.invalidateQueries({ queryKey: ["feriados"] });
        await qc.invalidateQueries({ queryKey: ["reporte"] });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(fecha: string) {
    if (!confirm(`¿Eliminar feriado ${formatFecha(fecha)}?`)) return;
    await delFn({ data: { fecha } });
    await qc.invalidateQueries({ queryKey: ["feriados"] });
    await qc.invalidateQueries({ queryKey: ["reporte"] });
  }

  const feriados = q.data?.feriados ?? [];
  const nacionales = Array.from(FERIADOS_2026).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Feriados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Las fechas cargadas aquí se descuentan de los días hábiles esperados al
          calcular el % de asistencia, junto con fines de semana, feriados nacionales
          y el receso de invierno ({formatFecha(RECESO_INVIERNO.desde)} – {formatFecha(RECESO_INVIERNO.hasta)}).
        </p>
      </div>

      <form
        onSubmit={onAdd}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[180px,1fr,auto]"
      >
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Descripción (opcional)</label>
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Jornada institucional"
            maxLength={120}
            className="h-10"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy || !fecha} className="h-10 w-full sm:w-auto">
            {busy ? "Guardando..." : "Agregar feriado"}
          </Button>
        </div>
        {error && <p className="sm:col-span-3 text-sm text-destructive">{error}</p>}
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Feriados cargados</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
              ) : feriados.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Sin feriados cargados.</td></tr>
              ) : (
                feriados.map((f) => (
                  <tr key={f.fecha} className="border-t">
                    <td className="px-4 py-2 font-medium">{formatFecha(f.fecha)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{f.descripcion || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => onDelete(f.fecha)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Feriados nacionales 2026 (fijos)</h2>
        <p className="text-xs text-muted-foreground">
          Ya se descuentan automáticamente del cálculo. Esta lista es informativa.
        </p>
        <div className="flex flex-wrap gap-2">
          {nacionales.map((d) => (
            <span key={d} className="rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
              {formatFecha(d)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
