// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) testlerinden; yol FLUGEL Island'a uyarlandı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createActivity, _setFakeClock } from '../extensions/flugel-island@flugel/src/activity.js';
import { ActivityManager } from '../extensions/flugel-island@flugel/src/activity-manager.js';

function mgr() {
    const m = new ActivityManager();
    const models = [];
    m.subscribe(vm => models.push(vm));
    return { m, models, last: () => models[models.length - 1] };
}

function act(spec) { return createActivity(spec); }

test('empty manager emits idle view-model on subscribe', () => {
    const { last } = mgr();
    assert.equal(last().baseState, 'idle');
});

test('one persistent leading → compact', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'a', providerId: 'media', tier: 'persistent', slot: 'leading', label: 'Song' }));
    assert.equal(last().baseState, 'compact');
    assert.equal(last().leading.id, 'a');
    assert.equal(last().trailing, null);
});

test('two persistents filling both slots → split', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'a', providerId: 'media', tier: 'persistent', slot: 'leading', label: 'Song' }));
    m.push(act({ id: 'b', providerId: 'notification', tier: 'persistent', slot: 'trailing', label: 'Msg' }));
    assert.equal(last().baseState, 'split');
    assert.equal(last().leading.id, 'a');
    assert.equal(last().trailing.id, 'b');
});

test('either-slot activity fills leading first', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'e', providerId: 'p', tier: 'persistent', slot: 'either', label: 'E' }));
    assert.equal(last().leading.id, 'e');
    assert.equal(last().trailing, null);
});

test('higher priority wins within a slot', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'low', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L', priority: 0 }));
    m.push(act({ id: 'hi',  providerId: 'p', tier: 'persistent', slot: 'leading', label: 'H', priority: 5 }));
    assert.equal(last().leading.id, 'hi');
});

test('hover promotes baseState to expanded regardless of slot count', () => {
    const { m, last } = mgr();
    m.setHover(true);
    assert.equal(last().baseState, 'expanded');
    m.push(act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L' }));
    assert.equal(last().baseState, 'expanded');
    m.setHover(false);
    assert.equal(last().baseState, 'compact');
});

test('pin survives hover-off', () => {
    const { m, last } = mgr();
    m.setPinned(true);
    m.setHover(true);
    m.setHover(false);
    assert.equal(last().baseState, 'expanded');
    m.setPinned(false);
    assert.equal(last().baseState, 'idle');
});

test('transient sets flashing and keeps underlying slots', () => {
    let t = 1_000_000;
    _setFakeClock(() => t);
    try {
        const { m, last } = mgr();
        m.push(act({ id: 'media', providerId: 'media', tier: 'persistent', slot: 'leading', label: 'Song' }));
        m.push(act({ id: 'vol',   providerId: 'volume', tier: 'transient', slot: 'either', label: '70%',
                     expiresAt: t + 1_500_000 }));
        assert.equal(last().flashing.id, 'vol');
        assert.equal(last().leading.id, 'media');
        assert.equal(last().baseState, 'compact');
    } finally {
        _setFakeClock(null);
    }
});

test('transient clears when clock passes expiresAt and tick() runs', () => {
    let t = 1_000_000;
    _setFakeClock(() => t);
    try {
        const { m, last } = mgr();
        m.push(act({ id: 'vol', providerId: 'volume', tier: 'transient', slot: 'either', label: '70%',
                     expiresAt: t + 1_500_000 }));
        assert.equal(last().flashing.id, 'vol');
        t = t + 2_000_000;
        m.tick();
        assert.equal(last().flashing, null);
    } finally {
        _setFakeClock(null);
    }
});

test('ambient activities populate ambientOverflow only', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'batt', providerId: 'power', tier: 'ambient', slot: 'either', label: '42%' }));
    assert.equal(last().leading, null);
    assert.equal(last().baseState, 'idle');
    assert.equal(last().ambientOverflow.length, 1);
    assert.equal(last().ambientOverflow[0].id, 'batt');
});

test('remove drops the activity and re-runs assignment', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'A' }));
    m.push(act({ id: 'b', providerId: 'p', tier: 'persistent', slot: 'trailing', label: 'B' }));
    assert.equal(last().baseState, 'split');
    m.remove('a');
    // b has slot:'trailing' so leading stays empty.
    assert.equal(last().baseState, 'compact');
    assert.equal(last().leading, null);
    assert.equal(last().trailing.id, 'b');
});

test('update replaces an activity by id preserving startedAt ordering', () => {
    const { m, last } = mgr();
    const a1 = act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L1', startedAt: 10 });
    m.push(a1);
    const a2 = act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L2', startedAt: 20 });
    m.update(a2);
    assert.equal(last().leading.label, 'L2');
});

test('two either-slot activities: higher priority → leading, lower → trailing', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'hi', providerId: 'p', tier: 'persistent', slot: 'either', label: 'Hi', priority: 5 }));
    m.push(act({ id: 'lo', providerId: 'p', tier: 'persistent', slot: 'either', label: 'Lo', priority: 0 }));
    assert.equal(last().baseState, 'split');
    assert.equal(last().leading.id, 'hi');
    assert.equal(last().trailing.id, 'lo');
});
