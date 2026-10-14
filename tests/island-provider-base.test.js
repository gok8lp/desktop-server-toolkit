// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) testlerinden; yol FLUGEL Island'a uyarlandı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProvider } from '../extensions/flugel-island@flugel/src/providers/provider-base.js';

const stub = {
    id: 'x',
    enable: () => {},
    disable: () => {},
};

test('assertProvider accepts a minimal valid stub', () => {
    assert.doesNotThrow(() => assertProvider(stub));
});

test('assertProvider rejects missing id', () => {
    assert.throws(() => assertProvider({ ...stub, id: undefined }), /id/);
});

test('assertProvider rejects missing enable/disable', () => {
    assert.throws(() => assertProvider({ ...stub, enable: undefined }), /enable/);
    assert.throws(() => assertProvider({ ...stub, disable: undefined }), /disable/);
});
