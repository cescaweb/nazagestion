const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const SHEET_ID = "1Y7ffSaIjF-vptuxtOnLpRZWw-H4mBR5VFmHeRIeB_14";

function getHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
    "Content-Type": "application/json",
  };
}

export async function getValues(range: string): Promise<string[][]> {
  const url = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/${range}`;
  const res = await fetch(url, { headers: getHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets getValues failed [${res.status}]: ${JSON.stringify(data)}`);
  return (data.values ?? []) as string[][];
}

export async function appendValues(range: string, values: (string | number)[][]) {
  const url = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ values }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets append failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

export async function updateValues(range: string, values: (string | number)[][]) {
  const url = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ values }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets update failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

export async function batchUpdate(body: unknown) {
  const url = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets batchUpdate failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

/** Map rows to objects using the first row as headers. */
export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  return rest
    .filter((r) => r.some((c) => c && c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h] = (r[i] ?? "").toString();
      });
      return obj;
    });
}
