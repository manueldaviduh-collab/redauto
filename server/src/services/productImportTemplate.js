import ExcelJS from 'exceljs';

const COLUMNS = [
  { header: 'nombre', width: 32, note: 'Nombre del producto. Obligatorio.' },
  { header: 'sku', width: 16, note: 'Código único del producto en tu tienda. Obligatorio — agrupa las filas de un mismo producto con varios vehículos compatibles.' },
  { header: 'marca_repuesto', width: 18, note: 'Marca del repuesto (ej. Bosch, Brembo). Opcional.' },
  { header: 'categoria', width: 20, note: 'Debe ser una de: Motor, Frenos, Suspensión, Baterías, Aceites y Lubricantes, Filtros, Iluminación, Cauchos.' },
  { header: 'precio', width: 12, note: 'Precio en USD. Obligatorio, ej. 39.90.' },
  { header: 'stock', width: 10, note: 'Existencias disponibles. Opcional, por defecto 0.' },
  { header: 'tipo', width: 14, note: 'original o alternativo. Opcional, por defecto alternativo.' },
  { header: 'disponibilidad', width: 16, note: 'en_stock, bajo_pedido o agotado. Opcional, por defecto en_stock.' },
  { header: 'descripcion', width: 40, note: 'Descripción del producto. Opcional.' },
  { header: 'ubicacion_interna', width: 20, note: 'Ubicación en tu almacén (pasillo, estante). Opcional, solo la ves tú.' },
  { header: 'vehiculo_marca', width: 18, note: 'Marca del vehículo compatible (ej. Toyota). Obligatorio — cada producto necesita al menos un vehículo.' },
  { header: 'vehiculo_modelo', width: 18, note: 'Modelo del vehículo compatible (ej. Corolla). Obligatorio.' },
  { header: 'anio_desde', width: 12, note: 'Año desde el que aplica (ej. 2009). Opcional.' },
  { header: 'anio_hasta', width: 12, note: 'Año hasta el que aplica (ej. 2013). Opcional.' },
  { header: 'motor', width: 14, note: 'Motor específico (ej. 1.8L). Opcional.' },
  { header: 'version', width: 14, note: 'Versión o trim (ej. LE, Sport). Opcional.' },
];

// Genera la plantilla oficial en memoria (sin tocar disco — Railway no
// garantiza almacenamiento persistente entre despliegues). Deliberadamente
// SIN filas de ejemplo en la hoja de datos: sería fácil subir la plantilla
// sin darse cuenta y crear productos ficticios (ver docs/PRINCIPIOS.md §4,
// Transparencia). Los ejemplos van solo como texto en "Instrucciones".
export async function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RedAuto';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Productos');
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.header, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53935' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const instructions = workbook.addWorksheet('Instrucciones');
  instructions.columns = [
    { header: 'Columna', key: 'col', width: 20 },
    { header: 'Qué va ahí', key: 'note', width: 90 },
  ];
  instructions.getRow(1).font = { bold: true };
  instructions.addRows(COLUMNS.map((c) => ({ col: c.header, note: c.note })));
  instructions.addRow({});
  instructions.addRow({ col: 'Varios vehículos', note: 'Si un producto sirve para más de un vehículo, repite la fila con el mismo SKU y los mismos datos del producto, cambiando solo vehiculo_marca/vehiculo_modelo/anio_desde/anio_hasta/motor/version de cada fila.' });
  instructions.addRow({ col: 'Re-importar', note: 'Puedes volver a subir el mismo archivo corregido: los productos con el mismo SKU se actualizan (precio, stock, etc.) en vez de duplicarse.' });
  instructions.getRow(instructions.rowCount - 2).font = { italic: true };
  instructions.getRow(instructions.rowCount - 1).font = { italic: true };
  instructions.getRow(instructions.rowCount).font = { italic: true };

  return workbook.xlsx.writeBuffer();
}
