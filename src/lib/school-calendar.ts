// Calendario escolar 2026 (ciclo lectivo)
// Todas las fechas en formato ISO "YYYY-MM-DD".

export const CICLO_INICIO = "2026-03-09";
export const CICLO_FIN = "2026-12-22";

export const RECESO_INVIERNO = {
  desde: "2026-07-20",
  hasta: "2026-07-31",
};

// Feriados nacionales 2026 (editable). Incluye trasladables.
export const FERIADOS_2026 = new Set<string>([
  "2026-03-24", // Día de la Memoria
  "2026-04-02", // Veteranos / Malvinas
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajador
  "2026-05-25", // Revolución de Mayo
  "2026-06-15", // Güemes (trasladado)
  "2026-07-09", // Independencia
  "2026-08-17", // San Martín (trasladado)
  "2026-10-12", // Diversidad cultural (trasladado)
  "2026-11-20", // Soberanía (trasladado)
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
]);

function maxISO(a: string, b: string) {
  return a > b ? a : b;
}
function minISO(a: string, b: string) {
  return a < b ? a : b;
}

function isFinde(d: Date) {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function inReceso(iso: string) {
  return iso >= RECESO_INVIERNO.desde && iso <= RECESO_INVIERNO.hasta;
}

function isFeriado(iso: string, extra?: Set<string>) {
  return FERIADOS_2026.has(iso) || (extra?.has(iso) ?? false);
}

/**
 * Cantidad de días hábiles del ciclo escolar dentro de [desdeISO, hastaISO]
 * (intersectado con [CICLO_INICIO, CICLO_FIN]), excluyendo fines de semana,
 * receso invernal y feriados (nacionales + extras cargados por ADMIN).
 */
export function habilesEnRango(
  desdeISO: string,
  hastaISO: string,
  feriadosExtra?: Set<string>,
): number {
  if (!desdeISO || !hastaISO) return 0;
  const desde = maxISO(desdeISO, CICLO_INICIO);
  const hasta = minISO(hastaISO, CICLO_FIN);
  if (desde > hasta) return 0;

  let count = 0;
  const cur = new Date(desde + "T00:00:00Z");
  const end = new Date(hasta + "T00:00:00Z");
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    if (!isFinde(cur) && !inReceso(iso) && !isFeriado(iso, feriadosExtra)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}
