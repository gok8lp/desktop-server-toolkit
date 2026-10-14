// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) testlerinden; yol FLUGEL Island'a uyarlandı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createActivity,
    assertActivity,
    emptyViewModel,
    TIERS,
    SLOTS,
} from '../extensions/flugel-island@flugel/src/activity.js';

test('createActivity fills defaults and a monotonic startedAt', () => {
    const a = createActivity({
        id: 'x',
        providerId: 'media',
        tier: 'persistent',
        slot: 'leading',
        label: 'Track',
    });
    assert.equal(a.id, 'x');
    assert.equal(a.priority, 0);
    assert.ok(typeof a.startedAt === 'number');
    assert.equal(a.expiresAt, undefined);
});

test('createActivity rejects unknown tier', () => {
    assert.throws(
        () => createActivity({ id: 'x', providerId: 'p', tier: 'weird', slot: 'either', label: 'L' }),
        /tier/,
    );
});

test('createActivity rejects unknown slot', () => {
    assert.throws(
        () => createActivity({ id: 'x', providerId: 'p', tier: 'persistent', slot: 'middle', label: 'L' }),
        /slot/,
    );
});

test('createActivity requires id, providerId, label', () => {
    for (const missing of ['id', 'providerId', 'label']) {
        const good = { id: 'x', providerId: 'p', tier: 'persistent', slot: 'either', label: 'L' };
        delete good[missing];
        assert.throws(() => createActivity(good), new RegExp(missing));
    }
});

test('assertActivity accepts a built activity', () => {
    const a = createActivity({ id: 'x', providerId: 'p', tier: 'ambient', slot: 'either', label: 'L' });
    assert.doesNotThrow(() => assertActivity(a));
});

test('emptyViewModel has all required fields', () => {
    const vm = emptyViewModel();
    assert.equal(vm.baseState, 'idle');
    assert.equal(vm.leading, null);
    assert.equal(vm.trailing, null);
    assert.equal(vm.flashing, null);
    assert.equal(vm.hovered, false);
    assert.equal(vm.pinned, false);
    assert.deepEqual(vm.ambientOverflow, []);
});

test('TIERS and SLOTS enumerate the contract', () => {
    assert.deepEqual([...TIERS].sort(), ['ambient', 'persistent', 'transient']);
    assert.deepEqual([...SLOTS].sort(), ['either', 'leading', 'trailing']);
});

test('assertActivity rejects non-finite startedAt and expiresAt', () => {
    const base = { id: 'x', providerId: 'p', tier: 'persistent', slot: 'either', label: 'L' };
    for (const bad of [Infinity, -Infinity, NaN]) {
        assert.throws(
            () => assertActivity({ ...base, startedAt: bad }),
            /finite/,
        );
        assert.throws(
            () => assertActivity({ ...base, startedAt: 10, expiresAt: bad }),
            /finite/,
        );
    }
});

test('assertActivity rejects non-finite priority', () => {
    const base = { id: 'x', providerId: 'p', tier: 'persistent', slot: 'either', label: 'L', startedAt: 10 };
    for (const bad of [Infinity, NaN, 'high', undefined, null]) {
        assert.throws(
            () => assertActivity({ ...base, priority: bad }),
            /priority/,
        );
    }
});
