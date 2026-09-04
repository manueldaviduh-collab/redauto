import { redautoAdapter } from './redautoAdapter.js';

// Registro de adaptadores de importación, en orden de detección. Agregar
// una fuente nueva (A2, Saint, Valery, u otro sistema futuro) es: crear su
// adaptador en este mismo directorio (con la misma forma que
// redautoAdapter.js — { id, label, matches(sheet), parse(sheet) }) y
// sumarlo a esta lista. Ningún otro archivo de la importación necesita
// cambiar para eso.
export const IMPORT_ADAPTERS = [redautoAdapter];

// Prueba cada adaptador registrado contra la hoja y devuelve el primero
// que reconozca el formato (o null si ninguno lo reconoce).
export function detectAdapter(sheet) {
  for (const adapter of IMPORT_ADAPTERS) {
    if (adapter.matches(sheet).ok) return adapter;
  }
  return null;
}

// Mensaje de error cuando ningún adaptador reconoce el archivo. Con un
// solo adaptador registrado (hoy: sólo RedAuto), se reutiliza su motivo
// específico de por qué no coincidió, para no perder el detalle que ya
// tenía este mensaje cuando RedAuto era la única fuente soportada. Con dos
// o más adaptadores registrados, listar el detalle de cada uno sería
// confuso, así que se usa un mensaje genérico.
export function describeDetectionFailure(sheet) {
  if (IMPORT_ADAPTERS.length === 1) {
    const { missing } = IMPORT_ADAPTERS[0].matches(sheet);
    if (missing?.length) {
      return `Faltan columnas obligatorias en el encabezado: ${missing.join(', ')}. Descarga la plantilla oficial de nuevo.`;
    }
  }
  return 'No reconocemos el formato de este archivo. Verifica que sea la plantilla oficial de RedAuto (u otro formato compatible) y vuelve a intentar.';
}
