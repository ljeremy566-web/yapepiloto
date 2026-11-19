import React, { useEffect, useMemo, useState } from 'react';
import PhoneSenderView from './components/PhoneSenderView.jsx';
import { createDemoYapePayload, decodeQrFromImageFile, renderCrispQrSvg } from './utils/qrEngine.js';
import {
  buildPairingUrl,
  generatePairSessionId,
  getPairSessionFromLocation,
  listenForPairedYape,
} from './utils/pairingChannel.js';
import { loadAppState, saveAppState } from './utils/storage.js';

export default function App() {
  const pairParam = useMemo(() => getPairSessionFromLocation(), []);

  // If opened on the driver's phone by scanning the car screen QR
  if (pairParam) {
    return <PhoneSenderView sessionId={pairParam} />;
  }

  return <CarScreenView />;
}

function CarScreenView() {
  const [state, setState] = useState(() => loadAppState());
  const [svgMarkup, setSvgMarkup] = useState('');
  const [pairSvgMarkup, setPairSvgMarkup] = useState('');
  const [sessionId, setSessionId] = useState(() => generatePairSessionId());
  const [pairingOpen, setPairingOpen] = useState(() => {
    const initial = loadAppState();
    const prof = initial.profiles.find((p) => p.id === initial.activeProfileId) || initial.profiles[0];
    return Boolean(prof?.isDemo || (!prof?.qrPayload && !prof?.fallbackImageDataUrl));
  });
  const [localUploadNote, setLocalUploadNote] = useState('');

  const profile =
    state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];

  const pairingUrl = useMemo(() => buildPairingUrl(sessionId), [sessionId]);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // Keep car screen awake
  useEffect(() => {
    let sentinel = null;
    const lock = async () => {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // Ignore if blocked
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') lock();
    };
    lock();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      sentinel?.release?.().catch(() => {});
    };
  }, []);

  // Render driver's Yape QR on pure white
  useEffect(() => {
    let cancelled = false;
    if (!profile.qrPayload) {
      setSvgMarkup('');
      return undefined;
    }
    renderCrispQrSvg(profile.qrPayload, {
      margin: 0,
      darkColor: '#111111',
      lightColor: '#FFFFFF',
    })
      .then((svg) => {
        if (!cancelled) setSvgMarkup(svg);
      })
      .catch(() => {
        if (!cancelled) setSvgMarkup('');
      });

    return () => {
      cancelled = true;
    };
  }, [profile.qrPayload]);

  // Render pairing QR when in pairing screen
  useEffect(() => {
    let cancelled = false;
    if (!pairingOpen) return undefined;

    renderCrispQrSvg(pairingUrl, {
      margin: 0,
      darkColor: '#111111',
      lightColor: '#FFFFFF',
    })
      .then((svg) => {
        if (!cancelled) setPairSvgMarkup(svg);
      })
      .catch(() => {
        if (!cancelled) setPairSvgMarkup('');
      });

    return () => {
      cancelled = true;
    };
  }, [pairingOpen, pairingUrl]);

  // Listen for incoming Yape sent from driver's phone
  useEffect(() => {
    if (!pairingOpen) return undefined;

    const stopListening = listenForPairedYape(sessionId, ({ name, qrPayload }) => {
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === prev.activeProfileId
            ? {
                ...p,
                name,
                qrPayload,
                fallbackImageDataUrl: null,
                isDemo: false,
              }
            : p
        ),
      }));
      setPairingOpen(false);
    });

    return stopListening;
  }, [pairingOpen, sessionId]);

  const openPairing = () => {
    setSessionId(generatePairSessionId());
    setLocalUploadNote('');
    setPairingOpen(true);
  };

  const handleLocalFallbackUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLocalUploadNote('Leyendo QR...');
    try {
      const result = await decodeQrFromImageFile(file);
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === prev.activeProfileId
            ? {
                ...p,
                qrPayload: result.payload,
                fallbackImageDataUrl: result.fallbackImageDataUrl,
                isDemo: false,
              }
            : p
        ),
      }));
      setPairingOpen(false);
    } catch {
      setLocalUploadNote('No se pudo leer esa imagen.');
    }
  };

  const handlePreviewDemo = () => {
    if (!profile.qrPayload) {
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === prev.activeProfileId
            ? {
                ...p,
                name: 'Juan Pérez',
                qrPayload: createDemoYapePayload('JUAN PEREZ', 'LIMA'),
              }
            : p
        ),
      }));
    }
    setPairingOpen(false);
  };

  if (pairingOpen) {
    return (
      <main className="minimal-canvas">
        <div className="qr-stage qr-stage-pair" aria-label="QR para vincular desde tu celular">
          {pairSvgMarkup && (
            <div
              style={{ width: '100%', height: '100%' }}
              dangerouslySetInnerHTML={{ __html: pairSvgMarkup }}
            />
          )}
        </div>

        <div className="pair-text-block">
          <h1 className="driver-name">Escanea con tu celular</h1>
          <p className="subtle-caption">
            Abre la cámara de tu celular para poner tu Yape en esta pantalla
          </p>
        </div>

        <div className="subtle-footer-links">
          <button type="button" className="text-action-btn" onClick={handlePreviewDemo}>
            {profile.isDemo ? 'Ver ejemplo' : 'Volver a mi Yape'}
          </button>
          <label className="text-action-btn" htmlFor="local-qr-upload">
            Subir aquí
          </label>
          <input
            id="local-qr-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleLocalFallbackUpload}
          />
        </div>
        {localUploadNote && <p className="edit-status">{localUploadNote}</p>}
      </main>
    );
  }

  return (
    <main className="minimal-canvas">
      <div className="qr-stage" aria-label="Código QR de Yape">
        {svgMarkup ? (
          <div
            style={{ width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : profile.fallbackImageDataUrl ? (
          <img src={profile.fallbackImageDataUrl} alt="QR de Yape" />
        ) : null}
      </div>

      <h1 className="driver-name" onDoubleClick={openPairing}>
        {profile.name ? profile.name.replace(' (Demo)', '') : 'Juan Pérez'}
      </h1>

      <button
        id="btn-pair-another"
        type="button"
        className="subtle-edit-btn"
        onClick={openPairing}
        aria-label="Cambiar Yape desde celular"
        title="Cambiar Yape desde celular"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      </button>
    </main>
  );
}
