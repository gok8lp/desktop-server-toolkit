// FLUGEL eklemeleri için testler: aynı etkinliğin tekrar gönderilmesi, nextExpiry, live listesi, öncelik.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createActivity, _setFakeClock} from '../extensions/flugel-island@flugel/src/activity.js';
import {ActivityManager} from '../extensions/flugel-island@flugel/src/activity-manager.js';
import {oncelik} from '../extensions/flugel-island@flugel/src/providers/provider-base.js';

const ayar = sira => ({get_strv: () => sira});

test('aynı içerik tekrar gönderilince abonelere bildirim gitmez', () => {
    const m = new ActivityManager();
    let n = 0;
    m.subscribe(() => n++);
    const spec = {id: 'a', providerId: 'p', tier: 'persistent', slot: 'either', label: 'x', data: {kisa: '1', fn: () => 1}};
    m.push(createActivity(spec));
    const once = n;
    m.push(createActivity({...spec, data: {kisa: '1', fn: () => 2}}));
    assert.equal(n, once);
    m.push(createActivity({...spec, data: {kisa: '2'}}));
    assert.equal(n, once + 1);
});

test('kalıcı etkinlik güncellenince başlangıç zamanı korunur', () => {
    let t = 1000;
    _setFakeClock(() => t);
    const m = new ActivityManager();
    m.push(createActivity({id: 'a', providerId: 'p', tier: 'persistent', slot: 'either', label: 'x'}));
    t = 5000;
    m.push(createActivity({id: 'a', providerId: 'p', tier: 'persistent', slot: 'either', label: 'y'}));
    assert.equal(m.get('a').startedAt, 1000);
    _setFakeClock(null);
});

test('nextExpiry en yakın bitişi verir, yoksa -1', () => {
    let t = 0;
    _setFakeClock(() => t);
    const m = new ActivityManager();
    assert.equal(m.nextExpiry(), -1);
    m.push(createActivity({id: 'a', providerId: 'p', tier: 'transient', slot: 'either', label: 'x', expiresAt: 500}));
    m.push(createActivity({id: 'b', providerId: 'p', tier: 'transient', slot: 'either', label: 'y', expiresAt: 300}));
    assert.equal(m.nextExpiry(), 300);
    t = 400;
    assert.equal(m.nextExpiry(), 100);
    t = 600;
    assert.equal(m.nextExpiry(), -1);
    _setFakeClock(null);
});

test('live: kalıcı etkinlikler öncelik sırasıyla', () => {
    const m = new ActivityManager();
    let vm;
    m.subscribe(v => (vm = v));
    m.push(createActivity({id: 'd', providerId: 'p', tier: 'persistent', slot: 'either', label: 'düşük', priority: 1}));
    m.push(createActivity({id: 'y', providerId: 'p', tier: 'persistent', slot: 'either', label: 'yüksek', priority: 9}));
    m.push(createActivity({id: 'o', providerId: 'p', tier: 'ambient', slot: 'either', label: 'ortam'}));
    assert.deepEqual(vm.live.map(a => a.id), ['y', 'd']);
    assert.equal(vm.baseState, 'split');
    assert.equal(vm.leading.id, 'y');
    assert.equal(vm.trailing.id, 'd');
});

test('oncelik: ayardaki sıra, ilk en yüksek; bilinmeyen 0', () => {
    const s = ayar(['privacy', 'media', 'kripto']);
    assert.ok(oncelik(s, 'privacy') > oncelik(s, 'media'));
    assert.ok(oncelik(s, 'media', 50) > oncelik(s, 'media'));
    assert.ok(oncelik(s, 'media', 99) < oncelik(s, 'privacy'));
    assert.equal(oncelik(s, 'yok'), 0);
});
