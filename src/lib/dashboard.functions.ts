import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getValues, rowsToObjects } from "./sheets.server";
import { habilesEnRango, CICLO_INICIO, CICLO_FIN } from "./school-calendar";
import { getFeriadosSet } from "./feriados.functions";

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

    const [cursosRows, alumnosRows, asistRows, califRows, piRows, feriadosExtra] = await Promise.all([
      getValues("CURSOS!A1:G"),
      getValues("alumnos!A1:K"),
      getValues("ASISTENCIA!A1:I"),
      getValues("calificaciones!A1:Q"),
      getValues("PRE_INFORMES!A1:K"),
      getFeriadosSet(),
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

    // ---- ASISTENCIA (modelo por excepción: solo se registran ausentes/tardes/justificados) ----
    const asistObjs = rowsToObjects(asistRows);
    const hoyISO = new Date().toISOString().slice(0, 10);
    const desde = data.desde || CICLO_INICIO;
    const hasta = data.hasta || (hoyISO < CICLO_FIN ? hoyISO : CICLO_FIN);
    const asistFiltered = asistObjs
      .map((o) => ({
        fecha: o["Fecha"] ?? "",
        dni: o["DNI"] ?? "",
        presente: (o["Presente"] ?? "").trim() !== "",
        ausente: (o["Ausente"] ?? "").trim() !== "",
        tarde: (o["Tarde"] ?? "").trim() !== "",
        justificado: (o["Justificado"] ?? "").trim() !== "",
      }))
      .filter((r) => r.fecha >= desde && r.fecha <= hasta && dniSet.has(r.dni));

    const totalAsist = asistFiltered.length;
    const totalAusentes = asistFiltered.filter((r) => r.ausente).length;
    const totalTardes = asistFiltered.filter((r) => r.tarde).length;

    const diasEsperadosRango = habilesEnRango(desde, hasta, feriadosExtra);
    const nAlumnos = alumnos.length;
    const denomGlobal = diasEsperadosRango * nAlumnos;
    const presentismoPct =
      denomGlobal > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(((denomGlobal - totalAusentes - 0.5 * totalTardes) / denomGlobal) * 100),
            ),
          )
        : 0;

    const porDiaMap = new Map<string, { ausentes: number; tardes: number; justificados: number }>();
    for (const r of asistFiltered) {
      const e = porDiaMap.get(r.fecha) ?? { ausentes: 0, tardes: 0, justificados: 0 };
      if (r.ausente) e.ausentes++;
      else if (r.tarde) e.tardes++;
      else if (r.justificado) e.justificados++;
      porDiaMap.set(r.fecha, e);
    }
    const presentismoPorDia = Array.from(porDiaMap.entries())
      .map(([fecha, v]) => {
        const presentes = Math.max(0, nAlumnos - v.ausentes - v.tardes - v.justificados);
        const pct =
          nAlumnos > 0
            ? Math.max(0, Math.min(100, Math.round(((nAlumnos - v.ausentes - 0.5 * v.tardes) / nAlumnos) * 100)))
            : 0;
        return { fecha, presentes, ausentes: v.ausentes, tardes: v.tardes, justificados: v.justificados, pct };
      })
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

    const porAlumnoMap = new Map<string, { aus: number; tar: number; jus: number }>();
    for (const r of asistFiltered) {
      const e = porAlumnoMap.get(r.dni) ?? { aus: 0, tar: 0, jus: 0 };
      if (r.ausente) e.aus++;
      else if (r.tarde) e.tar++;
      else if (r.justificado) e.jus++;
      porAlumnoMap.set(r.dni, e);
    }
    const presentismoPorAlumno = alumnos
      .map((a) => {
        const v = porAlumnoMap.get(a.dni) ?? { aus: 0, tar: 0, jus: 0 };
        const pct =
          diasEsperadosRango > 0
            ? Math.max(0, Math.min(100, Math.round(((diasEsperadosRango - v.aus - 0.5 * v.tar) / diasEsperadosRango) * 100)))
            : 0;
        return {
          alumno: `${a.apellido}, ${a.nombre}`,
          pct,
          total: diasEsperadosRango,
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
