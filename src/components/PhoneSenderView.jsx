import React, { useEffect, useState } from 'react';
import { decodeQrFromImageFile, renderCrispQrSvg } from '../utils/qrEngine.js';
import { sendPairedYape } from '../utils/pairingChannel.js';

export default function PhoneSenderView({ sessionId }) {
  const [name, setName] = useState('');
  const [qrPayload, setQrPayload] = useState(null);
  const [previewSvg, setPreviewSvg] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!qrPayload) {
      setPreviewSvg('');
      return undefined;
    }
    renderCrispQrSvg(qrPayload, {
      margin: 0,
      darkColor: '#111111',
      lightColor: '#FFFFFF',
    })
      .then((svg) => {
        if (!cancelled) setPreviewSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setPreviewSvg('');
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('Leyendo tu QR de Yape...');
    setSentOk(false);

    try {
      const result = await decodeQrFromImageFile(file);
      if (result.decodedOk && result.payload) {
        setQrPayload(result.payload);
        setStatus('QR listo para enviar.');
      } else {
        setQrPayload(null);
        setStatus('No pudimos leer el QR. Sube la captura directa desde tu app Yape.');
      }
    } catch {
      setQrPayload(null);
      setStatus('No se pudo procesar la imagen.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!qrPayload) {
      setStatus('Primero sube la captura de tu QR de Yape.');
      return;
    }

    setSending(true);
    setStatus('Enviando a la pantalla del carro...');
    try {
      await sendPairedYape(sessionId, {
        name: name.trim() || 'Chofer',
        qrPayload,
      });
      setSentOk(true);
      setStatus('');
    } catch {
      setStatus('Error de conexión. Verifica tus datos e intenta otra vez.');
    } finally {
      setSending(false);
    }
  };

  if (sentOk) {
    return (
      <main className="minimal-canvas">
        <div className="phone-done">
          <div className="done-check" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="driver-name">Listo</h1>
          <p className="subtle-caption">Tu Yape ya apareció en la pantalla del carro.</p>
          <button
            type="button"
            className="btn-cancel"
            onClick={() => setSentOk(false)}
          >
            Enviar otro Yape
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="minimal-canvas">
      <form className="edit-sheet" onSubmit={handleSubmit}>
        <h1 className="edit-heading">Pon tu Yape en el carro</h1>
        <p className="subtle-caption" style={{ textAlign: 'left', marginTop: -8 }}>
          Sube la captura de tu QR desde este celular y aparecerá al instante en la pantalla.
        </p>

        <div className="edit-field">
          <label className="edit-label" htmlFor="phone-driver-name">
            Tu nombre
          </label>
          <input
            id="phone-driver-name"
            type="text"
            className="edit-input"
            placeholder="Ej. Carlos Mendoza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="edit-field">
          <span className="edit-label">Captura de tu QR de Yape</span>
          <label className="edit-upload-btn" htmlFor="phone-qr-upload">
            {qrPayload ? 'Cambiar captura de Yape' : 'Elegir captura de Yape'}
          </label>
          <input
            id="phone-qr-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {previewSvg && (
          <div className="phone-qr-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} />
        )}

        {status && <p className="edit-status">{status}</p>}

        <button
          id="btn-send-to-car"
          type="submit"
          className="btn-save"
          disabled={sending || !qrPayload}
          style={{ opacity: sending || !qrPayload ? 0.45 : 1 }}
        >
          {sending ? 'Enviando...' : 'Enviar al carro'}
        </button>
      </form>
    </main>
  );
}
