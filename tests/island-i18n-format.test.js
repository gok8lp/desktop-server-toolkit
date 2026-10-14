// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) testlerinden; yol FLUGEL Island'a uyarlandı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format } from '../extensions/flugel-island@flugel/src/i18n.js';

test('format substitutes %s in order', () => {
    assert.equal(format('hello %s', 'world'), 'hello world');
});

test('format substitutes %d and coerces numbers to strings', () => {
    assert.equal(format('Battery %d%%', 42), 'Battery 42%');
});

test('format handles multiple placeholders left-to-right', () => {
    assert.equal(format('%s · %s', 'Media', 'Artist'), 'Media · Artist');
});

test('format leaves %% alone as a literal percent', () => {
    assert.equal(format('100%% done'), '100% done');
});

test('format returns the string unchanged when no args and no placeholders', () => {
    assert.equal(format('Caps Lock on'), 'Caps Lock on');
});
