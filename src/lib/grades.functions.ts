import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  appendValues,
  getValues,
  rowsToObjects,
  updateValues,
} from "./sheets.server";
import { getAlumnos, getAlumnosByCurso, getCursos } from "./attendance.functions";

export type Materia = {
  id: string;
  curso: string;
  division: string;
  materia: string;
  docente: string;
  emailDocente: string;
  horario: string;
  tipo: string;
  dniDocente: string;
};

export type Calificacion = {
  dni: string;
  apellido: string;
  nombre: string;
  curso: string;
  division: string;
  materia: string;
  cuatrimestre: string;
  nota1: string;
  nota2: string;
  nota3: string;
  nota4: string;
  promedio: string;
  notaFinal: string;
  estado: string;
  observaciones: string;
  docenteId: string;
  fechaCarga: string;
  rowIndex: number;
};

const CALIF_RANGE = "calificaciones!A1:Q";

export const getMaterias = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const rows = await getValues("MATERIAS!A1:I");
    const objs = rowsToObjects(rows);
    let materias: Materia[] = objs.map((o) => ({
      id: o["ID_Materia"] ?? "",
      curso: o["Curso"] ?? "",
      division: o["Division"] ?? "",
      materia: o["Materia"] ?? "",
      docente: o["Docente"] ?? "",
      emailDocente: o["Email_Docente"] ?? "",
      horario: o["Horario"] ?? "",
      tipo: o["Tipo"] ?? "",
      dniDocente: (o["DNI_Docente"] ?? "").trim(),
    }));
    // Filter by session role: DOCENTE only sees own materias
    const { getSession } = await import("./auth.server");
    const sess = await getSession();
    const sd = sess.data;
    if (sd?.rol === "DOCENTE" && sd.dniDocente) {
      materias = materias.filter((m) => m.dniDocente === sd.dniDocente);
    }
    if (data.cursoId) {
      const { cursos } = await getCursos();
      const curso = cursos.find((c) => c.id === data.cursoId);
      if (curso) {
        materias = materias.filter(
          (m) => m.curso === curso.anio && m.division === curso.division,
        );
      } else {
        materias = [];
      }
    }
    return { materias };
  });

async function readCalificaciones(): Promise<Calificacion[]> {
  const rows = await getValues(CALIF_RANGE);
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  const idx = (n: string) => header.indexOf(n);
  const iDni = idx("DNI");
  const iAp = idx("Alumno_Apellido");
  const iNo = idx("Alumno_Nombre");
  const iCu = idx("Curso");
  const iDi = idx("Division");
  const iMa = idx("Materia");
  const iCt = idx("Cuatrimestre");
  const iN1 = idx("Nota_1");
  const iN2 = idx("Nota_2");
  const iN3 = idx("Nota_3");
  const iN4 = idx("Nota_4");
  const iPr = idx("Promedio");
  const iNf = idx("Nota_Final");
  const iEs = idx("Estado");
  const iOb = idx("Observaciones");
  const iDo = idx("Docente_ID");
  const iFc = idx("Fecha_Carga");

  const out: Calificacion[] = [];
  rest.forEach((r, i) => {
    if (!r.some((c) => c && c.trim() !== "")) return;
    out.push({
      dni: r[iDni] ?? "",
      apellido: r[iAp] ?? "",
      nombre: r[iNo] ?? "",
      curso: r[iCu] ?? "",
      division: r[iDi] ?? "",
      materia: r[iMa] ?? "",
      cuatrimestre: r[iCt] ?? "",
      nota1: r[iN1] ?? "",
      nota2: r[iN2] ?? "",
      nota3: r[iN3] ?? "",
      nota4: r[iN4] ?? "",
      promedio: r[iPr] ?? "",
      notaFinal: r[iNf] ?? "",
      estado: r[iEs] ?? "",
      observaciones: r[iOb] ?? "",
      docenteId: r[iDo] ?? "",
      fechaCarga: r[iFc] ?? "",
      rowIndex: i + 2,
    });
  });
  return out;
}

export const getCalificaciones = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string; materia: string; cuatrimestre: string }) =>
    z
      .object({
        cursoId: z.string().min(1),
        materia: z.string().min(1),
        cuatrimestre: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const [{ alumnos, curso }, todas] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readCalificaciones(),
    ]);
    const dniSet = new Set(alumnos.map((a) => a.dni));
    const filas = todas.filter(
      (c) =>
        dniSet.has(c.dni) &&
        c.materia === data.materia &&
        c.cuatrimestre === data.cuatrimestre,
    );
    return { alumnos, curso, calificaciones: filas };
  });

const notaOpt = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null || v === undefined ? "" : String(v)))
  .refine(
    (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 1 && Number(v) <= 10),
    { message: "Nota debe estar entre 1 y 10" },
  );

const saveSchema = z.object({
  cursoId: z.string().min(1),
  materia: z.string().min(1),
  cuatrimestre: z.string().min(1),
  registros: z
    .array(
      z.object({
        dni: z.string().min(1),
        nota1: notaOpt,
        nota2: notaOpt,
        nota3: notaOpt,
        nota4: notaOpt,
        notaFinal: notaOpt,
        observaciones: z.string().max(500).optional().default(""),
      }),
    )
    .min(1)
    .max(200),
});

function calcPromedio(notas: string[]): string {
  const nums = notas
    .map((n) => Number(n))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (nums.length === 0) return "";
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return avg.toFixed(2);
}

function calcEstado(notaFinal: string, promedio: string): string {
  const ref = notaFinal !== "" ? Number(notaFinal) : Number(promedio);
  if (!Number.isFinite(ref) || ref === 0) return "";
  return ref >= 7 ? "Aprobado" : "Intensifica";
}

export const saveCalificaciones = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const [{ alumnos, curso }, todas] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readCalificaciones(),
    ]);
    if (!curso) throw new Error("Curso no encontrado");
    const alumnosMap = new Map(alumnos.map((a) => [a.dni, a]));
    const existentes = new Map(
      todas
        .filter(
          (c) =>
            c.materia === data.materia && c.cuatrimestre === data.cuatrimestre,
        )
        .map((c) => [c.dni, c]),
    );

    const fecha = new Date().toISOString().slice(0, 10);
    const toUpdate: { range: string; values: (string | number)[][] }[] = [];
    const toAppend: (string | number)[][] = [];

    for (const reg of data.registros) {
      const alumno = alumnosMap.get(reg.dni);
      if (!alumno) continue;
      const promedio = calcPromedio([reg.nota1, reg.nota2, reg.nota3, reg.nota4]);
      const estado = calcEstado(reg.notaFinal, promedio);
      const row = [
        alumno.dni,
        alumno.apellido,
        alumno.nombre,
        curso.anio,
        curso.division,
        data.materia,
        data.cuatrimestre,
        reg.nota1,
        reg.nota2,
        reg.nota3,
        reg.nota4,
        promedio,
        reg.notaFinal,
        estado,
        reg.observaciones ?? "",
        "",
        fecha,
      ];
      const exist = existentes.get(reg.dni);
      if (exist) {
        toUpdate.push({
          range: `calificaciones!A${exist.rowIndex}:Q${exist.rowIndex}`,
          values: [row],
        });
      } else {
        toAppend.push(row);
      }
    }

    for (const u of toUpdate) await updateValues(u.range, u.values);
    if (toAppend.length > 0) await appendValues("calificaciones!A1:Q1", toAppend);

    return { updated: toUpdate.length, inserted: toAppend.length };
  });

function isExtraTipo(tipo: string): boolean {
  return /extra/i.test(tipo ?? "");
}

function sortMateriasByTipo<T extends { materia: string }>(
  filas: T[],
  materiasMeta: Materia[],
): T[] {
  const tipoMap = new Map<string, string>();
  for (const m of materiasMeta) tipoMap.set(m.materia, m.tipo);
  return [...filas].sort((a, b) => {
    const ea = isExtraTipo(tipoMap.get(a.materia) ?? "") ? 1 : 0;
    const eb = isExtraTipo(tipoMap.get(b.materia) ?? "") ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return a.materia.localeCompare(b.materia);
  });
}

// Keep only the latest record (by Fecha_Carga) for each (materia, cuatrimestre)
function dedupLatestCalif(items: Calificacion[]): Calificacion[] {
  const map = new Map<string, Calificacion>();
  for (const c of items) {
    const key = `${c.materia}|${c.cuatrimestre}`;
    const prev = map.get(key);
    if (!prev || (c.fechaCarga ?? "") > (prev.fechaCarga ?? "")) {
      map.set(key, c);
    }
  }
  return Array.from(map.values());
}

function buildBoletinFilas(propias: Calificacion[]) {
  const latest = dedupLatestCalif(propias);
  const materias = new Map<
    string,
    { materia: string; c1?: Calificacion; c2?: Calificacion }
  >();
  for (const c of latest) {
    const entry = materias.get(c.materia) ?? { materia: c.materia };
    if (c.cuatrimestre === "1" || c.cuatrimestre.toLowerCase().startsWith("1"))
      entry.c1 = c;
    else if (c.cuatrimestre === "2" || c.cuatrimestre.toLowerCase().startsWith("2"))
      entry.c2 = c;
    materias.set(c.materia, entry);
  }
  return Array.from(materias.values());
}

async function getMateriasMetaFor(curso: string, division: string): Promise<Materia[]> {
  const all = await getMaterias({ data: {} });
  return all.materias.filter((m) => m.curso === curso && m.division === division);
}

export const getBoletinAlumno = createServerFn({ method: "POST" })
  .inputValidator((data: { dni: string }) =>
    z.object({ dni: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const [{ alumnos }, todas] = await Promise.all([
      getAlumnos(),
      readCalificaciones(),
    ]);
    const alumno = alumnos.find((a) => a.dni === data.dni) ?? null;
    const propias = todas.filter((c) => c.dni === data.dni);
    const filasRaw = buildBoletinFilas(propias);
    const materiasMeta = alumno
      ? await getMateriasMetaFor(alumno.curso, alumno.division)
      : [];
    const filas = sortMateriasByTipo(filasRaw, materiasMeta);
    const finales = propias
      .map((c) => Number(c.notaFinal || c.promedio))
      .filter((n) => Number.isFinite(n) && n > 0);
    const promedioGeneral =
      finales.length > 0
        ? (finales.reduce((a, b) => a + b, 0) / finales.length).toFixed(2)
        : "";
    const aprobadas = filas.filter((f) => {
      const ref = Number(f.c2?.notaFinal || f.c2?.promedio || f.c1?.notaFinal || f.c1?.promedio || 0);
      return ref >= 7;
    }).length;
    return {
      alumno,
      filas,
      stats: { promedioGeneral, aprobadas, total: filas.length },
    };
  });

export const getReporteMateria = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string; materia: string; cuatrimestre: string }) =>
    z
      .object({
        cursoId: z.string().min(1),
        materia: z.string().min(1),
        cuatrimestre: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { alumnos, curso, calificaciones } = await getCalificaciones({ data });
    const map = new Map(calificaciones.map((c) => [c.dni, c]));
    const filas = alumnos.map((a) => {
      const c = map.get(a.dni);
      return {
        dni: a.dni,
        apellido: a.apellido,
        nombre: a.nombre,
        nota1: c?.nota1 ?? "",
        nota2: c?.nota2 ?? "",
        nota3: c?.nota3 ?? "",
        nota4: c?.nota4 ?? "",
        promedio: c?.promedio ?? "",
        notaFinal: c?.notaFinal ?? "",
        estado: c?.estado ?? "",
      };
    });
    const conNota = filas.filter((f) => f.promedio !== "" || f.notaFinal !== "");
    const aprobados = conNota.filter((f) => f.estado === "Aprobado").length;
    const promedios = conNota
      .map((f) => Number(f.notaFinal || f.promedio))
      .filter((n) => Number.isFinite(n) && n > 0);
    const promedioCurso =
      promedios.length > 0
        ? (promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(2)
        : "";
    const pctAprobados =
      conNota.length > 0 ? Math.round((aprobados / conNota.length) * 100) : 0;
    return {
      curso,
      filas,
      stats: {
        cargados: conNota.length,
        total: filas.length,
        aprobados,
        pctAprobados,
        promedioCurso,
      },
    };
  });

export const getBoletinesCurso = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string }) =>
    z.object({ cursoId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const [{ alumnos, curso }, todas] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readCalificaciones(),
    ]);
    const materiasMeta = curso
      ? await getMateriasMetaFor(curso.anio, curso.division)
      : [];
    const boletines = alumnos.map((a) => {
      const propias = todas.filter((c) => c.dni === a.dni);
      const filasRaw = buildBoletinFilas(propias);
      const filas = sortMateriasByTipo(filasRaw, materiasMeta);
      const finales = propias
        .map((c) => Number(c.notaFinal || c.promedio))
        .filter((n) => Number.isFinite(n) && n > 0);
      const promedioGeneral =
        finales.length > 0
          ? (finales.reduce((x, y) => x + y, 0) / finales.length).toFixed(2)
          : "";
      const aprobadas = filas.filter((f) => {
        const ref = Number(
          f.c2?.notaFinal || f.c2?.promedio || f.c1?.notaFinal || f.c1?.promedio || 0,
        );
        return ref >= 7;
      }).length;
      return {
        alumno: {
          dni: a.dni,
          apellido: a.apellido,
          nombre: a.nombre,
          curso: a.curso,
          division: a.division,
          turno: a.turno,
        },
        filas,
        stats: { promedioGeneral, aprobadas, total: filas.length },
      };
    });
    return { curso, boletines };
  });
