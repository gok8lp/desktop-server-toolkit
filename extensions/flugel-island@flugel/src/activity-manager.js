// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) kaynağından. FLUGEL değişiklikleri (2026-10-13):
// nextExpiry() (sabit 250 ms tik yerine sadece süre dolunca uyanmak için), görünüm modeline `live`
// (genişletilmiş kartta tüm kalıcı etkinlikler, öncelik sırasıyla) ve get(id).
import { emptyViewModel, assertActivity, _now } from './activity.js';

// Pure — no gi imports. Use callback subscribe, not GObject signals.

function sameActivity(a, b) {
    for (const k of ['tier', 'slot', 'priority', 'glyph', 'label', 'sublabel', 'expiresAt']) 
        if (a[k] !== b[k]) return false;
    
    // data içindeki fonksiyonlar karşılaştırılmaz (JSON.stringify onları atlar); kapak simgesi kapakUrl ile izlenir
    return JSON.stringify(a.data, (k, v) => (k === 'kapak' ? undefined : v)) ===
        JSON.stringify(b.data, (k, v) => (k === 'kapak' ? undefined : v));
}
export class ActivityManager {
    constructor() {
        this._activities = new Map();   // id → Activity
        this._subs = new Set();
        this._hovered = false;
        this._pinned = false;
        this._lastVM = emptyViewModel();
        this._notify();
    }

    // Subscription: invoke immediately with current VM.
    subscribe(fn) {
        this._subs.add(fn);
        fn(this._lastVM);
        return () => this._subs.delete(fn);
    }

    push(activity) {
        assertActivity(activity);
        const old = this._activities.get(activity.id);
        // FLUGEL: veri kaynakları her yenilemede aynı etkinliği tekrar gönderir; değişen bir şey yoksa
        // görünümü boşuna uyandırma. Kalıcı etkinlikler ilk başladıkları anı korur (sıra zıplamasın).
        if (old && activity.tier !== 'transient') {
            if (sameActivity(old, activity)) return;
            if (old.tier === activity.tier) activity = Object.freeze({ ...activity, startedAt: old.startedAt });
        }
        this._activities.set(activity.id, activity);
        this._notify();
    }

    update(activity) { this.push(activity); }

    remove(id) {
        if (this._activities.delete(id)) this._notify();
    }

    setHover(h) {
        if (this._hovered === !!h) return;
        this._hovered = !!h;
        this._notify();
    }

    setPinned(p) {
        if (this._pinned === !!p) return;
        this._pinned = !!p;
        this._notify();
    }

    get(id) { return this._activities.get(id) ?? null; }

    // Microseconds until the next activity expires, or -1 if none will.
    nextExpiry() {
        const now = _now();
        let next = Infinity;
        for (const a of this._activities.values()) 
            if (a.expiresAt !== undefined && a.expiresAt > now) next = Math.min(next, a.expiresAt - now);
        
        return next === Infinity ? -1 : next;
    }

    isHovered() { return this._hovered; }
    isPinned() { return this._pinned; }

    // Called by an external ticker to expire transients.
    tick() { this._notify(); }

    destroy() {
        this._subs.clear();
        this._activities.clear();
    }

    // ----- internals -----

    _assign() {
        const now = _now();

        // Drop expired.
        const live = [];
        for (const a of this._activities.values()) {
            if (a.expiresAt !== undefined && a.expiresAt <= now) continue;
            live.push(a);
        }

        const transients = live.filter(a => a.tier === 'transient');
        const persistents = live.filter(a => a.tier === 'persistent');
        const ambients = live.filter(a => a.tier === 'ambient');

        // Flash = newest transient by startedAt (descending).
        transients.sort((x, y) => y.startedAt - x.startedAt);
        const flashing = transients[0] ?? null;

        // Slot assignment over persistents.
        const byPriority = (x, y) => (y.priority - x.priority) || (x.startedAt - y.startedAt);
        const leadingCandidates = persistents.filter(a => a.slot === 'leading' || a.slot === 'either');
        leadingCandidates.sort(byPriority);
        const leading = leadingCandidates[0] ?? null;

        const trailingCandidates = persistents.filter(
            a => (a.slot === 'trailing' || a.slot === 'either') && a !== leading,
        );
        trailingCandidates.sort(byPriority);
        const trailing = trailingCandidates[0] ?? null;

        const liveSorted = [...persistents].sort(byPriority);

        // Derive baseState.
        let baseState;
        if (this._hovered || this._pinned) baseState = 'expanded';
        else if (leading && trailing) baseState = 'split';
        else if (leading || trailing) baseState = 'compact';
        else baseState = 'idle';

        return {
            baseState,
            leading,
            trailing,
            flashing,
            hovered: this._hovered,
            pinned: this._pinned,
            ambientOverflow: Object.freeze(ambients),
            live: Object.freeze(liveSorted),
        };
    }

    _notify() {
        this._lastVM = Object.freeze(this._assign());
        for (const fn of this._subs) fn(this._lastVM);
    }
}
