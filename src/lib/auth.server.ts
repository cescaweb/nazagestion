import { useSession } from "@tanstack/react-start/server";
import { getValues } from "./sheets.server";
import type { Rol, SessionData } from "./auth.types";

export type { Rol, SessionData };

export function sessionConfig() {
  let password = process.env.SESSION_SECRET || "";
  if (password.length < 32) {
    // Pad to satisfy iron-session min length; user-supplied entropy is preserved.
    password = (password + "_cesca_sge_default_padding_32chars_min").slice(0, 64);
  }
  return {
    password,
    name: "cesca-session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getSession() {
  return useSession<SessionData>(sessionConfig());
}


export type UsuarioRol = {
  user: string;
  password: string;
  rol: Rol;
  dniDocente: string;
};

function normRol(v: string): Rol | null {
  const u = (v ?? "").trim().toUpperCase();
  if (u === "ADMIN") return "ADMIN";
  if (u === "DOCENTE") return "DOCENTE";
  if (u === "PRECEPTOR" || u === "PRECEPTORES") return "PRECEPTOR";
  return null;
}

export async function readUsuariosRoles(): Promise<UsuarioRol[]> {
  const rows = await getValues("Usuarios_Roles!A1:H");
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  const idx = (n: string) => header.findIndex((h) => h.trim().toUpperCase() === n.toUpperCase());
  const iU = idx("USER");
  const iP = idx("PASSWORD");
  const iR = idx("ROL");
  const iD = idx("DNI_Docente");
  const out: UsuarioRol[] = [];
  for (const r of rest) {
    if (!r.some((c) => c && c.trim() !== "")) continue;
    const rol = normRol(r[iR] ?? "");
    if (!rol) continue;
    out.push({
      user: (r[iU] ?? "").trim(),
      password: r[iP] ?? "",
      rol,
      dniDocente: (iD >= 0 ? r[iD] ?? "" : "").trim(),
    });
  }
  return out;
}

// Constant-time string comparison
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // still loop to reduce timing variance
    let diff = 1;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Naive in-memory rate limit (best effort in serverless)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
