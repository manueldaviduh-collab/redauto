const VALID_TYPES = ['original', 'alternativo'];
const VALID_AVAILABILITY = ['en_stock', 'bajo_pedido', 'agotado'];

// Capa C de la importación: toma filas canónicas YA traducidas por un
// adaptador de fuente (ver ./adapters — cada una es "una fila por sku +
// vehículo compatible", el mismo formato interno de siempre) y aplica las
// reglas de negocio de RedAuto: agrupar por SKU (un producto puede ocupar
// varias filas, una por vehículo compatible), validar cada campo, y armar
// la lista de compatibilidad.
//
// Esta función no sabe ni le importa de qué archivo/fuente vinieron las
// filas — es exactamente la misma sin importar si el adaptador fue el de
// RedAuto, A2, Saint, etc. Extraída tal cual (mismo orden de validaciones,
// mismos mensajes) del parser original para no cambiar ningún resultado.
export function validateAndGroup(rawRows, categories) {
  const categoryByKey = new Map();
  categories.forEach((c) => {
    categoryByKey.set(c.id.toLowerCase(), c.id);
    categoryByKey.set(c.name.toLowerCase(), c.id);
  });

  const groups = new Map(); // sku -> { firstRow, rows: [...] }
  const errors = [];
  let totalRows = 0;

  for (const r of rawRows) {
    // Fila completamente vacía (algunas fuentes dejan filas fantasma al final).
    if (!r.sku && !r.nombre && !r.vehiculoMarca && !r.vehiculoModelo) continue;

    totalRows += 1;
    if (!r.sku) {
      errors.push({ row: r.rowNumber, message: 'Falta el SKU — es obligatorio en cada fila para agrupar el producto.' });
      continue;
    }
    if (!groups.has(r.sku)) groups.set(r.sku, { firstRow: r.rowNumber, rows: [] });
    groups.get(r.sku).rows.push(r);
  }

  const products = [];
  for (const [sku, group] of groups) {
    const head = group.rows.find((row) => row.nombre) || group.rows[0];
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
      .filter((row) => row.vehiculoMarca && row.vehiculoModelo)
      .map((row) => ({
        brand: row.vehiculoMarca,
        model: row.vehiculoModelo,
        yearFrom: row.anioDesde && !Number.isNaN(row.anioDesde) ? row.anioDesde : undefined,
        yearTo: row.anioHasta && !Number.isNaN(row.anioHasta) ? row.anioHasta : undefined,
        engine: row.motor || undefined,
        trim: row.version || undefined,
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
      rows: group.rows.map((row) => row.rowNumber),
    });
  }

  return { products, errors, totalRows };
}
