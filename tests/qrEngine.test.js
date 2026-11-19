import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { createDemoYapePayload, renderCrispQrSvg } from '../src/utils/qrEngine.js';

test('createDemoYapePayload genera payload EMVCo válido para Perú (PEN 604)', () => {
  const payload = createDemoYapePayload('Carlos Mendoza', 'Lima');
  assert.ok(payload.startsWith('000201010211'));
  assert.ok(payload.includes('5303604'));
  assert.ok(payload.includes('5802PE'));
  assert.ok(payload.includes('CARLOS MENDOZA'));
  assert.match(payload, /6304[0-9A-F]{4}$/);
});

test('renderCrispQrSvg genera un SVG vectorial válido y limpio', async () => {
  const payload = createDemoYapePayload('Juan Perez', 'Lima');
  const svg = await renderCrispQrSvg(payload);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('<path'));
});

test('round-trip: QR generado puede ser decodificado exactamente por jsQR', () => {
  const payload = createDemoYapePayload('Colectivo Ruta A', 'Arequipa');
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const scale = 6;
  const margin = 4;
  const dim = (size + margin * 2) * scale;
  const rgba = new Uint8ClampedArray(dim * dim * 4);

  // Fill white background
  rgba.fill(255);

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (qr.modules.get(r, c)) {
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const y = (r + margin) * scale + dy;
            const x = (c + margin) * scale + dx;
            const idx = (y * dim + x) * 4;
            rgba[idx] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            rgba[idx + 3] = 255;
          }
        }
      }
    }
  }

  const decoded = jsQR(rgba, dim, dim);
  assert.ok(decoded, 'jsQR debe decodificar el QR generado');
  assert.equal(decoded.data, payload);
});
