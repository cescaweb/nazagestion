import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  appendValues,
  getValues,
  rowsToObjects,
  updateValues,
} from "./sheets.server";

const ESTADOS = ["Presente", "Ausente", "Tarde", "Justificado"] as const;
export type Estado = (typeof ESTADOS)[number];

export type Curso = {
  id: string;
  anio: string;
  division: string;
  turno: string;
  preceptor: string;
  label: string;
};

export type Alumno = {
  dni: string;
  apellido: string;
  nombre: string;
  curso: string;
  division: string;
  turno: string;
  activo: string;
};

export type AsistenciaRow = {
  fecha: string;
  dni: string;
  apellido: string;
  nombre: string;
  estado: Estado | "";
  hora: string;
  rowIndex: number; // 1-based row index in the sheet (header = 1)
};

function buildCursoLabel(anio: string, division: string, turno: string) {
  return `${anio}° ${division} (${turno})`;
}

export const getCursos = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getValues("CURSOS!A1:G");
  const objs = rowsToObjects(rows);
  let cursos: Curso[] = objs.map((o) => ({
    id: o["ID_Curso"] ?? "",
    anio: o["Año"] ?? o["Anio"] ?? "",
    division: o["Division"] ?? "",
    turno: o["Turno"] ?? "",
    preceptor: o["Preceptor"] ?? "",
    label: buildCursoLabel(
      o["Año"] ?? o["Anio"] ?? "",
      o["Division"] ?? "",
      o["Turno"] ?? "",
    ),
  }));
  // DOCENTE: limit to courses where they teach
  const { getSession } = await import("./auth.server");
  const sess = await getSession();
  const sd = sess.data;
  if (sd?.rol === "DOCENTE" && sd.dniDocente) {
    const matRows = await getValues("MATERIAS!A1:I");
    const matObjs = rowsToObjects(matRows);
    const claves = new Set(
      matObjs
        .filter((m) => (m["DNI_Docente"] ?? "").trim() === sd.dniDocente)
        .map((m) => `${m["Curso"]}|${m["Division"]}`),
    );
    cursos = cursos.filter((c) => claves.has(`${c.anio}|${c.division}`));
  }
  return { cursos };
});

export const getAlumnos = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getValues("alumnos!A1:K");
  const objs = rowsToObjects(rows);
  const alumnos: Alumno[] = objs.map((o) => ({
    dni: o["DNI"] ?? "",
    apellido: o["Apellido"] ?? "",
    nombre: o["Nombre"] ?? "",
    curso: o["Curso"] ?? "",
    division: o["Division"] ?? "",
    turno: o["Turno"] ?? "",
    activo: o["Activo"] ?? "",
  }));
  return { alumnos };
});

export const getAlumnosByCurso = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string }) => data)
  .handler(async ({ data }) => {
    const [cursosRes, alumnosRes] = await Promise.all([getCursos(), getAlumnos()]);
    const curso = cursosRes.cursos.find((c) => c.id === data.cursoId);
    if (!curso) return { alumnos: [] as Alumno[], curso: null };
    const alumnos = alumnosRes.alumnos.filter(
      (a) =>
        a.curso === curso.anio &&
        a.division === curso.division &&
        a.turno === curso.turno &&
        a.activo.toLowerCase() !== "no" &&
        a.activo.toLowerCase() !== "false" &&
        a.activo !== "0",
    );
    return { alumnos, curso };
  });

async function readAsistencia(): Promise<AsistenciaRow[]> {
  const rows = await getValues("ASISTENCIA!A1:I");
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  const idx = (name: string) => header.indexOf(name);
  const iFecha = idx("Fecha");
  const iDni = idx("DNI");
  const iAp = idx("Apellido");
  const iNo = idx("Nombre");
  const iP = idx("Presente");
  const iA = idx("Ausente");
  const iT = idx("Tarde");
  const iJ = idx("Justificado");
  const iH = idx("Hora_Registro");

  const out: AsistenciaRow[] = [];
  rest.forEach((r, i) => {
    if (!r.some((c) => c && c.trim() !== "")) return;
    let estado: Estado | "" = "";
    if (r[iP]?.trim()) estado = "Presente";
    else if (r[iA]?.trim()) estado = "Ausente";
    else if (r[iT]?.trim()) estado = "Tarde";
    else if (r[iJ]?.trim()) estado = "Justificado";
    out.push({
      fecha: r[iFecha] ?? "",
      dni: r[iDni] ?? "",
      apellido: r[iAp] ?? "",
      nombre: r[iNo] ?? "",
      estado,
      hora: r[iH] ?? "",
      rowIndex: i + 2, // header is row 1; data starts at row 2
    });
  });
  return out;
}

export const getAsistencia = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string; fecha: string }) =>
    z.object({ cursoId: z.string(), fecha: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const [{ alumnos }, registros] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readAsistencia(),
    ]);
    const dniSet = new Set(alumnos.map((a) => a.dni));
    const delDia = registros.filter(
      (r) => r.fecha === data.fecha && dniSet.has(r.dni),
    );
    return { registros: delDia };
  });

const saveSchema = z.object({
  cursoId: z.string().min(1),
  fecha: z.string().min(1), // ISO yyyy-mm-dd
  registros: z
    .array(
      z.object({
        dni: z.string().min(1),
        estado: z.enum(ESTADOS),
      }),
    )
    .min(1)
    .max(200),
});

export const saveAsistencia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const [{ alumnos }, existentes] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readAsistencia(),
    ]);
    const alumnosMap = new Map(alumnos.map((a) => [a.dni, a]));
    const existentesDia = new Map(
      existentes
        .filter((r) => r.fecha === data.fecha)
        .map((r) => [r.dni, r]),
    );

    const hora = new Date().toISOString().slice(11, 19);

    const toUpdate: { range: string; values: (string | number)[][] }[] = [];
    const toAppend: (string | number)[][] = [];

    for (const reg of data.registros) {
      const alumno = alumnosMap.get(reg.dni);
      if (!alumno) continue;
      const presente = reg.estado === "Presente" ? "X" : "";
      const ausente = reg.estado === "Ausente" ? "X" : "";
      const tarde = reg.estado === "Tarde" ? "X" : "";
      const justificado = reg.estado === "Justificado" ? "X" : "";
      const row = [
        data.fecha,
        alumno.dni,
        alumno.apellido,
        alumno.nombre,
        presente,
        ausente,
        tarde,
        justificado,
        hora,
      ];
      const existing = existentesDia.get(reg.dni);
      if (existing) {
        toUpdate.push({
          range: `ASISTENCIA!A${existing.rowIndex}:I${existing.rowIndex}`,
          values: [row],
        });
      } else {
        toAppend.push(row);
      }
    }

    for (const u of toUpdate) {
      await updateValues(u.range, u.values);
    }
    if (toAppend.length > 0) {
      await appendValues("ASISTENCIA!A1:I1", toAppend);
    }

    return { updated: toUpdate.length, inserted: toAppend.length };
  });

export const getHistorialAlumno = createServerFn({ method: "POST" })
  .inputValidator((data: { dni: string }) =>
    z.object({ dni: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { habilesEnRango, CICLO_INICIO } = await import("./school-calendar");
    const { getFeriadosSet } = await import("./feriados.functions");
    const [registros, feriadosExtra] = await Promise.all([
      readAsistencia(),
      getFeriadosSet(),
    ]);
    const propios = registros
      .filter((r) => r.dni === data.dni)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const total = propios.length;
    const presentes = propios.filter((r) => r.estado === "Presente").length;
    const tardes = propios.filter((r) => r.estado === "Tarde").length;
    const ausentes = propios.filter((r) => r.estado === "Ausente").length;
    const justificados = propios.filter((r) => r.estado === "Justificado").length;
    const hoy = new Date().toISOString().slice(0, 10);
    const diasEsperados = habilesEnRango(CICLO_INICIO, hoy, feriadosExtra);
    const asistidos = presentes + 0.5 * tardes + justificados;
    const pct =
      diasEsperados > 0
        ? Math.min(100, Math.round((asistidos / diasEsperados) * 100))
        : 0;
    return {
      registros: propios,
      stats: { total, presentes, tardes, ausentes, justificados, diasEsperados, pct },
    };
  });

export const getReporteCurso = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string; desde: string; hasta: string }) =>
    z
      .object({
        cursoId: z.string().min(1),
        desde: z.string().min(1),
        hasta: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { habilesEnRango } = await import("./school-calendar");
    const { getFeriadosSet } = await import("./feriados.functions");
    const [{ alumnos, curso }, registros, feriadosExtra] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readAsistencia(),
      getFeriadosSet(),
    ]);
    const diasEsperados = habilesEnRango(data.desde, data.hasta, feriadosExtra);
    const filas = alumnos.map((a) => {
      const propios = registros.filter(
        (r) =>
          r.dni === a.dni && r.fecha >= data.desde && r.fecha <= data.hasta,
      );
      const total = propios.length;
      const presentes = propios.filter((r) => r.estado === "Presente").length;
      const tardes = propios.filter((r) => r.estado === "Tarde").length;
      const ausentes = propios.filter((r) => r.estado === "Ausente").length;
      const justificados = propios.filter(
        (r) => r.estado === "Justificado",
      ).length;
      const asistidos = presentes + 0.5 * tardes + justificados;
      const pct =
        diasEsperados > 0
          ? Math.min(100, Math.round((asistidos / diasEsperados) * 100))
          : 0;
      return {
        dni: a.dni,
        apellido: a.apellido,
        nombre: a.nombre,
        total,
        presentes,
        ausentes,
        tardes,
        justificados,
        diasEsperados,
        pct,
      };
    });
    return { curso, filas, diasEsperados };
  });

