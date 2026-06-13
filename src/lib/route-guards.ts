import { redirect } from "@tanstack/react-router";
import { hasAccess, defaultRouteFor, type Section } from "./permissions";
import type { PublicSession } from "./auth.functions";

export function guardSection(section: Section) {
  return ({ context }: { context: { session: PublicSession } }) => {
    const s = context.session;
    if (!s) throw redirect({ to: "/login" });
    if (!hasAccess(s.rol, section)) {
      throw redirect({ to: defaultRouteFor(s.rol) });
    }
  };
}
