import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createRoot } from "react-dom/client";
import { createRef } from "react";
import { getBoletinesCurso } from "@/lib/grades.functions";
import { getPreInformesCurso } from "@/lib/preinformes.functions";
import { BoletinPrintable } from "./BoletinPrintable";
import { PreInformePrintable } from "./PreInformePrintable";
import { exportElementsToPDF } from "@/lib/pdf-export";

type Props =
  | { tipo: "boletin"; cursoId: string; zipName: string; disabled?: boolean }
  | { tipo: "preinforme"; cursoId: string; zipName: string; disabled?: boolean };

// Mount a React element into a hidden off-screen container and resolve once painted.
async function mountOffscreen(
  node: React.ReactElement,
  ref: React.RefObject<HTMLDivElement | null>,
): Promise<{ element: HTMLDivElement; cleanup: () => void }> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(node);
  // Wait two animation frames so layout + image load have a chance to settle.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  // Give logo image one extra tick to decode.
  await new Promise((r) => setTimeout(r, 80));
  if (!ref.current) {
    root.unmount();
    host.remove();
    throw new Error("No se pudo preparar el contenido para PDF");
  }
  return {
    element: ref.current,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

export function BatchExportButton(props: Props) {
  const { tipo, cursoId, zipName, disabled } = props;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boletinesFn = useServerFn(getBoletinesCurso);
  const preinformesFn = useServerFn(getPreInformesCurso);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setProgress(null);
    const mounts: { cleanup: () => void }[] = [];
    try {
      const items: { element: HTMLDivElement; title?: string; subtitle?: string }[] = [];

      if (tipo === "boletin") {
        const data = await boletinesFn({ data: { cursoId } });
        setProgress({ done: 0, total: data.boletines.length });
        for (const it of data.boletines) {
          const ref = createRef<HTMLDivElement>();
          const m = await mountOffscreen(
            <BoletinPrintable
              ref={ref}
              alumno={it.alumno}
              filas={it.filas}
              stats={it.stats}
            />,
            ref,
          );
          mounts.push(m);
          items.push({ element: m.element });
        }
      } else {
        const data = await preinformesFn({ data: { cursoId } });
        setProgress({ done: 0, total: data.informes.length });
        for (const it of data.informes) {
          const ref = createRef<HTMLDivElement>();
          const m = await mountOffscreen(
            <PreInformePrintable ref={ref} alumno={it.alumno} filas={it.filas} />,
            ref,
          );
          mounts.push(m);
          items.push({ element: m.element });
        }
      }

      await exportElementsToPDF(items, zipName.replace(/\.zip$/i, ".pdf"), (done, total) =>
        setProgress({ done, total }),
      );
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Error al generar el PDF");
    } finally {
      for (const m of mounts) m.cleanup();
      setBusy(false);
      setTimeout(() => setProgress(null), 2000);
    }
  }

  const label =
    tipo === "boletin"
      ? "Descargar boletines del curso (PDF)"
      : "Descargar pre-informes del curso (PDF)";

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={handleClick} disabled={busy || disabled || !cursoId} variant="outline" className="h-10">
        <Download className="mr-2 h-4 w-4" />
        {busy
          ? progress
            ? `Generando ${progress.done}/${progress.total}…`
            : "Generando…"
          : label}
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
