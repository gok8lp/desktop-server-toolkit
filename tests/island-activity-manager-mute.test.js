import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createActivity, _setFakeClock} from '../extensions/flugel-island@flugel/src/activity.js';
import {ActivityManager} from '../extensions/flugel-island@flugel/src/activity-manager.js';

function manager() {
    const instance = new ActivityManager();
    let current = null;
    instance.subscribe(vm => (current = vm));
    return {instance, view: () => current};
}

function activity(id, providerId, overrides = {}) {
    return createActivity({
        id,
        providerId,
        tier: 'persistent',
        slot: 'either',
        label: id,
        startedAt: 10,
        ...overrides,
    });
}

test('empty mute and promotion state keeps an empty idle view-model', () => {
    const {instance, view} = manager();
    instance.setMuted(new Map());
    instance.setPromoted(new Set());
    assert.equal(view().baseState, 'idle');
    assert.equal(view().mutedCount, 0);
    assert.deepEqual(view().live, []);
    assert.equal(instance.nextMuteExpiry(100), null);
});

test('active provider mute removes persistent and transient activities from every view slot', () => {
    const {instance, view} = manager();
    instance.push(activity('song', 'media', {slot: 'leading'}));
    instance.push(activity('banner', 'media', {tier: 'transient', expiresAt: Number.MAX_SAFE_INTEGER}));
    instance.setMuted(new Map([['media', Infinity]]));

    assert.equal(instance.isMuted('media', 100), true);
    assert.equal(view().leading, null);
    assert.equal(view().trailing, null);
    assert.equal(view().flashing, null);
    assert.deepEqual(view().live, []);
    assert.equal(view().mutedCount, 2);
});

test('expired mute restores activities after tick and no longer counts them as muted', () => {
    let now = 100;
    _setFakeClock(() => now);
    try {
        const {instance, view} = manager();
        instance.push(activity('song', 'media'));
        instance.setMuted(new Map([['media', 200]]));
        assert.equal(view().baseState, 'idle');
        assert.equal(view().mutedCount, 1);

        now = 200;
        instance.tick();
        assert.equal(instance.isMuted('media'), false);
        assert.equal(view().baseState, 'compact');
        assert.equal(view().leading.id, 'song');
        assert.equal(view().mutedCount, 0);
    } finally {
        _setFakeClock(null);
    }
});

test('session mute uses Infinity and has no finite next expiry', () => {
    const {instance, view} = manager();
    instance.push(activity('song', 'media'));
    instance.setMuted(new Map([['media', Infinity]]));

    assert.equal(instance.isMuted('media', Number.MAX_SAFE_INTEGER), true);
    assert.equal(instance.nextMuteExpiry(100), null);
    assert.equal(view().mutedCount, 1);
});

test('nextMuteExpiry returns the nearest future finite expiry only', () => {
    const {instance} = manager();
    instance.setMuted(new Map([
        ['expired', 90],
        ['later', 400],
        ['nearest', 250],
        ['session', Infinity],
    ]));
    assert.equal(instance.nextMuteExpiry(100), 250);
    assert.equal(instance.nextMuteExpiry(250), 400);
    assert.equal(instance.nextMuteExpiry(400), null);
});

test('privacy, panic and data-critical activities cannot be muted', () => {
    const {instance, view} = manager();
    const critical = [
        activity('camera', 'privacy', {priority: 1}),
        activity('panic', 'panik', {priority: 2}),
        activity('server', 'server', {priority: 3, data: {kritik: true}}),
    ];
    for (const item of critical)
        instance.push(item);
    instance.setMuted(new Map([
        ['privacy', Infinity],
        ['panik', Infinity],
        ['server', Infinity],
    ]));

    assert.equal(critical.every(item => ActivityManager.isCritical(item)), true);
    assert.equal(view().mutedCount, 0);
    assert.deepEqual(view().live.map(item => item.id), ['server', 'panic', 'camera']);
    assert.equal(view().leading.id, 'server');
    assert.equal(view().trailing.id, 'panic');
});

test('ordinary activity is not critical', () => {
    assert.equal(ActivityManager.isCritical(activity('song', 'media')), false);
});

test('promotion adds enough effective priority to reorder live and slots', () => {
    const {instance, view} = manager();
    instance.push(activity('normal-high', 'normal', {priority: 500, startedAt: 20}));
    instance.push(activity('promoted-low', 'favorite', {priority: -100, startedAt: 30}));
    instance.setPromoted(new Set(['favorite']));

    assert.deepEqual(view().live.map(item => item.id), ['promoted-low', 'normal-high']);
    assert.equal(view().leading.id, 'promoted-low');
    assert.equal(view().trailing.id, 'normal-high');
});

test('critical priority remains above promoted ordinary activity', () => {
    const {instance, view} = manager();
    instance.push(activity('promoted', 'favorite', {priority: 8000}));
    instance.push(activity('critical', 'privacy', {priority: 0}));
    instance.setPromoted(new Set(['favorite']));

    assert.equal(view().live[0].id, 'critical');
    assert.equal(view().leading.id, 'critical');
});

test('replacing mute and promotion collections recomputes the view-model', () => {
    const {instance, view} = manager();
    instance.push(activity('a', 'one', {priority: 2}));
    instance.push(activity('b', 'two', {priority: 1}));
    instance.setMuted(new Map([['one', Infinity]]));
    assert.deepEqual(view().live.map(item => item.id), ['b']);

    instance.setMuted(new Map());
    instance.setPromoted(new Set(['two']));
    assert.deepEqual(view().live.map(item => item.id), ['b', 'a']);
    assert.equal(view().mutedCount, 0);
});
