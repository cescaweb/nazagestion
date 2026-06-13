import type { Rol } from "./auth.types";

export type Section = "dashboard" | "asistencia" | "calificaciones" | "pre-informes" | "historial" | "reportes" | "feriados";

const ACCESS: Record<Rol, Section[]> = {
  ADMIN: ["dashboard", "asistencia", "calificaciones", "pre-informes", "historial", "reportes", "feriados"],
  DOCENTE: ["calificaciones", "pre-informes", "historial", "reportes"],
  PRECEPTOR: ["asistencia", "calificaciones"],
};

export function hasAccess(rol: Rol, section: Section): boolean {
  return ACCESS[rol].includes(section);
}

export function defaultRouteFor(rol: Rol): string {
  if (rol === "ADMIN") return "/dashboard";
  if (rol === "PRECEPTOR") return "/";
  if (rol === "DOCENTE") return "/calificaciones";
  return "/";
}

export const NAV_BY_ROL: Record<Rol, { to: string; label: string; section: Section; exact?: boolean }[]> = {
  ADMIN: [
    { to: "/dashboard", label: "Dashboard", section: "dashboard" },
    { to: "/", label: "Asistencia", section: "asistencia", exact: true },
    { to: "/calificaciones", label: "Calificaciones", section: "calificaciones" },
    { to: "/pre-informes", label: "Pre-Informes", section: "pre-informes" },
    { to: "/historial", label: "Historial", section: "historial" },
    { to: "/reportes", label: "Reportes", section: "reportes" },
    { to: "/feriados", label: "Feriados", section: "feriados" },
  ],
  DOCENTE: [
    { to: "/calificaciones", label: "Calificaciones", section: "calificaciones" },
    { to: "/pre-informes", label: "Pre-Informes", section: "pre-informes" },
    { to: "/historial", label: "Historial", section: "historial" },
    { to: "/reportes", label: "Reportes", section: "reportes" },
  ],
  PRECEPTOR: [
    { to: "/", label: "Asistencia", section: "asistencia", exact: true },
    { to: "/calificaciones", label: "Calificaciones", section: "calificaciones" },
  ],
};
