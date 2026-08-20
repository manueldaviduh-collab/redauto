// Pool de reseñas de muestra. No hay sistema de reseñas de usuarios en el
// MVP (eso requeriría cuentas verificando compra); esto ilustra cómo se
// vería `rating`/`reviewsCount` con comentarios reales una vez exista ese
// backend (POST /api/products/:id/reviews).
const REVIEW_POOL = [
  { author: 'Carlos M.', comment: 'Llegó rápido y era justo lo que necesitaba para mi carro. Buen precio.' },
  { author: 'Yorman R.', comment: 'Excelente calidad, se nota que no es genérico. Lo volvería a comprar.' },
  { author: 'Andreína P.', comment: 'La tienda respondió rápido por WhatsApp y coordinamos la entrega sin problema.' },
  { author: 'Luis F.', comment: 'Cumple con lo que promete la ficha. Empaque en buen estado al recibirlo.' },
  { author: 'Génesis T.', comment: 'Se ajustó perfecto a mi vehículo, tal como decía la compatibilidad.' },
  { author: 'Miguel A.', comment: 'Buena atención de la tienda, resolvieron mis dudas antes de comprar.' },
  { author: 'Rosa D.', comment: 'Precio justo comparado con otras tiendas físicas. Repetiría la compra.' },
  { author: 'Jhonny C.', comment: 'Tardó un poco más de lo esperado pero el producto llegó completo.' },
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Deriva 2-3 reseñas de muestra de forma determinista por producto (mismo
// producto siempre muestra las mismas reseñas, sin necesidad de guardarlas).
export function sampleReviewsFor(product) {
  if (!product.reviewsCount) return [];
  const seed = hashString(product.id);
  const count = 2 + (seed % 2);
  return Array.from({ length: count }, (_, i) => {
    const entry = REVIEW_POOL[(seed + i * 7) % REVIEW_POOL.length];
    const ratingJitter = [0, 0, 0, -1, 1][(seed + i) % 5];
    const rating = Math.min(5, Math.max(3, Math.round(product.rating) + ratingJitter));
    const daysAgo = 3 + ((seed + i * 5) % 40);
    return { ...entry, rating, daysAgo };
  });
}
