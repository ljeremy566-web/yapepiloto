const TRIGGER_WORDS = [
  'yape',
  'yapear',
  'yapeo',
  'cobrar',
  'cobro',
  'codigo',
  'qr',
  'pasaje',
  'escanea',
  'escanear',
];

const DISMISS_WORDS = ['cerrar', 'cierra', 'ocultar', 'oculta', 'listo', 'quitar', 'quita'];

const NUMBER_WORDS = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  quince: 15,
  veinte: 20,
};

export function normalizeSpeechText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSpokenAmount(normalizedText) {
  // Numeric patterns like "5", "2.50", "2,50", "3 soles"
  const numericMatch = normalizedText.match(/\b(\d{1,2}(?:[.,]\d{1,2})?)\b/);
  if (numericMatch) {
    const value = parseFloat(numericMatch[1].replace(',', '.'));
    if (!Number.isNaN(value) && value > 0 && value <= 99) {
      return value.toFixed(2);
    }
  }

  // Word numbers like "tres soles", "dos cincuenta", "un sol cincuenta", "dos y medio"
  const tokens = normalizedText.split(' ');
  for (let i = 0; i < tokens.length; i += 1) {
    const base = NUMBER_WORDS[tokens[i]];
    if (base !== undefined) {
      let total = base;
      const next = tokens[i + 1];
      const nextTwo = tokens[i + 2];
      if (next === 'cincuenta' || next === 'medio' || next === 'media') {
        total += 0.5;
      } else if ((next === 'sol' || next === 'soles' || next === 'y') && (nextTwo === 'cincuenta' || nextTwo === 'medio' || nextTwo === 'media')) {
        total += 0.5;
      }
      return total.toFixed(2);
    }
  }

  if (normalizedText.includes('china')) {
    return '0.50';
  }

  return null;
}

export function parseVoiceCommand(transcript) {
  const normalized = normalizeSpeechText(transcript);
  if (!normalized) {
    return { action: null, amount: null, raw: '' };
  }

  const words = normalized.split(' ');
  const isDismiss = DISMISS_WORDS.some((word) => words.includes(word));
  if (isDismiss) {
    return { action: 'close', amount: null, raw: normalized };
  }

  const isTrigger = TRIGGER_WORDS.some((word) => words.includes(word) || normalized.includes(word));
  if (isTrigger) {
    return {
      action: 'open',
      amount: extractSpokenAmount(normalized),
      raw: normalized,
    };
  }

  return { action: null, amount: null, raw: normalized };
}

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function speakShortFeedback(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-PE';
    utterance.rate = 1.08;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on restricted head units
  }
}

export function createVoiceController({ onOpen, onClose, onTranscript, onStatusChange }) {
  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  if (!SpeechRecognitionCtor) {
    onStatusChange?.({ supported: false, listening: false, error: 'Tu navegador no soporta voz' });
    return {
      start: () => {},
      stop: () => {},
      destroy: () => {},
    };
  }

  let active = false;
  let recognition = null;
  let lastTriggerAt = 0;
  let restartTimer = null;

  const initRecognition = () => {
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'es-PE';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      onStatusChange?.({ supported: true, listening: true, error: null });
    };

    rec.onresult = (event) => {
      const latest = event.results[event.results.length - 1];
      if (!latest) return;
      const transcript = latest[0]?.transcript || '';
      onTranscript?.(transcript);

      const parsed = parseVoiceCommand(transcript);
      const now = Date.now();
      if (parsed.action && now - lastTriggerAt > 2200) {
        lastTriggerAt = now;
        if (parsed.action === 'open') {
          onOpen?.(parsed.amount);
        } else if (parsed.action === 'close') {
          onClose?.();
        }
      }
    };

    rec.onerror = (event) => {
      const fatal = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      if (fatal) {
        active = false;
        onStatusChange?.({
          supported: true,
          listening: false,
          error: 'Permiso de micrófono denegado',
        });
      } else if (event.error === 'network') {
        onStatusChange?.({
          supported: true,
          listening: false,
          error: 'Voz sin conexión disponible en este navegador',
        });
      }
    };

    rec.onend = () => {
      onStatusChange?.({ supported: true, listening: false, error: null });
      if (active) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          if (active) {
            try {
              rec.start();
            } catch {
              // Ignore rapid restart race
            }
          }
        }, 450);
      }
    };

    return rec;
  };

  return {
    start() {
      if (active) return;
      active = true;
      if (!recognition) {
        recognition = initRecognition();
      }
      try {
        recognition.start();
      } catch {
        // Already started
      }
    },
    stop() {
      active = false;
      clearTimeout(restartTimer);
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // Ignore stop errors
        }
      }
      onStatusChange?.({ supported: true, listening: false, error: null });
    },
    destroy() {
      this.stop();
      recognition = null;
    },
  };
}
