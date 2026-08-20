// Ilustraciones de producto estilo "ficha de marketplace": producto centrado
// sobre blanco puro, sin marcas de agua ni texto incrustado. No hay
// fotografía real disponible en este proyecto (sin banco de imágenes ni
// generador), así que se renderiza un vector detallado por categoría — el
// sustituto más honesto a una foto de estudio real.
//
// Deliberadamente sin <linearGradient>/<radialGradient> ni fill="url(#id)":
// esas referencias por fragmento son frágiles cuando el SVG se inserta vía
// innerHTML dentro de un iframe (WebKit/Safari en particular puede dejar el
// relleno sin pintar, mostrando sólo la tarjeta blanca vacía). Colores
// planos + formas superpuestas con opacidad dan una sensación de volumen
// suficiente y funcionan igual en cualquier navegador.
const C = {
  metal: '#c7ccd3',
  metalHi: '#eef0f3',
  metalDark: '#4b4f57',
  pad: '#26282c',
  red: '#e0403c',
  bottle: '#e7e8ea',
  glass: '#ffdd94',
  rubber: '#26262a',
};

function wrap(inner, viewBox = '0 0 240 240') {
  return `<svg class="product-art__svg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${inner}</svg>`;
}

const ART = {
  frenos: () => wrap(`
    <circle cx="118" cy="120" r="72" fill="${C.metal}" stroke="#9aa0a8" stroke-width="1.5"/>
    <circle cx="104" cy="106" r="46" fill="${C.metalHi}" opacity="0.5"/>
    <circle cx="118" cy="120" r="72" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1"/>
    ${Array.from({ length: 28 }, (_, i) => {
      const a = (i / 28) * Math.PI * 2;
      const x1 = 118 + Math.cos(a) * 46, y1 = 120 + Math.sin(a) * 46;
      const x2 = 118 + Math.cos(a) * 68, y2 = 120 + Math.sin(a) * 68;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#7d838c" stroke-width="0.6" stroke-opacity="0.5"/>`;
    }).join('')}
    <circle cx="118" cy="120" r="30" fill="${C.metalDark}"/>
    <circle cx="118" cy="120" r="30" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1"/>
    ${[0, 72, 144, 216, 288].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const x = 118 + Math.cos(a) * 19, y = 120 + Math.sin(a) * 19;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="${C.metal}"/>`;
    }).join('')}
    <circle cx="118" cy="120" r="9" fill="${C.metal}"/>
    <g transform="translate(154 150) rotate(28)">
      <rect x="-8" y="-46" width="52" height="92" rx="10" fill="${C.pad}"/>
      <rect x="-8" y="-46" width="52" height="14" rx="6" fill="${C.metal}"/>
      <rect x="-2" y="-26" width="40" height="62" rx="4" fill="#111214"/>
      <circle cx="18" cy="-39" r="3" fill="#7c828b"/>
    </g>
  `),
  motor: () => wrap(`
    <rect x="98" y="30" width="44" height="26" rx="4" fill="${C.metal}"/>
    <rect x="98" y="30" width="44" height="26" rx="4" fill="none" stroke="#767b83" stroke-width="1"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${104 + i * 6.5}" y1="30" x2="${104 + i * 6.5}" y2="56" stroke="#8b9099" stroke-width="1" opacity="0.6"/>`).join('')}
    <rect x="108" y="56" width="24" height="16" fill="${C.metalDark}"/>
    <path d="M104 72 h32 l6 20 h-44 z" fill="#e9e2d6"/>
    <path d="M104 72 h32 l6 20 h-44 z" fill="none" stroke="#cfc6b4" stroke-width="1"/>
    ${[0, 1, 2, 3].map((i) => `<ellipse cx="120" cy="${96 + i * 8}" rx="17" ry="3.2" fill="none" stroke="#d8d0bd" stroke-width="1.4"/>`).join('')}
    <rect x="106" y="128" width="28" height="46" rx="3" fill="${C.metalDark}"/>
    <rect x="112" y="174" width="16" height="10" fill="${C.metal}"/>
    <path d="M120 184 l7 14 -7 -4 -7 4 z" fill="${C.red}"/>
  `),
  suspension: () => wrap(`
    <rect x="112" y="30" width="16" height="40" rx="4" fill="${C.metal}"/>
    <path d="M120 66
      C 90 74, 90 90, 120 98
      C 150 106, 150 122, 120 130
      C 90 138, 90 154, 120 162
      C 150 170, 150 186, 120 194"
      fill="none" stroke="${C.metalDark}" stroke-width="10" stroke-linecap="round"/>
    <rect x="108" y="192" width="24" height="14" rx="3" fill="${C.metal}"/>
    <rect x="115" y="60" width="10" height="150" rx="5" fill="${C.red}" opacity="0.92"/>
    <rect x="117" y="60" width="2.5" height="150" fill="#ffffff" opacity="0.35"/>
  `),
  baterias: () => wrap(`
    <rect x="52" y="86" width="136" height="98" rx="10" fill="${C.metalDark}"/>
    <rect x="52" y="86" width="136" height="98" rx="10" fill="none" stroke="#000" stroke-opacity="0.3"/>
    <rect x="64" y="98" width="112" height="58" rx="4" fill="${C.red}" opacity="0.16"/>
    <rect x="64" y="98" width="112" height="4" fill="#ffffff" opacity="0.18"/>
    <rect x="72" y="66" width="20" height="24" rx="3" fill="${C.metal}"/>
    <rect x="148" y="66" width="20" height="24" rx="3" fill="${C.metal}"/>
    <circle cx="82" cy="66" r="8" fill="${C.metal}"/>
    <circle cx="158" cy="66" r="8" fill="${C.metal}"/>
    <text x="82" y="71" font-size="12" font-weight="700" text-anchor="middle" fill="#3a3d42">+</text>
    <text x="158" y="70" font-size="14" font-weight="700" text-anchor="middle" fill="#3a3d42">−</text>
    <rect x="64" y="164" width="112" height="10" rx="3" fill="${C.red}"/>
  `),
  aceites: () => wrap(`
    <path d="M100 46 h40 v20 l10 12 v106 a10 10 0 0 1 -10 10 h-40 a10 10 0 0 1 -10 -10 v-106 l10 -12 z"
      fill="${C.bottle}" stroke="#c3c5c8" stroke-width="1.2"/>
    <rect x="104" y="34" width="32" height="16" rx="3" fill="${C.metal}"/>
    <rect x="100" y="78" width="40" height="72" rx="4" fill="#ffffff" stroke="#e3e4e6" stroke-width="1"/>
    <rect x="106" y="88" width="28" height="7" rx="2" fill="${C.red}"/>
    <rect x="106" y="100" width="28" height="4" rx="2" fill="#c9cbce"/>
    <rect x="106" y="108" width="20" height="4" rx="2" fill="#c9cbce"/>
    <rect x="106" y="134" width="28" height="10" rx="2" fill="${C.red}" opacity="0.85"/>
    <path d="M170 150 c0 10 -16 10 -16 0 c0 -8 8 -16 8 -16 s8 8 8 16z" fill="#ef5350" opacity="0.85"/>
  `),
  filtros: () => wrap(`
    <ellipse cx="120" cy="60" rx="46" ry="14" fill="${C.metal}"/>
    <rect x="74" y="60" width="92" height="104" fill="${C.metalDark}"/>
    ${Array.from({ length: 10 }, (_, i) => `<rect x="${78 + i * 9}" y="60" width="3.4" height="104" fill="#000" opacity="0.16"/>`).join('')}
    <ellipse cx="120" cy="164" rx="46" ry="14" fill="${C.metalDark}"/>
    <rect x="90" y="42" width="60" height="22" rx="5" fill="${C.red}"/>
    <ellipse cx="120" cy="42" rx="30" ry="9" fill="#ef5350"/>
    <ellipse cx="120" cy="60" rx="46" ry="14" fill="none" stroke="#00000022" stroke-width="1"/>
  `),
  iluminacion: () => wrap(`
    <ellipse cx="120" cy="92" rx="38" ry="46" fill="${C.glass}" opacity="0.95"/>
    <ellipse cx="108" cy="76" rx="12" ry="16" fill="#ffffff" opacity="0.55"/>
    <path d="M105 118 q15 14 30 0" stroke="#8a6d2a" stroke-width="2" fill="none" opacity="0.5"/>
    <rect x="104" y="130" width="32" height="20" rx="3" fill="${C.metal}"/>
    <rect x="98" y="150" width="44" height="30" rx="6" fill="${C.metalDark}"/>
    ${[0, 1, 2].map((i) => `<rect x="${104 + i * 12}" y="180" width="6" height="16" rx="2" fill="${C.metal}"/>`).join('')}
    <circle cx="120" cy="94" r="10" fill="#fff4cf" opacity="0.9"/>
  `),
  cauchos: () => wrap(`
    <circle cx="120" cy="120" r="82" fill="${C.rubber}"/>
    ${Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2;
      const x1 = 120 + Math.cos(a) * 78, y1 = 120 + Math.sin(a) * 78;
      const x2 = 120 + Math.cos(a) * 84, y2 = 120 + Math.sin(a) * 84;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000" stroke-width="3"/>`;
    }).join('')}
    <circle cx="120" cy="120" r="82" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="2"/>
    <circle cx="120" cy="120" r="52" fill="${C.metal}"/>
    <circle cx="120" cy="120" r="52" fill="none" stroke="#8a8f98" stroke-width="1"/>
    <circle cx="120" cy="120" r="16" fill="${C.metalDark}"/>
    ${[0, 60, 120, 180, 240, 300].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const x1 = 120 + Math.cos(a) * 18, y1 = 120 + Math.sin(a) * 18;
      const x2 = 120 + Math.cos(a) * 48, y2 = 120 + Math.sin(a) * 48;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#9aa0a8" stroke-width="6" stroke-linecap="round"/>`;
    }).join('')}
  `),
};

export function productArt(categoryId) {
  const build = ART[categoryId] || ART.motor;
  return build();
}
