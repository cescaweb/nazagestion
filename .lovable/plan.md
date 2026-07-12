## Objetivo

Modernizar la paleta y tipografía del sitio para un look juvenil y llamativo, sin tocar los PDFs (que ya están perfectos).

## Decisiones

- **Paleta Menta Neón**: base oscura profunda `#0d1b2a`, verde bosque `#1b4332`, acento primario menta `#2dd4a8`, glow `#73ffb8`. En modo claro se usa fondo casi blanco con acentos menta vibrantes; en oscuro, fondo navy con acentos neón brillantes.
- **Tipografía**: Space Grotesk (títulos) + DM Sans (cuerpo), cargadas por `<link>` en `__root.tsx`.
- **Toggle claro/oscuro** en el header/navbar principal, con persistencia en `localStorage` (lectura en `useEffect` para evitar mismatch SSR).
- **PDFs intactos**: los printables (`PreInformePrintable`, `ReporteAsistenciaPrintable`, `BoletinPrintable`) usan estilos inline con hex fijos — no se tocan.

## Cambios

1. **`src/routes/__root.tsx`**: agregar `<link>` a Google Fonts (Space Grotesk + DM Sans, con preconnect). Agregar clase `dark` condicional en `<html>` según preferencia.
2. **`src/styles.css`**: reescribir tokens `:root` y `.dark` con la paleta Menta Neón en oklch, registrar `--font-sans` (DM Sans) y `--font-display` (Space Grotesk) en `@theme`, mantener estructura shadcn.
3. **`src/components/ThemeToggle.tsx`** (nuevo): botón con íconos sol/luna que alterna la clase `dark` en `<html>` y guarda en `localStorage`.
4. **Header/navegación**: montar el toggle donde ya está el menú principal (revisar `__root.tsx` o layout equivalente).
5. **Aplicar fuente display** a headings mediante utility `font-display` en títulos clave (dashboard, login, secciones) sin cambiar layouts.
6. **No tocar**: `PreInformePrintable.tsx`, `ReporteAsistenciaPrintable.tsx`, `BoletinPrintable.tsx`, ni `pdf-export.ts`.

## Detalles técnicos

- Tokens oklch aproximados:
  - Light: `--background` ~ oklch(0.99 0.005 180), `--foreground` ~ oklch(0.2 0.05 230), `--primary` ~ oklch(0.72 0.15 170) (menta), `--accent` ~ oklch(0.85 0.18 155) (glow).
  - Dark: `--background` ~ oklch(0.18 0.04 240) (navy), `--foreground` ~ oklch(0.97 0.01 170), `--primary` ~ oklch(0.78 0.17 165), acentos con más luminosidad para efecto neón.
- Sidebar en dark reutiliza el navy profundo con borde menta sutil.
- Toggle: `useHydrated` pattern o `useEffect` para leer `localStorage.getItem('theme')` y aplicar clase en `document.documentElement`.
- Verificación: capturar screenshots del dashboard, login y una sección interna en ambos modos vía Playwright para confirmar contraste y que no se rompa ningún componente shadcn.

## Fuera de alcance

- Rediseño de layouts o componentes.
- Cambios en lógica de negocio, auth, Sheets.
- PDFs y printables.
