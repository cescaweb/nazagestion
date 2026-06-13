import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  appendValues,
  getValues,
  updateValues,
} from "./sheets.server";
import {
  getAlumnos,
  getAlumnosByCurso,
} from "./attendance.functions";
import { getMaterias, type Materia } from "./grades.functions";

export type Valoracion = "" | "TEA" | "TEP" | "TED";

export type PreInforme = {
  dni: string;
  apellido: string;
  nombre: string;
  curso: string;
  division: string;
  materia: string;
  periodo: string;
  valoracion: Valoracion;
  docenteId: string;
  fechaCarga: string;
  observaciones: string;
  rowIndex: number;
};

const PI_RANGE = "PRE_INFORMES!A1:K";

function normValoracion(v: string): Valoracion {
  const u = (v ?? "").trim().toUpperCase();
  if (u === "TEA" || u === "TEP" || u === "TED") return u;
  return "";
}

async function readPreInformes(): Promise<PreInforme[]> {
  const rows = await getValues(PI_RANGE);
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  const idx = (n: string) => header.indexOf(n);
  const iDni = idx("DNI");
  const iAp = idx("Alumno_Apellido");
  const iNo = idx("Alumno_Nombre");
  const iCu = idx("Curso");
  const iDi = idx("Division");
  const iMa = idx("Materia");
  const iPe = idx("Periodo");
  const iVa = idx("Valoracion");
  const iDo = idx("Docente_ID");
  const iFc = idx("Fecha_Carga");
  const iOb = idx("Observaciones");

  const out: PreInforme[] = [];
  rest.forEach((r, i) => {
    if (!r.some((c) => c && c.trim() !== "")) return;
    out.push({
      dni: r[iDni] ?? "",
      apellido: r[iAp] ?? "",
      nombre: r[iNo] ?? "",
      curso: r[iCu] ?? "",
      division: r[iDi] ?? "",
      materia: r[iMa] ?? "",
      periodo: r[iPe] ?? "",
      valoracion: normValoracion(r[iVa] ?? ""),
      docenteId: r[iDo] ?? "",
      fechaCarga: r[iFc] ?? "",
      observaciones: iOb >= 0 ? (r[iOb] ?? "") : "",
      rowIndex: i + 2,
    });
  });
  return out;
}

export const getPreInformes = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string; materia: string; periodo: string }) =>
    z
      .object({
        cursoId: z.string().min(1),
        materia: z.string().min(1),
        periodo: z.enum(["Mayo", "Octubre"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const [{ alumnos, curso }, todos] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readPreInformes(),
    ]);
    const dniSet = new Set(alumnos.map((a) => a.dni));
    const filas = todos.filter(
      (p) =>
        dniSet.has(p.dni) &&
        p.materia === data.materia &&
        p.periodo === data.periodo,
    );
    return { alumnos, curso, preinformes: filas };
  });

const saveSchema = z.object({
  cursoId: z.string().min(1),
  materia: z.string().min(1),
  periodo: z.enum(["Mayo", "Octubre"]),
  registros: z
    .array(
      z.object({
        dni: z.string().min(1),
        valoracion: z.enum(["", "TEA", "TEP", "TED"]).optional().default(""),
        observaciones: z.string().max(2000).optional().default(""),
      }),
    )
    .min(1)
    .max(200),
});

export const savePreInformes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const [{ alumnos, curso }, todos] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readPreInformes(),
    ]);
    if (!curso) throw new Error("Curso no encontrado");
    const alumnosMap = new Map(alumnos.map((a) => [a.dni, a]));
    const existentes = new Map(
      todos
        .filter((p) => p.materia === data.materia && p.periodo === data.periodo)
        .map((p) => [p.dni, p]),
    );

    const fecha = new Date().toISOString().slice(0, 10);
    const toUpdate: { range: string; values: (string | number)[][] }[] = [];
    const toAppend: (string | number)[][] = [];

    for (const reg of data.registros) {
      const alumno = alumnosMap.get(reg.dni);
      if (!alumno) continue;
      const valoracion = reg.valoracion ?? "";
      const observaciones = reg.observaciones ?? "";
      // Column order: A DNI · B Apellido · C Nombre · D Curso · E Division
      // F Materia · G Periodo · H Valoracion · I Observaciones · J Docente_ID · K Fecha_Carga
      const row = [
        alumno.dni,
        alumno.apellido,
        alumno.nombre,
        curso.anio,
        curso.division,
        data.materia,
        data.periodo,
        valoracion,
        observaciones,
        "",
        fecha,
      ];
      const exist = existentes.get(reg.dni);
      if (exist) {
        toUpdate.push({
          range: `PRE_INFORMES!A${exist.rowIndex}:K${exist.rowIndex}`,
          values: [row],
        });
      } else if (valoracion !== "" || observaciones.trim() !== "") {
        toAppend.push(row);
      }
    }

    for (const u of toUpdate) await updateValues(u.range, u.values);
    if (toAppend.length > 0) await appendValues("PRE_INFORMES!A1:K1", toAppend);

    return { updated: toUpdate.length, inserted: toAppend.length };
  });

export type PreInformeFila = {
  materia: string;
  periodo: string;
  valoracion: Valoracion;
  observaciones: string;
};

// Dedup: keep only the latest record per materia (by Fecha_Carga desc)
function dedupLatestPorMateria(items: PreInforme[]): PreInforme[] {
  const map = new Map<string, PreInforme>();
  for (const p of items) {
    const prev = map.get(p.materia);
    if (!prev || (p.fechaCarga ?? "") > (prev.fechaCarga ?? "")) {
      map.set(p.materia, p);
    }
  }
  return Array.from(map.values());
}

function isExtra(tipo: string): boolean {
  return /extra/i.test(tipo ?? "");
}

// Sort: Oficiales A→Z, then Extraprogramáticas A→Z.
// Materias without metadata fall into the Oficiales group.
function sortMateriasByTipo<T extends { materia: string }>(
  filas: T[],
  materiasMeta: Materia[],
): T[] {
  const tipoMap = new Map<string, string>();
  for (const m of materiasMeta) tipoMap.set(m.materia, m.tipo);
  return [...filas].sort((a, b) => {
    const ea = isExtra(tipoMap.get(a.materia) ?? "") ? 1 : 0;
    const eb = isExtra(tipoMap.get(b.materia) ?? "") ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return a.materia.localeCompare(b.materia);
  });
}

async function getMateriasMetaForAlumno(curso: string, division: string): Promise<Materia[]> {
  const all = await getMaterias({ data: {} });
  return all.materias.filter((m) => m.curso === curso && m.division === division);
}

export const getPreInformeAlumno = createServerFn({ method: "POST" })
  .inputValidator((data: { dni: string }) =>
    z.object({ dni: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const [{ alumnos }, todos] = await Promise.all([
      getAlumnos(),
      readPreInformes(),
    ]);
    const alumno = alumnos.find((a) => a.dni === data.dni) ?? null;
    const propias = todos.filter((p) => p.dni === data.dni);
    const latest = dedupLatestPorMateria(propias);
    const materiasMeta = alumno
      ? await getMateriasMetaForAlumno(alumno.curso, alumno.division)
      : [];
    const filasRaw: PreInformeFila[] = latest.map((p) => ({
      materia: p.materia,
      periodo: p.periodo,
      valoracion: p.valoracion,
      observaciones: p.observaciones,
    }));
    const filas = sortMateriasByTipo(filasRaw, materiasMeta);
    return { alumno, filas };
  });

export const getReportePreInformes = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string; materia: string; periodo: string }) =>
    z
      .object({
        cursoId: z.string().min(1),
        materia: z.string().min(1),
        periodo: z.enum(["Mayo", "Octubre"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { alumnos, curso, preinformes } = await getPreInformes({ data });
    const map = new Map(preinformes.map((p) => [p.dni, p]));
    const filas = alumnos.map((a) => {
      const p = map.get(a.dni);
      return {
        dni: a.dni,
        apellido: a.apellido,
        nombre: a.nombre,
        valoracion: (p?.valoracion ?? "") as Valoracion,
        observaciones: p?.observaciones ?? "",
      };
    });
    const cargados = filas.filter((f) => f.valoracion !== "").length;
    return {
      curso,
      filas,
      stats: { cargados, total: filas.length },
    };
  });

export const getPreInformesCurso = createServerFn({ method: "POST" })
  .inputValidator((data: { cursoId: string }) =>
    z.object({ cursoId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const [{ alumnos, curso }, todos] = await Promise.all([
      getAlumnosByCurso({ data: { cursoId: data.cursoId } }),
      readPreInformes(),
    ]);
    const materiasMeta = curso
      ? await getMateriasMetaForAlumno(curso.anio, curso.division)
      : [];
    const dniSet = new Set(alumnos.map((a) => a.dni));
    const porAlumno = new Map<string, PreInforme[]>();
    for (const p of todos) {
      if (!dniSet.has(p.dni)) continue;
      const arr = porAlumno.get(p.dni) ?? [];
      arr.push(p);
      porAlumno.set(p.dni, arr);
    }
    const informes = alumnos.map((a) => {
      const items = porAlumno.get(a.dni) ?? [];
      const latest = dedupLatestPorMateria(items);
      const filasRaw: PreInformeFila[] = latest.map((p) => ({
        materia: p.materia,
        periodo: p.periodo,
        valoracion: p.valoracion,
        observaciones: p.observaciones,
      }));
      return {
        alumno: a,
        filas: sortMateriasByTipo(filasRaw, materiasMeta),
      };
    });
    return { curso, informes };
  });

