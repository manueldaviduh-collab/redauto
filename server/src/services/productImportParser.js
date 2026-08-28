import ExcelJS from 'exceljs';

// Columnas que la plantilla oficial usa (ver productImportTemplate.js). El
// orden en el archivo no importa — se leen por nombre de encabezado, no por
// posición, así que una tienda que reordene columnas no rompe el import.
const HEADERS = [
  'nombre', 'sku', 'marca_repuesto', 'categoria', 'precio', 'stock', 'tipo',
  'disponibilidad', 'descripcion', 'ubicacion_interna',
  'vehiculo_marca', 'vehiculo_modelo', 'anio_desde', 'anio_hasta', 'motor', 'version',
];

const VALID_TYPES = ['original', 'alternativo'];
const VALID_AVAILABILITY = ['en_stock', 'bajo_pedido', 'agotado'];

function normalizeHeader(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function cellText(cell) {
  if (cell == null || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim(); // rich text
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim(); // fórmula
  return String(v).trim();
}

function cellNumber(cell) {
  const text = cellText(cell);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

// Parsea el archivo subido a un plan de importación, sin tocar la base de
// datos — usado tanto por /preview (solo valida) como por /commit (valida
// igual y después escribe). `categories` es la lista real de categorías
// válidas ({id, name}[]) para no duplicar esa taxonomía acá.
export async function parseImportWorkbook(buffer, categories) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { products: [], errors: [{ row: 0, message: 'El archivo no tiene ninguna hoja con datos.' }], totalRows: 0 };
  }

  const headerRow = sheet.getRow(1);
  const columnIndex = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeHeader(cellText(cell));
    if (HEADERS.includes(key)) columnIndex[key] = colNumber;
  });
  const missingHeaders = ['nombre', 'sku', 'categoria', 'precio'].filter((h) => !(h in columnIndex));
  if (missingHeaders.length) {
    return {
      products: [],
      errors: [{ row: 1, message: `Faltan columnas obligatorias en el encabezado: ${missingHeaders.join(', ')}. Descarga la plantilla oficial de nuevo.` }],
      totalRows: 0,
    };
  }

  const categoryByKey = new Map();
  categories.forEach((c) => {
    categoryByKey.set(c.id.toLowerCase(), c.id);
    categoryByKey.set(c.name.toLowerCase(), c.id);
  });

  const get = (row, key) => (columnIndex[key] ? row.getCell(columnIndex[key]) : null);

  const groups = new Map(); // sku -> { rows: [...] }
  const errors = [];
  let totalRows = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const sku = get(row, 'sku') ? cellText(get(row, 'sku')) : '';
    const nombre = get(row, 'nombre') ? cellText(get(row, 'nombre')) : '';
    const vehiculoMarca = get(row, 'vehiculo_marca') ? cellText(get(row, 'vehiculo_marca')) : '';
    const vehiculoModelo = get(row, 'vehiculo_modelo') ? cellText(get(row, 'vehiculo_modelo')) : '';
    // Fila completamente vacía (Excel a veces deja filas fantasma al final).
    if (!sku && !nombre && !vehiculoMarca && !vehiculoModelo) return;

    totalRows += 1;
    if (!sku) {
      errors.push({ row: rowNumber, message: 'Falta el SKU — es obligatorio en cada fila para agrupar el producto.' });
      return;
    }
    if (!groups.has(sku)) groups.set(sku, { firstRow: rowNumber, rows: [] });
    groups.get(sku).rows.push({
      rowNumber,
      nombre,
      marcaRepuesto: get(row, 'marca_repuesto') ? cellText(get(row, 'marca_repuesto')) : '',
      categoria: get(row, 'categoria') ? cellText(get(row, 'categoria')) : '',
      precio: get(row, 'precio') ? cellNumber(get(row, 'precio')) : null,
      stock: get(row, 'stock') ? cellNumber(get(row, 'stock')) : null,
      tipo: get(row, 'tipo') ? cellText(get(row, 'tipo')).toLowerCase() : '',
      disponibilidad: get(row, 'disponibilidad') ? cellText(get(row, 'disponibilidad')).toLowerCase() : '',
      descripcion: get(row, 'descripcion') ? cellText(get(row, 'descripcion')) : '',
      ubicacionInterna: get(row, 'ubicacion_interna') ? cellText(get(row, 'ubicacion_interna')) : '',
      vehiculoMarca,
      vehiculoModelo,
      anioDesde: get(row, 'anio_desde') ? cellNumber(get(row, 'anio_desde')) : null,
      anioHasta: get(row, 'anio_hasta') ? cellNumber(get(row, 'anio_hasta')) : null,
      motor: get(row, 'motor') ? cellText(get(row, 'motor')) : '',
      version: get(row, 'version') ? cellText(get(row, 'version')) : '',
    });
  });

  const products = [];
  for (const [sku, group] of groups) {
    const head = group.rows.find((r) => r.nombre) || group.rows[0];
    if (!head.nombre || head.nombre.trim().length < 2) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: falta el nombre del producto.` });
      continue;
    }
    if (!head.categoria) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: falta la categoría.` });
      continue;
    }
    const categoryId = categoryByKey.get(head.categoria.toLowerCase());
    if (!categoryId) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: la categoría "${head.categoria}" no existe. Usa una de la hoja Instrucciones.` });
      continue;
    }
    if (head.precio == null || Number.isNaN(head.precio) || head.precio < 0) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: el precio no es válido.` });
      continue;
    }
    if (head.stock != null && (Number.isNaN(head.stock) || head.stock < 0)) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: el stock no es válido.` });
      continue;
    }
    if (head.tipo && !VALID_TYPES.includes(head.tipo)) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: tipo debe ser "original" o "alternativo".` });
      continue;
    }
    if (head.disponibilidad && !VALID_AVAILABILITY.includes(head.disponibilidad)) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: disponibilidad debe ser en_stock, bajo_pedido o agotado.` });
      continue;
    }

    const compatibility = group.rows
      .filter((r) => r.vehiculoMarca && r.vehiculoModelo)
      .map((r) => ({
        brand: r.vehiculoMarca,
        model: r.vehiculoModelo,
        yearFrom: r.anioDesde && !Number.isNaN(r.anioDesde) ? r.anioDesde : undefined,
        yearTo: r.anioHasta && !Number.isNaN(r.anioHasta) ? r.anioHasta : undefined,
        engine: r.motor || undefined,
        trim: r.version || undefined,
      }));
    if (!compatibility.length) {
      errors.push({ row: head.rowNumber, message: `SKU ${sku}: agrega al menos un vehículo compatible (columnas vehiculo_marca/vehiculo_modelo).` });
      continue;
    }

    products.push({
      sku,
      name: head.nombre.trim(),
      partBrand: head.marcaRepuesto || null,
      categoryId,
      type: head.tipo || 'alternativo',
      availability: head.disponibilidad || 'en_stock',
      description: head.descripcion || null,
      internalLocation: head.ubicacionInterna || null,
      price: head.precio,
      stock: head.stock ?? 0,
      compatibility,
      rows: group.rows.map((r) => r.rowNumber),
    });
  }

  return { products, errors, totalRows };
}
