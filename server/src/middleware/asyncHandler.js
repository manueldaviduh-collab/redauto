// Express 4 no atrapa solo los rechazos de promesas de un handler async: si
// una ruta `async (req, res) => {...}` lanza (ej. un error real de Postgres),
// ese rechazo queda sin manejar y puede tumbar todo el proceso en vez de
// devolver un 500 normal — pasó en producción con /api/stores antes de que
// existieran las tablas. Este wrapper reenvía cualquier error a next(err),
// para que siempre lo resuelva el error handler de index.js.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
