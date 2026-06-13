import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { appendValues, getValues, updateValues, rowsToObjects } from "./sheets.server";
import { getSession } from "./auth.server";

export type Feriado = {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  rowIndex: number;
};

async function ensureAdmin() {
  const sess = await getSession();
  if (sess.data?.rol !== "ADMIN") throw new Error("Forbidden");
}

async function readFeriadosRaw(): Promise<Feriado[]> {
  try {
    const rows = await getValues("FERIADOS!A1:B");
    const objs = rowsToObjects(rows);
    return objs.map((o, i) => ({
      fecha: (o["Fecha"] ?? "").trim(),
      descripcion: (o["Descripcion"] ?? "").trim(),
      rowIndex: i + 2,
    }));
  } catch {
    return [];
  }
}

export const getFeriados = createServerFn({ method: "GET" }).handler(async () => {
  const feriados = await readFeriadosRaw();
  feriados.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return { feriados };
});

export const addFeriado = createServerFn({ method: "POST" })
  .inputValidator((d: { fecha: string; descripcion: string }) =>
    z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      descripcion: z.string().max(120).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await ensureAdmin();
    const existentes = await readFeriadosRaw();
    if (existentes.some((f) => f.fecha === data.fecha)) {
      return { ok: false, error: "Esa fecha ya está cargada" };
    }
    // Ensure header exists
    const rows = await getValues("FERIADOS!A1:B1").catch(() => [] as string[][]);
    if (rows.length === 0 || !rows[0]?.[0]) {
      await updateValues("FERIADOS!A1:B1", [["Fecha", "Descripcion"]]);
    }
    await appendValues("FERIADOS!A1:B1", [[data.fecha, data.descripcion]]);
    return { ok: true };
  });

export const deleteFeriado = createServerFn({ method: "POST" })
  .inputValidator((d: { fecha: string }) =>
    z.object({ fecha: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await ensureAdmin();
    const existentes = await readFeriadosRaw();
    const f = existentes.find((x) => x.fecha === data.fecha);
    if (!f) return { ok: false, error: "No encontrado" };
    // Clear the row (don't physically delete to keep things simple)
    await updateValues(`FERIADOS!A${f.rowIndex}:B${f.rowIndex}`, [["", ""]]);
    return { ok: true };
  });

/** Server-side helper: returns set of ISO dates marked as holidays. */
export async function getFeriadosSet(): Promise<Set<string>> {
  const list = await readFeriadosRaw();
  return new Set(list.filter((f) => f.fecha).map((f) => f.fecha));
}
