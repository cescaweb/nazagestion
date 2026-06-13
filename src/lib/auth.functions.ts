import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Rol } from "./auth.types";
import {
  getSession,
  readUsuariosRoles,
  safeEqual,
  checkRateLimit,
  resetRateLimit,
} from "./auth.server";

export type PublicSession = {
  user: string;
  rol: Rol;
  dniDocente: string;
} | null;

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSession> => {
    const session = await getSession();
    const data = session.data;
    if (!data?.user || !data?.rol) return null;
    return { user: data.user, rol: data.rol, dniDocente: data.dniDocente ?? "" };
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        user: z.string().trim().min(1).max(100),
        password: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; rol: Rol } | { ok: false; error: string }> => {
    if (!checkRateLimit(`u:${data.user.toLowerCase()}`)) {
      return { ok: false, error: "Demasiados intentos. Probá en 15 minutos." };
    }
    const usuarios = await readUsuariosRoles();
    const match = usuarios.find(
      (u) => u.user.toLowerCase() === data.user.toLowerCase(),
    );
    if (!match || !safeEqual(match.password, data.password)) {
      return { ok: false, error: "Usuario o contraseña incorrectos." };
    }
    resetRateLimit(`u:${data.user.toLowerCase()}`);
    const session = await getSession();
    await session.update({
      user: match.user,
      rol: match.rol,
      dniDocente: match.dniDocente,
    });
    return { ok: true, rol: match.rol };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSession();
  await session.clear();
  return { ok: true };
});
