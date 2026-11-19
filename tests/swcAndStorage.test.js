import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSwcBinding } from '../src/utils/swcTrigger.js';
import { formatPhoneNumber, sanitizeState } from '../src/utils/storage.js';

test('matchesSwcBinding coincide con botón de volante asignado e ignora repetición', () => {
  const binding = { code: 'MediaTrackNext', label: 'Volante: Siguiente' };
  assert.equal(matchesSwcBinding({ code: 'MediaTrackNext', repeat: false }, binding), true);
  assert.equal(matchesSwcBinding({ code: 'MediaTrackNext', repeat: true }, binding), false);
  assert.equal(matchesSwcBinding({ code: 'KeyA', repeat: false }, binding), false);
});

test('formatPhoneNumber oculta o muestra dígitos según privacidad', () => {
  assert.equal(formatPhoneNumber('987654321', false), '••• ••• 321');
  assert.equal(formatPhoneNumber('987654321', true), '987 654 321');
  assert.equal(formatPhoneNumber('', false), '');
});

test('sanitizeState recupera valores por defecto ante datos incompletos', () => {
  const clean = sanitizeState({
    autoCloseSeconds: 30,
    fares: ['2.5', 'invalid'],
  });
  assert.equal(clean.autoCloseSeconds, 30);
  assert.deepEqual(clean.fares, ['2.50', '2.00']);
  assert.equal(clean.profiles.length, 2);
});
