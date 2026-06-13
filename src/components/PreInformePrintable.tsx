import { forwardRef } from "react";
import logoCesca from "@/assets/logo-cesca.png";

type Alumno = {
  dni: string;
  apellido: string;
  nombre: string;
  curso: string;
  division: string;
  turno: string;
} | null;

export type PreInformeFila = {
  materia: string;
  periodo: string;
  valoracion: "" | "TEA" | "TEP" | "TED";
  observaciones: string;
};

const VAL_BG: Record<"TEA" | "TEP" | "TED", string> = {
  TEA: "#047857",
  TEP: "#b45309",
  TED: "#b91c1c",
};

type Props = {
  alumno: Alumno;
  filas: PreInformeFila[];
  ciclo?: string;
};

export const PreInformePrintable = forwardRef<HTMLDivElement, Props>(
  function PreInformePrintable({ alumno, filas, ciclo = "2026" }, ref) {
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
            src={logoCesca}
            alt="CESCA"
            crossOrigin="anonymous"
            style={{
              width: "52px",
              height: "52px",
              background: "#ffffff",
              borderRadius: "50%",
              padding: "3px",
              objectFit: "contain",
            }}
          />
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>
              CENTRO EDUCATIVO SANTA CLARA DE ASÍS
            </div>
            <div style={{ fontSize: "11px", color: "#dde3f3", marginTop: "2px" }}>
              Pre-Informe Pedagógico · Ciclo Lectivo {ciclo}
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
          <Cell label="Alumno" value={alumno ? `${alumno.apellido}, ${alumno.nombre}` : "—"} />
          <Cell label="DNI" value={alumno?.dni ?? "—"} />
          <Cell
            label="Curso"
            value={alumno ? `${alumno.curso}° ${alumno.division} (${alumno.turno})` : "—"}
          />
          <Cell label="Emisión" value={fecha} />
        </div>

        <div
          style={{
            marginTop: "18px",
            marginBottom: "4px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#1e2a5e",
          }}
        >
          Valoraciones por materia
        </div>
        <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "10px" }}>
          TEA: Trayectoria Educativa Avanzada · TEP: en Proceso · TED: Discontinua
        </div>

        {filas.length === 0 ? (
          <div
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              padding: "16px",
              textAlign: "center",
              color: "#6b7280",
              fontStyle: "italic",
            }}
          >
            Sin valoraciones cargadas.
          </div>
        ) : (
          filas.map((f, i) => (
            <div
              key={`${f.materia}-${f.periodo}-${i}`}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                padding: "10px 12px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e2a5e" }}>
                  {f.materia}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {f.periodo}
                  </span>
                  {f.valoracion ? (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "3px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#ffffff",
                        background: VAL_BG[f.valoracion],
                      }}
                    >
                      {f.valoracion}
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "3px",
                        fontSize: "11px",
                        color: "#6b7280",
                        background: "#f3f4f6",
                      }}
                    >
                      —
                    </span>
                  )}
                </div>
              </div>
              {f.observaciones ? (
                <div style={{ marginTop: "6px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Observaciones
                  </div>
                  <div style={{ fontSize: "12px", marginTop: "2px", whiteSpace: "pre-wrap" }}>
                    {f.observaciones}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}

        <div
          style={{
            marginTop: "48px",
            display: "flex",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <SignBox label="Firma Docente" />
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
