import { buildColumnIndex, cellText, cellNumber } from '../readTabularFile.js';

// Columnas obligatorias para reconocer un archivo como la plantilla
// oficial de RedAuto (ver server/src/services/productImportTemplate.js).
// No hace falta que estén todas las columnas — sólo estas cuatro alcanzan
// para "sí, esto es nuestra plantilla" (mismo criterio que usaba el
// parser original).
const REQUIRED_HEADERS = ['nombre', 'sku', 'categoria', 'precio'];

// Capa B para la fuente "plantilla RedAuto": traduce una hoja a filas
// canónicas (una por sku + vehículo compatible) en el vocabulario común
// que espera validateAndGroup.js. No valida reglas de negocio (categoría
// real, precio válido, etc.) — sólo lee columnas por nombre y las nombra.
export const redautoAdapter = {
  id: 'redauto',
  label: 'Plantilla oficial de RedAuto',

  matches(sheet) {
    const columnIndex = buildColumnIndex(sheet);
    const missing = REQUIRED_HEADERS.filter((h) => !(h in columnIndex));
    return { ok: missing.length === 0, missing };
  },

  parse(sheet) {
    const columnIndex = buildColumnIndex(sheet);
    const get = (row, key) => (columnIndex[key] ? row.getCell(columnIndex[key]) : null);

    const rawRows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // encabezado
      rawRows.push({
        rowNumber,
        sku: get(row, 'sku') ? cellText(get(row, 'sku')) : '',
        nombre: get(row, 'nombre') ? cellText(get(row, 'nombre')) : '',
        marcaRepuesto: get(row, 'marca_repuesto') ? cellText(get(row, 'marca_repuesto')) : '',
        categoria: get(row, 'categoria') ? cellText(get(row, 'categoria')) : '',
        precio: get(row, 'precio') ? cellNumber(get(row, 'precio')) : null,
        stock: get(row, 'stock') ? cellNumber(get(row, 'stock')) : null,
        tipo: get(row, 'tipo') ? cellText(get(row, 'tipo')).toLowerCase() : '',
        disponibilidad: get(row, 'disponibilidad') ? cellText(get(row, 'disponibilidad')).toLowerCase() : '',
        descripcion: get(row, 'descripcion') ? cellText(get(row, 'descripcion')) : '',
        ubicacionInterna: get(row, 'ubicacion_interna') ? cellText(get(row, 'ubicacion_interna')) : '',
        vehiculoMarca: get(row, 'vehiculo_marca') ? cellText(get(row, 'vehiculo_marca')) : '',
        vehiculoModelo: get(row, 'vehiculo_modelo') ? cellText(get(row, 'vehiculo_modelo')) : '',
        anioDesde: get(row, 'anio_desde') ? cellNumber(get(row, 'anio_desde')) : null,
        anioHasta: get(row, 'anio_hasta') ? cellNumber(get(row, 'anio_hasta')) : null,
        motor: get(row, 'motor') ? cellText(get(row, 'motor')) : '',
        version: get(row, 'version') ? cellText(get(row, 'version')) : '',
      });
    });
    return rawRows;
  },
};
