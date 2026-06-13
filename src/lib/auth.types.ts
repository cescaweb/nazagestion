export type Rol = "ADMIN" | "DOCENTE" | "PRECEPTOR";

export type SessionData = {
  user?: string;
  rol?: Rol;
  dniDocente?: string;
};
