import { forwardRef } from "react";
import logoNazareth from "@/assets/logo-nazareth.jpg.asset.json";

type Fila = {
  dni: string;
  apellido: string;
  nombre: string;
  total: number;
  presentes: number;
  ausentes: number;
  tardes: number;
  justificados: number;
  diasEsperados: number;
  pct: number;
};

type Props = {
  cursoLabel: string;
  desde: string;
  hasta: string;
  diasEsperados: number;
  filas: Fila[];
  ciclo?: string;
};

export const ReporteAsistenciaPrintable = forwardRef<HTMLDivElement, Props>(
  function ReporteAsistenciaPrintable({ cursoLabel, desde, hasta, diasEsperados, filas, ciclo = "2026" }, ref) {
    const fecha = new Date().toLocaleDateString("es-AR");
    return (
      <div
        ref={ref}
        style={{
          width: "800px",
          padding: "32px",
          background: "#ffffff",
          color: "#1a1a2e",
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "#1e2a5e",
            color: "#ffffff",
            padding: "14px 16px",
            borderRadius: "6px",
          }}
        >
          <img
            src={logoNazareth.url}
            alt="NAZARETH"
            crossOrigin="anonymous"
            style={{ width: "52px", height: "auto", objectFit: "contain" }}
          />
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>NAZARETH</div>
            <div style={{ fontSize: "11px", color: "#dde3f3", marginTop: "2px" }}>
              Educar es Amar · Reporte de Asistencia · Ciclo Lectivo {ciclo}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
          }}
        >
          <Cell label="Curso" value={cursoLabel} />
          <Cell label="Desde" value={desde} />
          <Cell label="Hasta" value={hasta} />
          <Cell label="Emisión" value={fecha} />
        </div>

        <div
          style={{
            marginTop: "10px",
            fontSize: "11px",
            color: "#4b5563",
          }}
        >
          Días hábiles esperados en el rango:{" "}
          <span style={{ fontWeight: 700, color: "#1e2a5e" }}>{diasEsperados}</span>.
          Se registran solo excepciones (Ausente, Tarde, Justificado); los alumnos sin registro se consideran Presentes.
          Tarde = ½ ausencia. Justificado no resta.
        </div>

        <table
          style={{
            width: "100%",
            marginTop: "12px",
            borderCollapse: "collapse",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            overflow: "hidden",
            fontSize: "11px",
          }}
        >
          <thead>
            <tr style={{ background: "#1e2a5e", color: "#ffffff" }}>
              <th style={th("left")}>Alumno</th>
              <th style={th("left")}>DNI</th>
              <th style={th("center")}>P</th>
              <th style={th("center")}>A</th>
              <th style={th("center")}>T</th>
              <th style={th("center")}>J</th>
              <th style={th("center")}>Esperados</th>
              <th style={th("center")}>% Asist.</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "12px", textAlign: "center", color: "#6b7280" }}>
                  Sin datos en el rango.
                </td>
              </tr>
            ) : (
              filas.map((f, i) => {
                const color = f.pct >= 85 ? "#0e7c5a" : f.pct >= 70 ? "#b45309" : "#c53030";
                return (
                  <tr
                    key={f.dni}
                    style={{
                      background: i % 2 === 1 ? "#f7f8fb" : "#ffffff",
                      borderTop: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={td("left")}>{f.apellido}, {f.nombre}</td>
                    <td style={td("left")}>{f.dni}</td>
                    <td style={td("center")}>{f.presentes}</td>
                    <td style={td("center")}>{f.ausentes}</td>
                    <td style={td("center")}>{f.tardes}</td>
                    <td style={td("center")}>{f.justificados}</td>
                    <td style={td("center")}>{f.diasEsperados}</td>
                    <td style={{ ...td("center"), color, fontWeight: 700 }}>
                      {f.diasEsperados > 0 ? `${f.pct}%` : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div
          style={{
            marginTop: "48px",
            display: "flex",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <SignBox label="Firma Preceptor/a" />
          <SignBox label="Firma Dirección" />
        </div>

        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
            fontSize: "10px",
            color: "#6b7280",
            fontStyle: "italic",
          }}
        >
          Nada sin la gracia de Dios
        </div>
      </div>
    );
  },
);

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

function SignBox({ label }: { label: string }) {
  return (
    <div style={{ width: "220px", textAlign: "center" }}>
      <div style={{ borderTop: "1px solid #333", marginBottom: "4px" }} />
      <div style={{ fontSize: "10px", color: "#6b7280" }}>{label}</div>
    </div>
  );
}

function th(align: "left" | "center"): React.CSSProperties {
  return {
    padding: "8px",
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
    textAlign: align,
  };
}

function td(align: "left" | "center"): React.CSSProperties {
  return { padding: "6px 8px", textAlign: align };
}
