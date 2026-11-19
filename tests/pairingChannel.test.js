import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDirectSyncPayload,
  buildPairingUrl,
  generatePairSessionId,
  getPairSessionFromLocation,
  parseIncomingPayload,
} from '../src/utils/pairingChannel.js';

test('generatePairSessionId genera token alfanumérico de 12 caracteres', () => {
  const id = generatePairSessionId();
  assert.match(id, /^[A-Z2-9]{12}$/);
});

test('buildPairingUrl y getPairSessionFromLocation realizan round-trip limpio', () => {
  const id = generatePairSessionId();
  const url = buildPairingUrl(id, { href: 'https://yapepiloto.app/' });
  assert.equal(url, `https://yapepiloto.app/?pair=${id}`);

  const parsedUrl = new URL(url);
  assert.equal(getPairSessionFromLocation(parsedUrl), id);
});

test('buildDirectSyncPayload y parseIncomingPayload preservan nombre y QR payload', () => {
  const raw = buildDirectSyncPayload('  Carlos Mendoza  ', '000201010211DEMO');
  const parsed = parseIncomingPayload(raw);
  assert.deepEqual(parsed, {
    name: 'Carlos Mendoza',
    qrPayload: '000201010211DEMO',
  });
});

test('parseIncomingPayload descarta payloads corruptos o vacíos', () => {
  assert.equal(parseIncomingPayload('not json'), null);
  assert.equal(parseIncomingPayload(JSON.stringify({ name: 'Solo nombre' })), null);
});
