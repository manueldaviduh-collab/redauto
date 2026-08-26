// Pedidos de muestra para el panel de vendedor y "Mis pedidos" — el
// checkout real (con auth real de server/) es un paso posterior, ver
// docs/ROADMAP.md. authService ya NO usa este archivo: las cuentas se
// validan contra el backend real (js/services/authService.js).
export const demoOrders = [
  {
    id: 'ord-1001',
    userId: 'u1',
    date: '2026-08-05',
    status: 'Entregado',
    items: [
      { productId: 'p1', qty: 1, price: 45.0 },
      { productId: 'p6', qty: 2, price: 28.5 },
    ],
    shippingCity: 'Caracas',
  },
  {
    id: 'ord-1002',
    userId: 'u1',
    date: '2026-08-12',
    status: 'En camino',
    items: [{ productId: 'p10', qty: 1, price: 110.0 }],
    shippingCity: 'Caracas',
  },
  {
    id: 'ord-1003',
    userId: 'u3',
    date: '2026-08-14',
    status: 'Procesando',
    items: [{ productId: 'p2', qty: 2, price: 38.5 }],
    shippingCity: 'Caracas',
  },
  {
    id: 'ord-1004',
    userId: 'u4',
    date: '2026-08-16',
    status: 'Pendiente de pago',
    items: [
      { productId: 'p12', qty: 1, price: 62.0 },
      { productId: 'p22', qty: 1, price: 118.0 },
    ],
    shippingCity: 'Valencia',
  },
  {
    id: 'ord-1005',
    userId: 'u5',
    date: '2026-07-30',
    status: 'Cancelado',
    items: [{ productId: 'p18', qty: 1, price: 95.0 }],
    shippingCity: 'Valencia',
  },
];
