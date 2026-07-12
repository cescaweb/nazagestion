import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  redirect,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSessionFn, logoutFn, type PublicSession } from "@/lib/auth.functions";
import { NAV_BY_ROL } from "@/lib/permissions";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

type RouterContext = {
  queryClient: QueryClient;
  session: PublicSession;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const session = await getSessionFn();
    const isLogin = location.pathname === "/login";
    if (!session && !isLogin) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { session };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NAZARETH SGE" },
      { name: "description", content: "Sistema de Gestion Escolar" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "NAZARETH SGE" },
      { property: "og:description", content: "Sistema de Gestion Escolar" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "NAZARETH SGE" },
      { name: "twitter:description", content: "Sistema de Gestion Escolar" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/up39Kb8IyDSOd0FfjNVcpP9i4lB2/social-images/social-1781609225402-logo_NAZ.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/up39Kb8IyDSOd0FfjNVcpP9i4lB2/social-images/social-1781609225402-logo_NAZ.webp" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import logoNazareth from "@/assets/logo-nazareth.jpg.asset.json";

function RootComponent() {
  const ctx = Route.useRouteContext() as { queryClient: QueryClient; session: PublicSession };
  const { queryClient, session } = ctx;
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const logout = useServerFn(logoutFn);

  const navLinkBase =
    "rounded-md px-3 py-1.5 text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground";
  const navLinkActive =
    "rounded-md px-3 py-1.5 bg-accent text-accent-foreground font-medium shadow-sm";

  const mobileLinkBase =
    "block rounded-md px-4 py-3 text-base text-foreground transition-colors hover:bg-accent/10";
  const mobileLinkActive =
    "block rounded-md px-4 py-3 text-base bg-accent text-accent-foreground font-medium";

  const navLinks = session ? NAV_BY_ROL[session.rol] : [];

  async function handleLogout() {
    await logout({});
    await router.invalidate();
    router.navigate({ to: "/login" });
  }

  if (!session) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-background">
          <div className="absolute right-3 top-3 z-50 rounded-md bg-primary/90 p-1 shadow-sm">
            <ThemeToggle />
          </div>
          <Outlet />
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-primary/20 bg-primary text-primary-foreground shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-6 md:py-3">
            <Link to="/" className="flex items-center gap-2 md:gap-3 min-w-0">
              <img
                src={logoNazareth.url}
                alt="Logo NAZARETH"
                className="h-9 w-auto md:h-10 object-contain shrink-0"
              />
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold tracking-wide truncate">
                  NAZARETH
                </div>
                <div className="hidden sm:block text-[11px] uppercase tracking-widest text-primary-foreground/60">
                  Educar es Amar
                </div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  activeOptions={l.exact ? { exact: true } : undefined}
                  className={navLinkBase}
                  activeProps={{ className: navLinkActive }}
                >
                  {l.label}
                </Link>
              ))}
              <div className="ml-2 flex items-center gap-2 border-l border-primary-foreground/20 pl-3">
                <span className="text-xs text-primary-foreground/70">
                  {session.user} · <span className="font-semibold">{session.rol}</span>
                </span>
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-3.5 w-3.5" /> Salir
                </button>
              </div>
            </nav>

            <div className="md:hidden flex items-center gap-1">
              <ThemeToggle />

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-primary-foreground hover:bg-white/10"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[260px] sm:w-[300px]">
                <SheetTitle className="px-1 pb-2 text-sm font-semibold text-muted-foreground">
                  {session.user} · {session.rol}
                </SheetTitle>
                <nav className="flex flex-col gap-1">
                  {navLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      activeOptions={l.exact ? { exact: true } : undefined}
                      className={mobileLinkBase}
                      activeProps={{ className: mobileLinkActive }}
                      onClick={() => setMobileOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="mt-2 flex items-center gap-2 rounded-md px-4 py-3 text-left text-base text-foreground hover:bg-accent/10"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
            </div>
          </div>

        </header>
        <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
