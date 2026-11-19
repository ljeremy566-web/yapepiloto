const RELAY_BASE = 'https://ntfy.sh';
const BROADCAST_PREFIX = 'yapepiloto_pair_';

export function generatePairSessionId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i += 1) {
      token += alphabet[bytes[i] % alphabet.length];
    }
  } else {
    for (let i = 0; i < 12; i += 1) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return token;
}

export function buildPairingUrl(sessionId, currentLocation = null) {
  const loc = currentLocation || (typeof window !== 'undefined' ? window.location : null);
  if (!loc) return `?pair=${encodeURIComponent(sessionId)}`;
  const url = new URL(loc.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('pair', sessionId);
  return url.toString();
}

export function getPairSessionFromLocation(currentLocation = null) {
  const loc = currentLocation || (typeof window !== 'undefined' ? window.location : null);
  if (!loc) return null;
  try {
    const params = new URLSearchParams(loc.search);
    const pair = params.get('pair');
    return pair && /^[A-Za-z0-9_-]{6,32}$/.test(pair) ? pair : null;
  } catch {
    return null;
  }
}

export function buildDirectSyncPayload(name, qrPayload) {
  return JSON.stringify({
    v: 1,
    name: String(name || '').trim().slice(0, 40),
    qrPayload: String(qrPayload || '').trim(),
    sentAt: Date.now(),
  });
}

export function parseIncomingPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  try {
    const data = JSON.parse(rawText);
    if (!data || typeof data !== 'object') return null;
    if (!data.qrPayload || typeof data.qrPayload !== 'string') return null;
    return {
      name: String(data.name || '').trim().slice(0, 40) || 'Chofer',
      qrPayload: data.qrPayload.trim(),
    };
  } catch {
    return null;
  }
}

function topicForSession(sessionId) {
  return `yapepiloto-v1-${sessionId.toLowerCase()}`;
}

export function listenForPairedYape(sessionId, onReceive, onError) {
  const cleanups = [];
  let delivered = false;
  let stopped = false;

  const deliver = (parsed) => {
    if (delivered || !parsed) return;
    delivered = true;
    onReceive?.(parsed);
  };

  // 1. Same-browser instant sync
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(`${BROADCAST_PREFIX}${sessionId}`);
      bc.onmessage = (event) => {
        const parsed = parseIncomingPayload(
          typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
        );
        deliver(parsed);
      };
      cleanups.push(() => bc.close());
    } catch {
      // Ignore if BroadcastChannel is unavailable
    }
  }

  const topic = topicForSession(sessionId);

  // 2. Real-time HTTPS SSE stream (works through 4G/5G CGNAT)
  if (typeof EventSource !== 'undefined') {
    try {
      const sse = new EventSource(`${RELAY_BASE}/${topic}/sse?since=2m`);
      sse.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (envelope?.event === 'message' && envelope?.message) {
            deliver(parseIncomingPayload(envelope.message));
          }
        } catch {
          // Ignore keepalive frames
        }
      };
      sse.onerror = () => {
        onError?.('Esperando conexión...');
      };
      cleanups.push(() => sse.close());
    } catch {
      // Fall through to polling
    }
  }

  // 3. Polling fallback for older Android car head unit WebViews
  if (typeof fetch !== 'undefined') {
    const poll = async () => {
      if (stopped || delivered) return;
      try {
        const res = await fetch(`${RELAY_BASE}/${topic}/json?poll=1&since=2m`);
        if (!res.ok) return;
        const text = await res.text();
        const lines = text.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          try {
            const envelope = JSON.parse(lines[i]);
            if (envelope?.event === 'message' && envelope?.message) {
              const parsed = parseIncomingPayload(envelope.message);
              if (parsed) {
                deliver(parsed);
                return;
              }
            }
          } catch {
            // Skip malformed line
          }
        }
      } catch {
        // Retry on next tick
      }
    };

    const intervalId = setInterval(poll, 2500);
    cleanups.push(() => clearInterval(intervalId));
  }

  return () => {
    stopped = true;
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        // Ignore cleanup errors
      }
    });
  };
}

export async function sendPairedYape(sessionId, { name, qrPayload }) {
  const body = buildDirectSyncPayload(name, qrPayload);

  // 1. Notify same-browser tab if open
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(`${BROADCAST_PREFIX}${sessionId}`);
      bc.postMessage(body);
      bc.close();
    } catch {
      // Ignore local channel failure
    }
  }

  // 2. Simple CORS-safelisted HTTPS POST (no preflight) to relay
  const topic = topicForSession(sessionId);
  const response = await fetch(`${RELAY_BASE}/${topic}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('No se pudo enviar a la pantalla del carro.');
  }

  return true;
}
