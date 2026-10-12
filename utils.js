/**
 * utils.js
 * Propósito: Contiene funciones de utilidad para el catálogo.
 */

// Usamos 'export' para que esta función pueda ser usada en index.html.

/**
 * Nombre de la función: getImagePath
 * Propósito: Genera automáticamente la ruta completa del archivo de imagen.
 * * @param {string} codigo El código único del artículo (ejemplo: "200").
 * @returns {string} La ruta completa que el navegador usará (ejemplo: "/imagenes/200.jpg").
 */
export function getImagePath(codigo) {
  // 1. Ruta Base: La carpeta donde están todas las fotos.
  const BASE_PATH = "/imagenes/";

  // 2. Extensión de archivo (asumimos que todas son .jpg).
  const EXTENSION = ".jpg";

  // 3. Devuelve la ruta final: /imagenes/ + código + .jpg
  return `${BASE_PATH}${codigo}${EXTENSION}`;
}

// Opcionalmente, puedes exportar otras constantes si son útiles, 
// como la ruta de la imagen por defecto.
export const FALLBACK_IMAGE_PATH = '/imagenes/default.jpg';