# Arreglar generación de Boletín individual

## Diagnóstico

- La página `/calificaciones/boletin` carga la búsqueda OK, pero al elegir un alumno no aparece el botón "Descargar PDF" y la consola muestra "This page didn't load".
- El botón vive en `src/components/BoletinDownloadButton.tsx` y usa `React.lazy(() => import("@react-pdf/renderer"))`. Cuando ese chunk falla en cargar (`@react-pdf/renderer` v4 trae dependencias pesadas tipo `fontkit`/`buffer` que con frecuencia rompen el chunk en este entorno), el Suspense queda colgado y rompe el render del bloque del boletín → no se muestra el botón.
- El mismo patrón está en `PreInformeDownloadButton.tsx` y en el `BatchExportButton.tsx` (descarga masiva), así que el problema es transversal a todo lo que dependa de `@react-pdf/renderer`.
- En cambio, el Dashboard ya imprime PDFs correctamente usando `src/lib/pdf-export.ts` (html2canvas-pro + jsPDF), que sí funciona en este proyecto.

## Plan

1. **Migrar el Boletín individual a html2canvas + jsPDF**
   - En `src/routes/calificaciones.boletin.tsx`, envolver la sección visible del boletín (encabezado del alumno, stats y tabla) en un `ref` apuntando a un contenedor preparado para impresión (fondo blanco, ancho fijo tipo A4, tipografía oscura para buena legibilidad).
   - Reemplazar `<BoletinDownloadButton …>` por un botón normal que llame a `exportElementToPDF(ref.current, fileName, { title, subtitle })` desde `src/lib/pdf-export.ts`.
   - Mostrar estado "Generando…" mientras corre y un toast de error si falla.

2. **Crear una vista "imprimible" del boletín**
   - Añadir un componente `BoletinPrintable` (en `src/components/BoletinPrintable.tsx`) con el layout institucional (logo CESCA, datos del alumno, tabla de materias 1°C/2°C/Estado, stats y pie con firmas/leyenda) usando Tailwind + tokens existentes — pensado para captura con html2canvas (sin sombras raras, sin overflow oculto, colores semánticos seguros).
   - Reutilizar este componente tanto en la pantalla como pasarlo a html2canvas para que el PDF se vea igual a lo que el usuario ve.

3. **Migrar Pre-Informe individual al mismo patrón**
   - Crear `PreInformePrintable.tsx` y actualizar `src/routes/pre-informes.alumno.tsx` para usar `exportElementToPDF` en lugar de `PreInformeDownloadButton`.

4. **Migrar exportación masiva (`BatchExportButton`)**
   - Reemplazar la generación con `@react-pdf/renderer` por un loop que: por cada alumno, monta `BoletinPrintable` en un contenedor fuera de pantalla, lo captura con html2canvas y lo agrega como página al mismo `jsPDF` (un PDF único con todos los boletines del curso).
   - Mostrar progreso (X de N) en el botón.

5. **Limpieza**
   - Borrar `src/components/BoletinPDF.tsx`, `src/components/PreInformePDF.tsx`, `src/components/BoletinDownloadButton.tsx`, `src/components/PreInformeDownloadButton.tsx`.
   - Quitar la dependencia `@react-pdf/renderer` de `package.json` para que no vuelva a romper builds.

6. **Verificación**
   - Abrir `/calificaciones/boletin`, elegir un alumno, confirmar que se ve el bloque y que el botón descarga un PDF legible con datos correctos.
   - Repetir en `/pre-informes/alumno`.
   - Probar la descarga masiva por curso (si el usuario la usa).

## Notas técnicas

- `exportElementToPDF` ya parte el contenido en varias páginas A4 si es más alto que una hoja, así que boletines largos quedan multi-página automáticamente.
- Para que html2canvas no recorte ni distorsione, el contenedor imprimible se renderiza con un ancho fijo (~800px), fondo blanco explícito y sin `overflow-hidden` en los padres directos durante la captura.
- No se tocan los server functions (`getBoletinAlumno`, `getBoletinesCurso`) — los datos ya llegan bien; el problema es 100% de render del PDF en el cliente.
