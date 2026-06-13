import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

async function renderToCanvas(element: HTMLElement) {
  return html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
}

function addCanvasPaginated(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  opts: { isFirstPage: boolean; title?: string; subtitle?: string },
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;

  if (!opts.isFirstPage) pdf.addPage();

  let cursorY = margin;
  if (opts.title) {
    pdf.setFontSize(16);
    pdf.setTextColor(30, 30, 60);
    pdf.text(opts.title, margin, cursorY);
    cursorY += 18;
  }
  if (opts.subtitle) {
    pdf.setFontSize(10);
    pdf.setTextColor(110, 110, 130);
    pdf.text(opts.subtitle, margin, cursorY);
    cursorY += 14;
  }

  const availableWidth = pageWidth - margin * 2;
  const ratio = canvas.height / canvas.width;
  const imgHeight = availableWidth * ratio;
  const pageContentHeight = pageHeight - margin - cursorY;

  if (imgHeight <= pageContentHeight) {
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      margin,
      cursorY,
      availableWidth,
      imgHeight,
    );
    return;
  }

  const sliceHeightPx = Math.floor((pageContentHeight / imgHeight) * canvas.height);
  let sourceY = 0;
  let isFirstSlice = true;
  while (sourceY < canvas.height) {
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - sourceY);
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceCanvas.height,
      0,
      0,
      canvas.width,
      sliceCanvas.height,
    );
    const sliceData = sliceCanvas.toDataURL("image/png");
    const sliceImgHeight = availableWidth * (sliceCanvas.height / sliceCanvas.width);
    if (!isFirstSlice) {
      pdf.addPage();
      cursorY = margin;
    }
    pdf.addImage(sliceData, "PNG", margin, cursorY, availableWidth, sliceImgHeight);
    sourceY += sliceCanvas.height;
    isFirstSlice = false;
  }
}

export async function exportElementToPDF(
  element: HTMLElement,
  filename: string,
  meta?: { title?: string; subtitle?: string },
) {
  const canvas = await renderToCanvas(element);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  addCanvasPaginated(pdf, canvas, {
    isFirstPage: true,
    title: meta?.title,
    subtitle: meta?.subtitle,
  });
  pdf.save(filename);
}

export async function exportElementsToPDF(
  items: { element: HTMLElement; title?: string; subtitle?: string }[],
  filename: string,
  onProgress?: (done: number, total: number) => void,
) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const canvas = await renderToCanvas(it.element);
    addCanvasPaginated(pdf, canvas, {
      isFirstPage: i === 0,
      title: it.title,
      subtitle: it.subtitle,
    });
    onProgress?.(i + 1, items.length);
  }
  pdf.save(filename);
}
