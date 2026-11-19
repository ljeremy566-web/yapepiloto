import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../src/utils/voiceTrigger.js';

test('detecta comando simple "yape"', () => {
  const res = parseVoiceCommand('Yape');
  assert.equal(res.action, 'open');
  assert.equal(res.amount, null);
});

test('detecta monto en palabras "yape cinco soles"', () => {
  const res = parseVoiceCommand('Yape cinco soles');
  assert.equal(res.action, 'open');
  assert.equal(res.amount, '5.00');
});

test('detecta monto decimal hablado "cobrar dos cincuenta"', () => {
  const res = parseVoiceCommand('cobrar dos cincuenta');
  assert.equal(res.action, 'open');
  assert.equal(res.amount, '2.50');
});

test('detecta monto numérico "mostrar qr 3.50"', () => {
  const res = parseVoiceCommand('mostrar qr 3.50');
  assert.equal(res.action, 'open');
  assert.equal(res.amount, '3.50');
});

test('detecta comando de cierre "listo cerrar"', () => {
  const res = parseVoiceCommand('listo ya pagó cerrar');
  assert.equal(res.action, 'close');
});

test('ignora conversación normal del pasajero', () => {
  const res = parseVoiceCommand('baja en la esquina por favor');
  assert.equal(res.action, null);
});
