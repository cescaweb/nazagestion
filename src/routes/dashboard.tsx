import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, Loader2, Users, Percent, GraduationCap, AlertTriangle } from "lucide-react";
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
import { getMaterias } from "@/lib/grades.functions";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { guardSection } from "@/lib/route-guards";
import { exportElementToPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: guardSection("dashboard"),
  head: () => ({
    meta: [
      { title: "Dashboard · NAZARETH SGE" },
      { name: "description", content: "Estadísticas de presentismo, calificaciones y pre-informes." },
    ],
  }),
  component: DashboardPage,
});

const PERIODOS = ["Mayo", "Octubre"];

const PALETTE = {
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  chart1: "var(--color-chart-1)",
  chart2: "var(--color-chart-2)",
  chart3: "var(--color-chart-3)",
  chart4: "var(--color-chart-4)",
  chart5: "var(--color-chart-5)",
};

function firstOfYear() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}
function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border p-5 text-primary-foreground shadow-md"
      style={{ background: gradient }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
          {hint ? <div className="mt-1 text-xs opacity-75">{hint}</div> : null}
        </div>
        <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

function DashboardPage() {
  const [cursoId, setCursoId] = useState<string>("");
  const [materia, setMateria] = useState<string>("");
  const [periodo, setPeriodo] = useState<string>("");
  const [desde, setDesde] = useState(firstOfYear());
  const [hasta, setHasta] = useState(today());
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const cursosFn = useServerFn(getCursos);
  const materiasFn = useServerFn(getMaterias);
  const statsFn = useServerFn(getDashboardStats);

  const cursosQ = useQuery({ queryKey: ["dash:cursos"], queryFn: () => cursosFn() });
  const materiasQ = useQuery({
    queryKey: ["dash:materias", cursoId],
    queryFn: () => materiasFn({ data: { cursoId: cursoId || undefined } }),
  });
  const statsQ = useQuery({
    queryKey: ["dash:stats", cursoId, materia, periodo, desde, hasta],
    queryFn: () => statsFn({ data: { cursoId, materia, periodo, desde, hasta } }),
  });

  const data = statsQ.data;
  const materiasList = useMemo(() => {
    const arr = materiasQ.data?.materias ?? [];
    const seen = new Set<string>();
    return arr
      .map((m) => m.materia)
      .filter((n) => {
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [materiasQ.data]);

  async function handleExport() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const cursoTag = data?.cursoLabel?.replace(/[^\w-]+/g, "_") || "todos";
      const periodoTag = periodo || "anio";
      await exportElementToPDF(
        reportRef.current,
        `dashboard_${cursoTag}_${periodoTag}_${stamp}.pdf`,
        {
          title: "Dashboard NAZARETH",
          subtitle: `${data?.cursoLabel ?? ""} · ${materia || "Todas las materias"} · ${periodo || "Todo el año"} · ${desde} a ${hasta}`,
        },
      );
    } finally {
      setExporting(false);
    }
  }

  const topAlumnos = useMemo(
    () => (data?.presentismoPorAlumno ?? []).slice(0, 10),
    [data],
  );
  const bottomAlumnos = useMemo(
    () => [...(data?.presentismoPorAlumno ?? [])].reverse().slice(0, 10),
    [data],
  );

  return (
    <div className="space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard institucional</h1>
          <p className="text-sm text-muted-foreground">
            Vista panorámica de presentismo, calificaciones y pre-informes.
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting || !data} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:grid-cols-5">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Curso</label>
          <Select value={cursoId || "__all"} onValueChange={(v) => setCursoId(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos los cursos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos los cursos</SelectItem>
              {(cursosQ.data?.cursos ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Materia</label>
          <Select value={materia || "__all"} onValueChange={(v) => setMateria(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {materiasList.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Período</label>
          <Select value={periodo || "__all"} onValueChange={(v) => setPeriodo(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todo el año" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todo el año</SelectItem>
              {PERIODOS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {statsQ.isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : statsQ.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron cargar las estadísticas.
        </div>
      ) : data ? (
        <div ref={reportRef} className="space-y-5 bg-background p-1">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Presentismo"
              value={`${data.kpis.presentismoPct}%`}
              hint={`${data.kpis.totalRegistrosAsist} registros`}
              icon={Percent}
              gradient="linear-gradient(135deg, oklch(0.55 0.18 250), oklch(0.45 0.2 270))"
            />
            <KpiCard
              label="Alumnos"
              value={String(data.kpis.totalAlumnos)}
              hint={data.cursoLabel}
              icon={Users}
              gradient="linear-gradient(135deg, oklch(0.65 0.16 180), oklch(0.5 0.18 200))"
            />
            <KpiCard
              label="Promedio general"
              value={data.kpis.promedioGeneral ? data.kpis.promedioGeneral.toFixed(2) : "—"}
              hint="Calificaciones cargadas"
              icon={GraduationCap}
              gradient="linear-gradient(135deg, oklch(0.7 0.18 80), oklch(0.6 0.2 50))"
            />
            <KpiCard
              label="% TED"
              value={`${data.kpis.pctTED}%`}
              hint={periodo || "Total Mayo+Octubre"}
              icon={AlertTriangle}
              gradient="linear-gradient(135deg, oklch(0.6 0.22 25), oklch(0.5 0.22 10))"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Presentismo por día" description="% de asistencia (presentes + tardes) por jornada.">
              <ResponsiveContainer>
                <LineChart data={data.presentismoPorDia}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="pct" name="% Presentismo" stroke={PALETTE.chart1} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="presentes" name="Presentes" stroke={PALETTE.chart3} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="ausentes" name="Ausentes" stroke={PALETTE.chart2} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribución de calificaciones" description="Aprobados vs desaprobados vs sin calificar.">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.distribucionNotas}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {data.distribucionNotas.map((_, i) => (
                      <Cell key={i} fill={[PALETTE.chart1, PALETTE.chart2, PALETTE.chart3][i % 3]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Promedio por materia" description="Promedio general por materia (todas las cargas).">
              <ResponsiveContainer>
                <BarChart data={data.promedioPorMateria} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="materia" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="promedio" fill={PALETTE.chart4} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Pre-Informes Mayo–Octubre" description="Cantidad TEA/TEP/TED por período.">
              <ResponsiveContainer>
                <BarChart data={data.preInformesPorPeriodo}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="TEA" stackId="a" fill={PALETTE.chart3} />
                  <Bar dataKey="TEP" stackId="a" fill={PALETTE.chart5} />
                  <Bar dataKey="TED" stackId="a" fill={PALETTE.chart2} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 10 — Mejor presentismo" description="Alumnos con mayor % en el rango.">
              <ResponsiveContainer>
                <BarChart data={topAlumnos} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="alumno" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="pct" fill={PALETTE.chart1} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Bottom 10 — Menor presentismo" description="Alumnos que requieren seguimiento.">
              <ResponsiveContainer>
                <BarChart data={bottomAlumnos} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="alumno" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="pct" fill={PALETTE.chart2} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Evolución del % TED" description="Tendencia entre Mayo y Octubre.">
              <ResponsiveContainer>
                <LineChart data={data.evolucionTED}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pctTED" name="% TED" stroke={PALETTE.chart2} strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
