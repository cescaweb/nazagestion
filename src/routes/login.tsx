import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginFn, getSessionFn } from "@/lib/auth.functions";
import { defaultRouteFor } from "@/lib/permissions";
import logoNazareth from "@/assets/logo-nazareth.jpg.asset.json";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async ({ search }) => {
    const session = await getSessionFn();
    if (session) {
      throw redirect({ to: search.redirect || defaultRouteFor(session.rol) });
    }
  },
  head: () => ({
    meta: [
      { title: "Ingresar · NAZARETH" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const login = useServerFn(loginFn);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login({ data: { user: user.trim(), password } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await router.invalidate();
      router.navigate({ to: search.redirect || defaultRouteFor(res.rol) });
    } catch {
      setError("No se pudo iniciar sesión. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={logoNazareth.url} alt="Logo NAZARETH" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">NAZARETH</h1>
            <p className="text-xs text-muted-foreground">Educar es Amar</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Usuario</label>
            <Input value={user} onChange={(e) => setUser(e.target.value)} autoFocus required autoComplete="username" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Contraseña</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
