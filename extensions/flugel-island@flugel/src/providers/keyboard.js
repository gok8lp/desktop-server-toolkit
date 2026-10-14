import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import { createActivity, _now } from '../activity.js';
import { format } from '../i18n.js';
import { oncelik, geciciSure } from './provider-base.js';

// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) kaynağından. FLUGEL değişikliği (2026-10-13): simge,
// öncelik ayardan, Türkçe metinler. Varsayılan olarak kapalı.

export class KeyboardProvider {
    constructor() {
        this.id = 'keyboard';
        this._manager = null;
        this._settings = null;
        this._handlers = [];
        this._sources = null;
        // state-changed fires on every modifier (Shift, Ctrl, locks, etc.).
        // Track the last observed caps-lock state so we only flash on transitions.
        this._lastCapsLock = null;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;

        this._sources = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
        this._handlers.push(
            this._sources.connect('changed::mru-sources', () => this._flashLayoutSwitch()),
            this._sources.connect('changed::current', () => this._flashLayoutSwitch()),
        );

        const keymap = Clutter.get_default_backend().get_default_seat().get_keymap();
        this._lastCapsLock = keymap.get_caps_lock_state();
        this._handlers.push([keymap, keymap.connect('state-changed', () => this._flashCapsLock(keymap))]);
    }

    disable() {
        if (!this._sources) return;
        for (const h of this._handlers) {
            if (Array.isArray(h)) h[0].disconnect(h[1]);
            else this._sources.disconnect(h);
        }
        this._handlers = [];
        this._sources = null;
        this._lastCapsLock = null;
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    _flashCapsLock(keymap) {
        const on = keymap.get_caps_lock_state();
        if (on === this._lastCapsLock) return;   // modifier change wasn't caps lock
        this._lastCapsLock = on;
        if (!this._settings?.get_boolean('keyboard-flash-caps-lock')) return;
        // Two separate msgids — xgettext can't extract `Caps Lock ${x ? 'on' : 'off'}`.
        this._push(on ? 'Caps Lock açık' : 'Caps Lock kapalı');
    }

    _flashLayoutSwitch() {
        if (!this._settings?.get_boolean('keyboard-flash-layout-switch')) return;
        const sources = this._sources.get_value('mru-sources').deepUnpack();
        if (!sources.length) return;
        const [, id] = sources[0];
        this._push(format('Klavye · %s', id));
    }

    _push(label) {
        const duration = geciciSure(this._settings);
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`,
            providerId: this.id,
            tier: 'transient',
            slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: 'input-keyboard-symbolic',
            label,
            startedAt: now,
            expiresAt: now + duration,
        }));
    }
}
