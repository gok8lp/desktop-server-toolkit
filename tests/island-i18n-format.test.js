// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) testlerinden; yol FLUGEL Island'a uyarlandı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {format, systemLanguage} from '../extensions/flugel-island@flugel/src/i18n.js';

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

test('format places English percentages after the value', () => {
    assert.equal(format('Battery %s%%', 42), 'Battery 42%');
});

test('system language honours the first preferred locale', () => {
    assert.equal(systemLanguage(['en_US', 'en', 'tr_TR', 'tr', 'C']), 'en');
    assert.equal(systemLanguage(['tr_TR', 'tr', 'en_US', 'C']), 'tr');
    assert.equal(systemLanguage(['de_DE', 'de', 'tr_TR', 'C']), 'en');
});

test('format returns the string unchanged when no args and no placeholders', () => {
    assert.equal(format('Caps Lock on'), 'Caps Lock on');
});
