import jsQR from 'jsqr';
import QRCode from 'qrcode';

function computeCrc16Ccitt(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i += 1) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function createDemoYapePayload(holderName = 'JUAN PEREZ', city = 'LIMA') {
  const cleanName = String(holderName || 'CONDUCTOR')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, 22) || 'CONDUCTOR';
  const cleanCity = String(city || 'LIMA')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, 15) || 'LIMA';

  const merchantField = `0011com.yape.pe0116YAPEPILOTO-DEMO1`;
  const merchantTag = `39${String(merchantField.length).padStart(2, '0')}${merchantField}`;
  const nameTag = `59${String(cleanName.length).padStart(2, '0')}${cleanName}`;
  const cityTag = `60${String(cleanCity.length).padStart(2, '0')}${cleanCity}`;

  const body = `000201010211${merchantTag}5204412153036045802PE${nameTag}${cityTag}6304`;
  return `${body}${computeCrc16Ccitt(body)}`;
}

export async function renderCrispQrSvg(payload, options = {}) {
  if (!payload || typeof payload !== 'string') {
    throw new Error('Payload QR inválido');
  }

  return QRCode.toString(payload, {
    type: 'svg',
    margin: options.margin ?? 2,
    errorCorrectionLevel: options.errorCorrectionLevel ?? 'M',
    color: {
      dark: options.darkColor ?? '#111111',
      light: options.lightColor ?? '#FFFFFF',
    },
  });
}

function tryDecodeImageData(imageData) {
  return jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
}

function buildBinarizedImageData(src, threshold) {
  const copy = new Uint8ClampedArray(src.data);
  for (let i = 0; i < copy.length; i += 4) {
    const lum = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
    const bw = lum > threshold ? 255 : 0;
    copy[i] = bw;
    copy[i + 1] = bw;
    copy[i + 2] = bw;
    copy[i + 3] = 255;
  }
  return new ImageData(copy, src.width, src.height);
}

function decodeRegion(img, sx, sy, sw, sh, maxDim = 1200) {
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

  const raw = ctx.getImageData(0, 0, width, height);
  let decoded = tryDecodeImageData(raw);
  if (decoded) return decoded;

  for (const threshold of [135, 165, 105]) {
    decoded = tryDecodeImageData(buildBinarizedImageData(raw, threshold));
    if (decoded) return decoded;
  }

  return null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagen inválida o dañada'));
    img.src = src;
  });
}

export async function decodeQrFromImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Multi-pass strategy tailored for tall Yape screenshots (QR sits inside center card)
  const passes = [
    [0, 0, w, h, 1400],
    [w * 0.1, h * 0.15, w * 0.8, h * 0.65, 1200],
    [w * 0.15, h * 0.2, w * 0.7, h * 0.55, 1400],
    [0, 0, w, h, 2000],
  ];

  let decoded = null;
  for (const [sx, sy, sw, sh, maxDim] of passes) {
    decoded = decodeRegion(img, sx, sy, sw, sh, maxDim);
    if (decoded?.data) break;
  }

  const previewMax = 680;
  const previewScale = Math.min(1, previewMax / Math.max(w, h));
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = Math.max(1, Math.round(w * previewScale));
  previewCanvas.height = Math.max(1, Math.round(h * previewScale));
  const previewCtx = previewCanvas.getContext('2d');
  previewCtx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
  const fallbackImageDataUrl = previewCanvas.toDataURL('image/jpeg', 0.86);

  return {
    payload: decoded?.data ?? null,
    fallbackImageDataUrl,
    decodedOk: Boolean(decoded?.data),
  };
}
