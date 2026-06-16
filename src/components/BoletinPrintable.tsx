import { forwardRef } from "react";
import logoNazareth from "@/assets/logo-nazareth.jpg.asset.json";

type Alumno = {
  dni: string;
  apellido: string;
  nombre: string;
  curso: string;
  division: string;
  turno: string;
} | null;

type Fila = {
  materia: string;
  c1?: { notaFinal: string; promedio: string; estado: string };
  c2?: { notaFinal: string; promedio: string; estado: string };
};

type Stats = { promedioGeneral: string; aprobadas: number; total: number };

function fmt(v?: string) {
  if (!v || v.trim() === "" || v === "0") return "—";
  return v;
}

type Props = {
  alumno: Alumno;
  filas: Fila[];
  stats: Stats;
  ciclo?: string;
};

export const BoletinPrintable = forwardRef<HTMLDivElement, Props>(
  function BoletinPrintable({ alumno, filas, stats, ciclo = "2026" }, ref) {
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
            style={{
              width: "52px",
              height: "auto",
              objectFit: "contain",
            }}
          />
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>
              NAZARETH
            </div>
            <div style={{ fontSize: "11px", color: "#dde3f3", marginTop: "2px" }}>
              Educar es Amar · Boletín de Calificaciones · Ciclo Lectivo {ciclo}
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
            marginBottom: "6px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#1e2a5e",
          }}
        >
          Calificaciones por materia
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            overflow: "hidden",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr style={{ background: "#1e2a5e", color: "#ffffff" }}>
              <th style={th("left")}>Materia</th>
              <th style={th("center")}>1° Cuat.</th>
              <th style={th("center")}>2° Cuat.</th>
              <th style={th("center")}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: "12px", textAlign: "center", color: "#6b7280" }}
                >
                  Sin calificaciones cargadas.
                </td>
              </tr>
            ) : (
              filas.map((f, i) => {
                const ref = Number(
                  f.c2?.notaFinal ||
                    f.c2?.promedio ||
                    f.c1?.notaFinal ||
                    f.c1?.promedio ||
                    0,
                );
                const aprob = ref >= 7;
                const color = ref > 0 ? (aprob ? "#0e7c5a" : "#c53030") : "#6b7280";
                return (
                  <tr
                    key={f.materia}
                    style={{
                      background: i % 2 === 1 ? "#f7f8fb" : "#ffffff",
                      borderTop: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={td("left")}>{f.materia}</td>
                    <td style={td("center")}>{fmt(f.c1?.notaFinal || f.c1?.promedio)}</td>
                    <td style={td("center")}>{fmt(f.c2?.notaFinal || f.c2?.promedio)}</td>
                    <td style={{ ...td("center"), color, fontWeight: 700 }}>
                      {ref > 0 ? (aprob ? "Aprobado" : "Intensifica") : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div
          style={{
            marginTop: "16px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
          }}
        >
          <StatCard label="Promedio general" value={stats.promedioGeneral || "—"} />
          <StatCard label="Materias" value={String(stats.total)} />
          <StatCard
            label="Aprobadas"
            value={`${stats.aprobadas} / ${stats.total}`}
            accent="#c53030"
          />
        </div>

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

function StatCard({
  label,
  value,
  accent = "#1e2a5e",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderTop: `3px solid ${accent}`,
        borderRadius: "6px",
        padding: "10px 12px",
      }}
    >
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
      <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>{value}</div>
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
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
    textAlign: align,
  };
}

function td(align: "left" | "center"): React.CSSProperties {
  return { padding: "8px", textAlign: align };
}
