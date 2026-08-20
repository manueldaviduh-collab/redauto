// Set de iconos propios, minimalistas y consistentes (trazo 1.8, esquinas
// redondeadas). Se generan como <svg> inline para no depender de una
// librería de iconos externa.
const PATHS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.4l2.1 11.4a1.8 1.8 0 0 0 1.8 1.5h8.9a1.8 1.8 0 0 0 1.77-1.47L21 7.4H6"/>',
  store: '<path d="M3 9.5 4.4 4h15.2L21 9.5"/><path d="M4 9.5a2.3 2.3 0 0 0 4.5.7 2.3 2.3 0 0 0 4.5 0 2.3 2.3 0 0 0 4.5 0 2.3 2.3 0 0 0 4.5-.7"/><path d="M5 10v9.2a.8.8 0 0 0 .8.8H13v-6h4v6h1.2a.8.8 0 0 0 .8-.8V10"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>',
  mapPin: '<path d="M12 21s7-6.3 7-11.5a7 7 0 0 0-14 0C5 14.7 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
  star: '<path d="M12 3.5 14.6 9l6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8Z"/>',
  shieldCheck: '<path d="M12 3.5 19 6v5.5c0 5-3 8.2-7 9-4-.8-7-4-7-9V6Z"/><path d="m9 12 2 2 4-4.2"/>',
  filter: '<path d="M4 5h16"/><path d="M7 12h10"/><path d="M10.5 19h3"/>',
  heart: '<path d="M12 20.2s-7.3-4.4-9.4-9A5 5 0 0 1 12 6.9a5 5 0 0 1 9.4 4.3c-2.1 4.6-9.4 9-9.4 9Z"/>',
  share: '<circle cx="18" cy="5.5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="18.5" r="2.2"/><path d="m8 10.7 8-4.4M8 13.3l8 4.4"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  plusCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.3v7.4M8.3 12h7.4"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  x: '<path d="m5 5 14 14M19 5 5 19"/>',
  truck: '<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 10h4l3 3v2.5h-7Z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
  package: '<path d="m3.5 7.5 8.5-4 8.5 4-8.5 4-8.5-4Z"/><path d="M3.5 7.5v9l8.5 4 8.5-4v-9"/><path d="M12 11.5v9"/>',
  clipboardList: '<rect x="5" y="4.5" width="14" height="16" rx="1.5"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>',
  barChart: '<path d="M4 20V10M12 20V4M20 20v-7"/><path d="M2.5 20h19"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  logOut: '<path d="M9 19H5.5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 5.5 5H9"/><path d="M16 16l4-4-4-4"/><path d="M20 12H9"/>',
  edit: '<path d="M4 20h4.2L19 9.2a2 2 0 0 0 0-2.8L18 5.4a2 2 0 0 0-2.8 0L4.4 16.2 4 20Z"/>',
  phone: '<path d="M5 4h3.2l1.3 4-2 1.4a11.5 11.5 0 0 0 5.1 5.1l1.4-2 4 1.3V17a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M10.6 5.7A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 0 1-3.3 4.1M6.6 7.4A15.3 15.3 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3.8-.8"/><path d="M9.4 9.4a2.7 2.7 0 0 0 3.7 3.8"/>',
  check: '<path d="m4.5 12.5 5 5 10-10"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M6.3 17.7l1.5-1.5M16.2 7.8l1.5-1.5"/>',
  disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/>',
  activity: '<path d="M2.5 12h4l2-6 4 12 2-6h7"/>',
  batteryCharging: '<rect x="2.5" y="8" width="14" height="8" rx="1.5"/><path d="M17.5 10v4M21.5 10.5v3"/><path d="M11 9.5 8.7 12.7h3l-2.2 2.8"/>',
  droplet: '<path d="M12 3.5s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11Z"/>',
  lightbulb: '<path d="M9 18.5h6"/><path d="M9.5 21h5"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.2 1.1 2h5c0-.8.4-1.5 1.1-2A6 6 0 0 0 12 3.5Z"/>',
  circleDot: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.8"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8v.1"/>',
  location: '<path d="M12 21s7-6.3 7-11.5a7 7 0 0 0-14 0C5 14.7 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  trash: '<path d="M5 7h14"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7"/>',
};

export function icon(name, { size = 22, className = '', strokeWidth = 1.8 } = {}) {
  const inner = PATHS[name] || PATHS.info;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
