/**
 * pedido.js
 * Lógica del carrito de compras, conteo de productos y envío a WhatsApp.
 */

let pedido = {};

export function obtenerCantidad(codigo) {
  return pedido[codigo] || 0;
}

function obtenerCombo(codigo, combos) {
  return combos.find((combo, index) => `COMBO-${index}` === codigo);
}

export function cambiarCantidad(codigo, delta, productosGlobal, actualizarCallback, combos = []) {
  if (!pedido[codigo]) pedido[codigo] = 0;
  pedido[codigo] += delta;
  if (pedido[codigo] < 0) pedido[codigo] = 0;
  if (pedido[codigo] === 0) delete pedido[codigo];

  const qtySpan = document.getElementById(`qty-${codigo}`);
  if (qtySpan) qtySpan.textContent = pedido[codigo] || 0;

  if (typeof actualizarCallback === 'function') {
    actualizarCallback(pedido, productosGlobal, combos);
  }
}

export function limpiarPedido(productosGlobal, actualizarCallback, combos = []) {
  pedido = {};
  [...productosGlobal, ...combos.map((combo, index) => ({ codigo: `COMBO-${index}` }))].forEach(p => {
    const span = document.getElementById(`qty-${p.codigo}`);
    if (span) span.textContent = '0';
  });
  if (typeof actualizarCallback === 'function') {
    actualizarCallback(pedido, productosGlobal, combos);
  }
}

function precioNumerico(precio) {
  if (precio === null || precio === undefined || String(precio).trim() === '') return null;
  const limpio = String(precio || '0').replace('$', '').replace(/\./g, '').replace(',', '.');
  const numero = Number.parseFloat(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function precioCombo(combo, productosGlobal) {
  if (!Array.isArray(combo.articulos) || combo.articulos.length === 0) {
    throw new Error(`El combo "${combo.titulo}" debe incluir al menos un código de producto.`);
  }
  const totalEnCentavos = combo.articulos.reduce((suma, codigo) => {
    const producto = productosGlobal.find(item => item.codigo === codigo);
    if (!producto || !producto['precio combo']) {
      throw new Error(`No se puede calcular el combo "${combo.titulo}": falta el producto ${codigo} o su precio combo.`);
    }
    const precio = precioNumerico(producto['precio combo']);
    if (!Number.isFinite(precio) || precio < 0) {
      throw new Error(`El precio venta del producto ${codigo} no es válido.`);
    }
    return suma + Math.round(precio * 100);
  }, 0);
  return Math.ceil(totalEnCentavos / 100);
}

export function calcularTotales(productosGlobal, combos = []) {
  let totalItems = 0;
  let precioTotalCalculado = 0;
  let hayPrecioPendiente = false;

  for (const [codigo, cantidad] of Object.entries(pedido)) {
    totalItems += cantidad;
    const prod = productosGlobal.find(p => p.codigo === codigo);
    const combo = obtenerCombo(codigo, combos);
    if (prod) {
      const precio = precioNumerico(prod['venta por menor']);
      if (precio === null) hayPrecioPendiente = true;
      else precioTotalCalculado += precio * cantidad;
    } else if (combo) {
      precioTotalCalculado += precioCombo(combo, productosGlobal) * cantidad;
    }
  }

  return { totalItems, precioTotalCalculado, hayPrecioPendiente };
}

function dibujarPedidoJpg(lineas, total) {
  const altoLinea = 34;
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = Math.max(400, 220 + lineas.length * altoLinea);

  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('No se pudo generar la imagen del pedido.');
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.fillStyle = '#312e81';
  contexto.fillRect(0, 0, canvas.width, 112);
  contexto.fillStyle = '#ffffff';
  contexto.font = 'bold 40px Arial';
  contexto.fillText('PEDIDO - CATALOGO RL', 40, 68);
  contexto.fillStyle = '#1f2937';
  contexto.font = 'bold 23px Arial';
  contexto.fillText('ARTICULO', 40, 160);
  contexto.fillText('CANT.', 690, 160);
  contexto.fillText('SUBTOTAL', 800, 160);

  contexto.font = '20px Arial';
  let y = 200;
  for (const linea of lineas) {
    contexto.fillStyle = '#f3f4f6';
    contexto.fillRect(30, y - 25, 940, 32);
    contexto.fillStyle = '#111827';
    contexto.fillText(linea.nombre.slice(0, 46), 40, y);
    contexto.fillText(String(linea.cantidad), 700, y);
    contexto.fillText(linea.subtotal === null ? 'Consultar' : formatearPrecio(linea.subtotal), 800, y);
    y += altoLinea;
  }

  contexto.fillStyle = '#312e81';
  contexto.font = 'bold 28px Arial';
  contexto.fillText(`TOTAL: ${formatearPrecio(total)}`, 650, y + 20);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo crear el archivo JPG del pedido.'));
    }, 'image/jpeg', 0.92);
  });
}

function formatearPrecio(precio) {
  return '$' + precio.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export async function enviarWhatsApp(productosGlobal, numeroWhatsApp, combos = []) {
  if (Object.keys(pedido).length === 0) return;

  const lineas = [];
  let precioTotalCalculado = 0;

  for (const [codigo, cantidad] of Object.entries(pedido)) {
    const prod = productosGlobal.find(p => p.codigo === codigo);
    const combo = obtenerCombo(codigo, combos);
    if (prod) {
      const precio = precioNumerico(prod['venta por menor']);
      const subtotal = precio === null ? null : precio * cantidad;
      lineas.push({ nombre: `${prod.articulo} (${prod.codigo})`, cantidad, subtotal });
      if (subtotal !== null) precioTotalCalculado += subtotal;
    } else if (combo) {
      const subtotal = precioCombo(combo, productosGlobal) * cantidad;
      lineas.push({
        nombre: `Combo: ${combo.titulo} [${combo.articulos.join(', ')}]`,
        cantidad,
        subtotal
      });
      precioTotalCalculado += subtotal;
    }
  }

  const mensaje = [
    'Hola, quiero realizar este pedido:',
    ...lineas.map(linea => `${linea.nombre} x ${linea.cantidad} - ${typeof linea.subtotal === 'number' ? formatearPrecio(linea.subtotal) : 'Consultar precio'}`),
    `Total estimado: ${formatearPrecio(precioTotalCalculado)}`,
    ...(lineas.some(linea => linea.subtotal === null) ? ['Hay productos cuyo precio está pendiente de confirmar.'] : []),
    'Adjunto la imagen del pedido.'
  ].join('\n');
  const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
  const ventana = window.open(url, '_blank');
  if (!ventana) window.location.href = url;

  const imagen = await dibujarPedidoJpg(lineas, precioTotalCalculado);
  const enlaceImagen = URL.createObjectURL(imagen);
  const descarga = document.createElement('a');
  descarga.href = enlaceImagen;
  descarga.download = 'pedido-catalogo-rl.jpg';
  descarga.click();
  window.setTimeout(() => URL.revokeObjectURL(enlaceImagen), 1000);
}