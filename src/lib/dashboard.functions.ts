import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getValues, rowsToObjects } from "./sheets.server";

export type DashboardFilters = {
  cursoId?: string;
  materia?: string;
  periodo?: string;
  desde?: string;
  hasta?: string;
};

export type DashboardData = {
  kpis: {
    presentismoPct: number;
    totalAlumnos: number;
    promedioGeneral: number;
    pctTED: number;
    totalRegistrosAsist: number;
  };
  presentismoPorDia: { fecha: string; presentes: number; ausentes: number; tardes: number; justificados: number; pct: number }[];
  presentismoPorAlumno: { alumno: string; pct: number; total: number }[];
  promedioPorMateria: { materia: string; promedio: number; aprobados: number; total: number }[];
  distribucionNotas: { name: string; value: number }[];
  preInformesPorPeriodo: { periodo: string; TEA: number; TEP: number; TED: number }[];
  evolucionTED: { periodo: string; pctTED: number }[];
  cursoLabel: string;
};

const PERIODOS = ["Mayo", "Octubre"];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const getDashboardStats = createServerFn({ method: "POST" })
  .inputValidator((data: DashboardFilters) =>
    z
      .object({
        cursoId: z.string().optional().default(""),
        materia: z.string().optional().default(""),
        periodo: z.string().optional().default(""),
        desde: z.string().optional().default(""),
        hasta: z.string().optional().default(""),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    // Auth: ADMIN only
    const { getSession } = await import("./auth.server");
    const sess = await getSession();
    if (sess.data?.rol !== "ADMIN") {
      throw new Error("No autorizado");
    }

    const [cursosRows, alumnosRows, asistRows, califRows, piRows] = await Promise.all([
      getValues("CURSOS!A1:G"),
      getValues("alumnos!A1:K"),
      getValues("ASISTENCIA!A1:I"),
      getValues("calificaciones!A1:Q"),
      getValues("PRE_INFORMES!A1:K"),
    ]);

    const cursos = rowsToObjects(cursosRows).map((o) => ({
      id: o["ID_Curso"] ?? "",
      anio: o["Año"] ?? o["Anio"] ?? "",
      division: o["Division"] ?? "",
      turno: o["Turno"] ?? "",
    }));
    const curso = data.cursoId ? cursos.find((c) => c.id === data.cursoId) : undefined;
    const cursoLabel = curso ? `${curso.anio}° ${curso.division} (${curso.turno})` : "Todos los cursos";

    const alumnos = rowsToObjects(alumnosRows)
      .map((o) => ({
        dni: o["DNI"] ?? "",
        apellido: o["Apellido"] ?? "",
        nombre: o["Nombre"] ?? "",
        curso: o["Curso"] ?? "",
        division: o["Division"] ?? "",
        turno: o["Turno"] ?? "",
        activo: o["Activo"] ?? "",
      }))
      .filter((a) => {
        const act = (a.activo ?? "").toLowerCase();
        if (act === "no" || act === "false" || a.activo === "0") return false;
        if (curso) return a.curso === curso.anio && a.division === curso.division && a.turno === curso.turno;
        return true;
      });
    const dniSet = new Set(alumnos.map((a) => a.dni));

    // ---- ASISTENCIA ----
    const asistObjs = rowsToObjects(asistRows);
    const desde = data.desde || "0000-00-00";
    const hasta = data.hasta || "9999-99-99";
    const asistFiltered = asistObjs
      .map((o) => ({
        fecha: o["Fecha"] ?? "",
        dni: o["DNI"] ?? "",
        presente: (o["Presente"] ?? "").trim() !== "",
        ausente: (o["Ausente"] ?? "").trim() !== "",
        tarde: (o["Tarde"] ?? "").trim() !== "",
        justificado: (o["Justificado"] ?? "").trim() !== "",
      }))
      .filter((r) => r.fecha >= desde && r.fecha <= hasta && (!curso || dniSet.has(r.dni)));

    const totalAsist = asistFiltered.length;
    const totalPresentes = asistFiltered.filter((r) => r.presente).length;
    const totalTardes = asistFiltered.filter((r) => r.tarde).length;
    const presentismoPct = totalAsist > 0 ? Math.round(((totalPresentes + totalTardes) / totalAsist) * 100) : 0;

    const porDiaMap = new Map<string, { presentes: number; ausentes: number; tardes: number; justificados: number }>();
    for (const r of asistFiltered) {
      const e = porDiaMap.get(r.fecha) ?? { presentes: 0, ausentes: 0, tardes: 0, justificados: 0 };
      if (r.presente) e.presentes++;
      else if (r.ausente) e.ausentes++;
      else if (r.tarde) e.tardes++;
      else if (r.justificado) e.justificados++;
      porDiaMap.set(r.fecha, e);
    }
    const presentismoPorDia = Array.from(porDiaMap.entries())
      .map(([fecha, v]) => {
        const t = v.presentes + v.ausentes + v.tardes + v.justificados;
        return {
          fecha,
          ...v,
          pct: t > 0 ? Math.round(((v.presentes + v.tardes) / t) * 100) : 0,
        };
      })
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

    const porAlumnoMap = new Map<string, { pres: number; total: number }>();
    for (const r of asistFiltered) {
      const e = porAlumnoMap.get(r.dni) ?? { pres: 0, total: 0 };
      e.total++;
      if (r.presente || r.tarde) e.pres++;
      porAlumnoMap.set(r.dni, e);
    }
    const presentismoPorAlumno = Array.from(porAlumnoMap.entries())
      .map(([dni, v]) => {
        const a = alumnos.find((x) => x.dni === dni);
        return {
          alumno: a ? `${a.apellido}, ${a.nombre}` : dni,
          pct: v.total > 0 ? Math.round((v.pres / v.total) * 100) : 0,
          total: v.total,
        };
      })
      .sort((a, b) => b.pct - a.pct);

    // ---- CALIFICACIONES ----
    const califObjs = rowsToObjects(califRows).map((o) => ({
      dni: o["DNI"] ?? "",
      curso: o["Curso"] ?? "",
      division: o["Division"] ?? "",
      materia: o["Materia"] ?? "",
      promedio: o["Promedio"] ?? "",
      notaFinal: o["Nota_Final"] ?? "",
      estado: o["Estado"] ?? "",
    }));
    const califFiltered = califObjs.filter((c) => {
      if (curso && !dniSet.has(c.dni)) return false;
      if (data.materia && c.materia !== data.materia) return false;
      return true;
    });
    const matMap = new Map<string, { sum: number; count: number; aprob: number; total: number }>();
    for (const c of califFiltered) {
      const n = num(c.notaFinal) || num(c.promedio);
      const e = matMap.get(c.materia) ?? { sum: 0, count: 0, aprob: 0, total: 0 };
      e.total++;
      if (n > 0) {
        e.sum += n;
        e.count++;
        if (n >= 7) e.aprob++;
      }
      matMap.set(c.materia, e);
    }
    const promedioPorMateria = Array.from(matMap.entries())
      .map(([materia, v]) => ({
        materia,
        promedio: v.count > 0 ? Number((v.sum / v.count).toFixed(2)) : 0,
        aprobados: v.aprob,
        total: v.total,
      }))
      .sort((a, b) => b.promedio - a.promedio);

    let aprobados = 0;
    let desaprobados = 0;
    let sinCalificar = 0;
    let sumAll = 0;
    let countAll = 0;
    for (const c of califFiltered) {
      const n = num(c.notaFinal) || num(c.promedio);
      if (n <= 0) sinCalificar++;
      else if (n >= 7) {
        aprobados++;
        sumAll += n;
        countAll++;
      } else {
        desaprobados++;
        sumAll += n;
        countAll++;
      }
    }
    const distribucionNotas = [
      { name: "Aprobados", value: aprobados },
      { name: "Desaprobados", value: desaprobados },
      { name: "Sin calificar", value: sinCalificar },
    ];
    const promedioGeneral = countAll > 0 ? Number((sumAll / countAll).toFixed(2)) : 0;

    // ---- PRE-INFORMES ----
    const piObjs = rowsToObjects(piRows).map((o) => ({
      dni: o["DNI"] ?? "",
      materia: o["Materia"] ?? "",
      periodo: o["Periodo"] ?? "",
      valoracion: ((o["Valoracion"] ?? "").trim().toUpperCase() as "TEA" | "TEP" | "TED" | ""),
    }));
    const piFiltered = piObjs.filter((p) => {
      if (curso && !dniSet.has(p.dni)) return false;
      if (data.materia && p.materia !== data.materia) return false;
      return true;
    });
    const piMap = new Map<string, { TEA: number; TEP: number; TED: number }>();
    for (const p of PERIODOS) piMap.set(p, { TEA: 0, TEP: 0, TED: 0 });
    for (const p of piFiltered) {
      if (!PERIODOS.includes(p.periodo)) continue;
      const e = piMap.get(p.periodo)!;
      if (p.valoracion === "TEA") e.TEA++;
      else if (p.valoracion === "TEP") e.TEP++;
      else if (p.valoracion === "TED") e.TED++;
    }
    const preInformesPorPeriodo = PERIODOS.map((periodo) => ({ periodo, ...piMap.get(periodo)! }));
    const evolucionTED = preInformesPorPeriodo.map((e) => {
      const total = e.TEA + e.TEP + e.TED;
      return { periodo: e.periodo, pctTED: total > 0 ? Math.round((e.TED / total) * 100) : 0 };
    });

    const piPeriodoSlice = data.periodo
      ? piFiltered.filter((p) => p.periodo === data.periodo)
      : piFiltered;
    const totalPI = piPeriodoSlice.length;
    const totalTED = piPeriodoSlice.filter((p) => p.valoracion === "TED").length;
    const pctTED = totalPI > 0 ? Math.round((totalTED / totalPI) * 100) : 0;

    const dto: DashboardData = {
      kpis: {
        presentismoPct,
        totalAlumnos: alumnos.length,
        promedioGeneral,
        pctTED,
        totalRegistrosAsist: totalAsist,
      },
      presentismoPorDia,
      presentismoPorAlumno,
      promedioPorMateria,
      distribucionNotas,
      preInformesPorPeriodo,
      evolucionTED,
      cursoLabel,
    };
    return dto;
  });
