"use client";

interface TetaVisualProps {
  sabor: string;
  categoria: string;
  size?: number;
}

interface SaborVisualConfig {
  baseColor: string;
  topColor: string;
  swirlColor?: string;
  hasDrip?: boolean;
  dripColor?: string;
}

export function getSaborVisualConfig(sabor: string, categoria: string): SaborVisualConfig {
  const s = sabor.toLowerCase();

  // 1. Línea de Yogurt & Yogurt Combinado
  if (s.includes("mora") && s.includes("yogurt")) {
    return { baseColor: "#f3e8ff", topColor: "#7e22ce", swirlColor: "#9333ea", hasDrip: true, dripColor: "#6b21a8" };
  }
  if (s.includes("fresa") && s.includes("yogurt")) {
    return { baseColor: "#ffe4e6", topColor: "#e11d48", swirlColor: "#f43f5e", hasDrip: true, dripColor: "#be123c" };
  }
  if (s.includes("mango") && s.includes("yogurt")) {
    return { baseColor: "#fef3c7", topColor: "#f59e0b", swirlColor: "#d97706", hasDrip: true, dripColor: "#b45309" };
  }
  if (s.includes("parchita") && s.includes("yogurt")) {
    return { baseColor: "#fef9c3", topColor: "#eab308", swirlColor: "#ca8a04", hasDrip: true, dripColor: "#854d0e" };
  }
  if (s.includes("durazno") && s.includes("yogurt")) {
    return { baseColor: "#ffedd5", topColor: "#fb923c", swirlColor: "#ea580c", hasDrip: true, dripColor: "#c2410c" };
  }

  // Yogurt Combinado
  if (s.includes("mango mora")) {
    return { baseColor: "#fde047", topColor: "#7e22ce", swirlColor: "#a855f7", hasDrip: true, dripColor: "#6b21a8" };
  }
  if (s.includes("mango parchita")) {
    return { baseColor: "#fde047", topColor: "#ea580c", swirlColor: "#f97316", hasDrip: true, dripColor: "#c2410c" };
  }
  if (s.includes("mante mora")) {
    return { baseColor: "#fef08a", topColor: "#9333ea", swirlColor: "#c084fc", hasDrip: true, dripColor: "#7e22ce" };
  }

  // 2. Combinadas
  if (s.includes("mante bati")) {
    return { baseColor: "#fef08a", topColor: "#10b981", swirlColor: "#059669", hasDrip: true, dripColor: "#047857" };
  }
  if (s.includes("mante fresa")) {
    return { baseColor: "#fef08a", topColor: "#e11d48", swirlColor: "#fb7185", hasDrip: true, dripColor: "#be123c" };
  }
  if (s.includes("mante limón") || s.includes("mante limon")) {
    return { baseColor: "#fef08a", topColor: "#84cc16", swirlColor: "#65a30d", hasDrip: true, dripColor: "#4d7c0f" };
  }
  if (s.includes("mante arequipe")) {
    return { baseColor: "#fef08a", topColor: "#b45309", swirlColor: "#d97706", hasDrip: true, dripColor: "#78350f" };
  }
  if (s.includes("mante kola")) {
    return { baseColor: "#fef08a", topColor: "#ec4899", swirlColor: "#f472b6", hasDrip: true, dripColor: "#db2777" };
  }
  if (s.includes("mante mango")) {
    return { baseColor: "#fef08a", topColor: "#f97316", swirlColor: "#fb923c", hasDrip: true, dripColor: "#ea580c" };
  }

  // 3. Con Chocolate & Especiales
  if (s.includes("choco coco")) {
    return { baseColor: "#592b10", topColor: "#ffffff", swirlColor: "#ffffff", hasDrip: true, dripColor: "#381c0b" };
  }
  if (s.includes("choco suiza") || s.includes("torta suiza")) {
    return { baseColor: "#451a03", topColor: "#fde047", swirlColor: "#eab308", hasDrip: true, dripColor: "#291002" };
  }
  if (s.includes("samba")) {
    return { baseColor: "#592b10", topColor: "#dc2626", swirlColor: "#ef4444", hasDrip: true, dripColor: "#381c0b" };
  }
  if (s.includes("choco arequipe")) {
    return { baseColor: "#592b10", topColor: "#d97706", swirlColor: "#b45309", hasDrip: true, dripColor: "#381c0b" };
  }
  if (s.includes("choco maní") || s.includes("choco mani") || s.includes("chocolate con maní")) {
    return { baseColor: "#592b10", topColor: "#ca8a04", swirlColor: "#facc15", hasDrip: true, dripColor: "#381c0b" };
  }
  if (s.includes("choco pasas")) {
    return { baseColor: "#451a03", topColor: "#6b21a8", swirlColor: "#9333ea", hasDrip: true, dripColor: "#291002" };
  }
  if (s.includes("chocoreal")) {
    return { baseColor: "#3c1d0e", topColor: "#78350f", swirlColor: "#a16207", hasDrip: true, dripColor: "#271208" };
  }
  if (s.includes("pirulin")) {
    return { baseColor: "#b45309", topColor: "#451a03", swirlColor: "#fef3c7", hasDrip: true, dripColor: "#291002" };
  }
  if (s.includes("coco arequipe")) {
    return { baseColor: "#fffbeb", topColor: "#b45309", swirlColor: "#d97706", hasDrip: true, dripColor: "#92400e" };
  }
  if (s.includes("coco") && !s.includes("choco")) {
    return { baseColor: "#ffffff", topColor: "#e2e8f0", swirlColor: "#f1f5f9", hasDrip: false };
  }
  if (s.includes("ron pasas")) {
    return { baseColor: "#fde68a", topColor: "#581c87", swirlColor: "#7e22ce", hasDrip: true, dripColor: "#3b0764" };
  }
  if (s.includes("arequipe")) {
    return { baseColor: "#d97706", topColor: "#92400e", swirlColor: "#b45309", hasDrip: true, dripColor: "#78350f" };
  }
  if (s.includes("crema real")) {
    return { baseColor: "#fef3c7", topColor: "#f59e0b", swirlColor: "#ffffff", hasDrip: true, dripColor: "#d97706" };
  }
  if (s.includes("fresa bombón") || s.includes("fresa bombon")) {
    return { baseColor: "#fb7185", topColor: "#451a03", swirlColor: "#fda4af", hasDrip: true, dripColor: "#291002" };
  }

  // 4. Clásicas / Otras
  if (s.includes("kolita")) {
    return { baseColor: "#f472b6", topColor: "#ffffff", swirlColor: "#ffffff", hasDrip: true, dripColor: "#ec4899" };
  }
  if (s.includes("batifresa")) {
    return { baseColor: "#fb7185", topColor: "#10b981", swirlColor: "#34d399", hasDrip: true, dripColor: "#f43f5e" };
  }
  if (s.includes("batibati")) {
    return { baseColor: "#34d399", topColor: "#059669", swirlColor: "#6ee7b7", hasDrip: true, dripColor: "#047857" };
  }
  if (s.includes("fresa")) {
    return { baseColor: "#f43f5e", topColor: "#e11d48", swirlColor: "#fda4af", hasDrip: true, dripColor: "#be123c" };
  }

  // Fallbacks por categoría si el sabor no tiene coincidencia nominal específica
  if (categoria === "linea_yogurt" || categoria === "yogurt_combinado") {
    return { baseColor: "#f3e8ff", topColor: "#7e22ce", swirlColor: "#9333ea", hasDrip: true, dripColor: "#6b21a8" };
  }
  if (categoria === "con_chocolate") {
    return { baseColor: "#592b10", topColor: "#381c0b", swirlColor: "#d97706", hasDrip: true, dripColor: "#271208" };
  }
  if (categoria === "combinadas") {
    return { baseColor: "#fef08a", topColor: "#ea580c", swirlColor: "#f97316", hasDrip: true, dripColor: "#c2410c" };
  }

  // Default fallback general
  return { baseColor: "#fef08a", topColor: "#f59e0b", swirlColor: "#fbbf24", hasDrip: true, dripColor: "#d97706" };
}

export default function TetaVisual({ sabor, categoria, size = 64 }: TetaVisualProps) {
  const config = getSaborVisualConfig(sabor, categoria);
  const gradId = `grad-${sabor.replace(/[^a-zA-Z0-9]/g, "")}-${size}`;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.12))",
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={config.topColor} />
            <stop offset="60%" stopColor={config.baseColor} />
            <stop offset="100%" stopColor={config.baseColor} />
          </linearGradient>
        </defs>

        {/* Forma cónica de la bolsita artesanal de teta */}
        <path
          d="M 50 12 
             C 54 18, 76 45, 82 68 
             C 86 82, 74 90, 50 90 
             C 26 90, 14 82, 18 68 
             C 24 45, 46 18, 50 12 Z"
          fill={`url(#${gradId})`}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Nudito / amarrado superior característico */}
        <ellipse cx="50" cy="11" rx="5" ry="3" fill="rgba(0,0,0,0.4)" />
        <path d="M 48 8 L 46 4 M 52 8 L 54 4" stroke="rgba(0,0,0,0.4)" strokeWidth="2" strokeLinecap="round" />

        {/* Brillo plástico de bolsita congelada */}
        <path
          d="M 32 35 C 28 48, 26 65, 30 76"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />

        {/* Espiral / Relleno / Topping característico */}
        {config.swirlColor && (
          <path
            d="M 42 28 Q 58 40, 44 56 T 60 74"
            stroke={config.swirlColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeOpacity="0.75"
          />
        )}

        {/* Chorrillo / Drip de chocolate o sirope en la punta */}
        {config.hasDrip && (
          <path
            d="M 44 18 
               Q 48 28, 50 26 
               Q 54 32, 57 20 
               Q 59 16, 50 13 Z"
            fill={config.dripColor || config.topColor}
          />
        )}
      </svg>
    </div>
  );
}
