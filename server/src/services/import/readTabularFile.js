import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

// Capa A de la importación: convierte cualquier archivo soportado (.xlsx o
// .csv) en la MISMA representación (una hoja de ExcelJS), para que ningún
// adaptador de fuente (ver ./adapters) tenga que saber qué formato de
// archivo subió el vendedor — sólo trabajan con una hoja y sus celdas.
// Sólo se lee la primera hoja/tabla: ninguna fuente que soportamos hoy
// necesita más de una.
export async function readTabularFile(buffer, filename = '') {
  const workbook = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    const sheet = await workbook.csv.read(Readable.from(buffer));
    return sheet || null;
  }
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0] || null;
}

export function normalizeHeader(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function cellText(cell) {
  if (cell == null || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim(); // rich text
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim(); // fórmula
  return String(v).trim();
}

export function cellNumber(cell) {
  const text = cellText(cell);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

// Mapa "encabezado normalizado -> número de columna", leyendo la primera
// fila de la hoja. Lo usan tanto matches() como parse() de cada adaptador
// (ver ./adapters) para no repetir esta lectura. A diferencia de la
// versión original de este parser, acá NO se filtra por un vocabulario de
// columnas conocido — eso es responsabilidad de cada adaptador, que sólo
// lee las claves que le interesan a través de este índice.
export function buildColumnIndex(sheet) {
  const columnIndex = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeHeader(cellText(cell));
    if (key) columnIndex[key] = colNumber;
  });
  return columnIndex;
}
