import { readTabularFile } from './import/readTabularFile.js';
import { detectAdapter, describeDetectionFailure } from './import/adapters/index.js';
import { validateAndGroup } from './import/validateAndGroup.js';

// Punto de entrada de la importación masiva — usado tanto por /preview
// (sólo valida) como por /commit (valida igual y después escribe, ver
// server/src/routes/productsImport.js). Desde esta versión soporta más de
// un formato de archivo y más de una fuente, en tres pasos:
//   1. Leer el archivo (.xlsx o .csv) a una hoja común — import/readTabularFile.js
//   2. Detectar de qué fuente es y traducirla al vocabulario común —
//      un adaptador por fuente en import/adapters/ (hoy sólo RedAuto;
//      agregar A2/Saint/Valery es agregar un adaptador ahí, nada más)
//   3. Validar y agrupar con las reglas de negocio de siempre —
//      import/validateAndGroup.js, igual sin importar la fuente
export async function parseImportWorkbook(buffer, categories, filename = '') {
  const sheet = await readTabularFile(buffer, filename);
  if (!sheet) {
    return { products: [], errors: [{ row: 0, message: 'El archivo no tiene ninguna hoja con datos.' }], totalRows: 0 };
  }

  const adapter = detectAdapter(sheet);
  if (!adapter) {
    return { products: [], errors: [{ row: 1, message: describeDetectionFailure(sheet) }], totalRows: 0 };
  }

  const rawRows = adapter.parse(sheet);
  return validateAndGroup(rawRows, categories);
}
