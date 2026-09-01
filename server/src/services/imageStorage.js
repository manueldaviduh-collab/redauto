import { v2 as cloudinary } from 'cloudinary';

// Proveedor de almacenamiento de imágenes real (ver docs/BASE_DE_DATOS.md
// §4.1 y docs/ARQUITECTURA.md §9). Si las credenciales no están puestas en
// el entorno, el resto de la API sigue funcionando normal — sólo los
// endpoints de fotos (server/src/routes/products.js) responden 503 en vez
// de crashear el servidor al arrancar.
const configured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function isImageStorageConfigured() {
  return configured;
}

// Sube un buffer en memoria (nunca se escribe a disco, mismo criterio que
// la importación por Excel) y devuelve la URL pública real + el id que
// Cloudinary necesita para poder borrarla después.
export function uploadImageBuffer(buffer, { folder } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// Borrar del lado de Cloudinary es best-effort: si falla, la fila igual se
// borra de product_images (nunca dejamos una foto "atascada" en la base por
// un error transitorio del proveedor).
export function deleteImage(publicId) {
  if (!publicId) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId);
}
