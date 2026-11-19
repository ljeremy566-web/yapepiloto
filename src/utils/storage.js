import { createDemoYapePayload } from './qrEngine.js';

export const STORAGE_KEY = 'yapepiloto_state_v1';

export function formatPhoneNumber(phone, showFull = false) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (showFull) {
    return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  }
  const lastThree = digits.slice(-3);
  return `••• ••• ${lastThree}`;
}

export function createDefaultState() {
  return {
    activeProfileId: 'driver-1',
    profiles: [
      {
        id: 'driver-1',
        label: 'Chofer Principal',
        name: 'Juan Pérez (Demo)',
        phone: '987654321',
        showFullPhone: false,
        routeNote: 'Colectivo • Tarifa rápida',
        qrPayload: createDemoYapePayload('JUAN PEREZ', 'LIMA'),
        fallbackImageDataUrl: null,
        isDemo: true,
      },
      {
        id: 'driver-2',
        label: 'Turno Noche / Relevo',
        name: '',
        phone: '',
        showFullPhone: false,
        routeNote: 'Turno Relevo',
        qrPayload: null,
        fallbackImageDataUrl: null,
        isDemo: false,
      },
    ],
    fares: ['1.50', '2.00', '3.00', '5.00'],
    autoCloseSeconds: 20,
    defaultViewMode: 'trigger',
    nightDimmer: false,
    voiceEnabled: false,
    ttsEnabled: true,
    mediaBridgeEnabled: false,
    swcBinding: {
      code: 'Space',
      label: 'Barra Espaciadora',
    },
    shiftStats: {
      count: 0,
      total: 0,
    },
  };
}

export function sanitizeState(raw) {
  const defaults = createDefaultState();
  if (!raw || typeof raw !== 'object') return defaults;

  const profiles = Array.isArray(raw.profiles) && raw.profiles.length > 0
    ? defaults.profiles.map((def, idx) => ({
        ...def,
        ...(raw.profiles[idx] || {}),
      }))
    : defaults.profiles;

  const fares = Array.isArray(raw.fares) && raw.fares.length > 0
    ? raw.fares.slice(0, 4).map((f) => {
        const parsed = parseFloat(String(f).replace(',', '.'));
        return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : '2.00';
      })
    : defaults.fares;

  return {
    ...defaults,
    ...raw,
    profiles,
    fares,
    swcBinding: {
      ...defaults.swcBinding,
      ...(raw.swcBinding || {}),
    },
    shiftStats: {
      count: Number(raw.shiftStats?.count) || 0,
      total: Number(raw.shiftStats?.total) || 0,
    },
  };
}

export function loadAppState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return sanitizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

export function saveAppState(state) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues
  }
}
