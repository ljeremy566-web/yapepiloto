// Minimal silent WAV data URI for activating MediaSession on Android head units
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function matchesSwcBinding(eventLike, binding) {
  if (!eventLike || !binding || !binding.code) return false;
  if (eventLike.repeat) return false;

  const targetCode = String(binding.code).toLowerCase();
  const eventCode = String(eventLike.code || '').toLowerCase();
  const eventKey = String(eventLike.key || '').toLowerCase();

  return eventCode === targetCode || eventKey === targetCode;
}

export function formatKeyLabel(eventLike) {
  const code = eventLike?.code || eventLike?.key || 'Tecla';
  const map = {
    Space: 'Barra Espaciadora',
    Enter: 'Enter / OK',
    MediaTrackNext: 'Volante: Siguiente (Next)',
    MediaTrackPrevious: 'Volante: Anterior (Prev)',
    MediaPlayPause: 'Volante: Play / Pausa',
    AudioVolumeUp: 'Volante: Subir Volumen',
    AudioVolumeDown: 'Volante: Bajar Volumen',
    ArrowRight: 'Flecha Derecha',
    ArrowLeft: 'Flecha Izquierda',
  };
  return map[code] || code;
}

export function createSwcController({ getBinding, isLearning, onLearn, onTrigger }) {
  const handleKeyDown = (event) => {
    const activeTag = document.activeElement?.tagName;
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

    if (isLearning()) {
      event.preventDefault();
      event.stopPropagation();
      const code = event.code || event.key;
      if (code && code !== 'Escape') {
        onLearn?.({
          code,
          label: formatKeyLabel(event),
        });
      }
      return;
    }

    if (isTyping) return;

    const binding = getBinding();
    if (matchesSwcBinding(event, binding)) {
      event.preventDefault();
      onTrigger?.('keyboard');
    }
  };

  window.addEventListener('keydown', handleKeyDown, { passive: false });

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

export function setupMediaSessionBridge(onAction) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return { enable: async () => false, disable: () => {} };
  }

  let audioEl = null;

  const enable = async () => {
    try {
      if (!audioEl) {
        audioEl = new Audio(SILENT_WAV_DATA_URI);
        audioEl.loop = true;
        audioEl.volume = 0.01;
      }
      await audioEl.play();

      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'YapePiloto Listo',
        artist: 'Pulsa Siguiente para mostrar QR',
        album: 'Modo Colectivo',
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => onAction?.('nexttrack'));
      navigator.mediaSession.setActionHandler('previoustrack', () => onAction?.('previoustrack'));
      return true;
    } catch {
      return false;
    }
  };

  const disable = () => {
    if (audioEl) {
      audioEl.pause();
    }
    try {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
    } catch {
      // Ignore cleanup errors
    }
  };

  return { enable, disable };
}
