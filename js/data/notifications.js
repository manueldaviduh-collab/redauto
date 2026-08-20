// Notificaciones de demostración. En producción vendrían de un servicio de
// notificaciones push/in-app (GET /api/notifications) filtrado por usuario;
// aquí es una fuente estática que notificationService enriquece con el
// estado de lectura persistido en localStorage.
export const notifications = [
  {
    id: 'n1', type: 'order',
    title: 'Tu pedido #ord-1002 va en camino',
    message: 'AutoPartes 24 despachó tu batería Bosch S6 60Ah. Llega en 2-5 días hábiles.',
    date: '2026-08-19T14:20:00',
  },
  {
    id: 'n2', type: 'offer',
    title: 'Nueva oferta en pastillas de freno',
    message: 'Pastillas de Freno Brembo P 83 045 con 13% de descuento por tiempo limitado.',
    date: '2026-08-19T09:00:00',
  },
  {
    id: 'n3', type: 'product',
    title: 'AutoPartes 24 agregó productos nuevos',
    message: 'Se publicaron 3 repuestos nuevos compatibles con Toyota Corolla.',
    date: '2026-08-18T11:45:00',
  },
  {
    id: 'n4', type: 'promo',
    title: 'Envío gratis esta semana',
    message: 'Compras mayores a $50 en tiendas de Caracas tienen envío gratis hasta el domingo.',
    date: '2026-08-17T08:00:00',
  },
  {
    id: 'n5', type: 'system',
    title: 'Bienvenido a RedAuto',
    message: 'Guarda tu vehículo en "Mis Vehículos" para ver compatibilidad automática en cada producto.',
    date: '2026-08-15T10:00:00',
  },
];
