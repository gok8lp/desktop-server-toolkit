import Gio from 'gi://Gio';
import { createActivity, _now } from '../activity.js';
import { format } from '../i18n.js';
import { oncelik, geciciSure } from './provider-base.js';
import { KIRMIZI } from '../ortak.js';

// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) kaynağından. FLUGEL değişiklikleri (2026-10-13): ortam
// etkinliği boştaki kapsülde mini pil göstergesi oldu (simge + pildeyken yüzde, düşükse kırmızı); şarj ve
// düşük pil uyarılarına simge ve öncelik eklendi; metinler Türkçe.

const UPOWER_PATH = '/org/freedesktop/UPower/devices/DisplayDevice';
const UPOWER_IFACE = 'org.freedesktop.UPower.Device';

export class PowerProvider {
    constructor() {
        this.id = 'power';
        this._manager = null;
        this._settings = null;
        this._proxy = null;
        this._propsHandler = 0;
        this._lastPlugged = null;
        this._lastLowFlashedPct = null;
        this._cancelled = false;
    }

    async enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;

        this._proxy = new Gio.DBusProxy({
            g_connection: Gio.DBus.system,
            g_name: 'org.freedesktop.UPower',
            g_object_path: UPOWER_PATH,
            g_interface_name: UPOWER_IFACE,
            g_flags: Gio.DBusProxyFlags.NONE,
        });
        try { await this._proxy.init_async(0, null); } catch (_) { return; }
        if (this._cancelled) return;

        this._propsHandler = this._proxy.connect('g-properties-changed', () => this._refresh());
        this._refresh();
    }

    disable() {
        this._cancelled = true;
        if (this._proxy && this._propsHandler) this._proxy.disconnect(this._propsHandler);
        this._proxy = null;
        this._propsHandler = 0;
        this._manager?.remove(`${this.id}:ambient`);
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    _refresh() {
        const state = this._proxy.get_cached_property('State')?.deepUnpack();  // 1=charging,2=discharging,4=fully
        const pct = this._proxy.get_cached_property('Percentage')?.deepUnpack();
        if (state === undefined || pct === undefined) return;

        // Ambient steady-state entry: boştaki kapsülde mini gösterge.
        const plugged0 = (state === 1 || state === 4);
        const lowNow = !plugged0 && Math.round(pct) <= (this._settings?.get_int('power-low-threshold') ?? 15);
        this._manager.update(createActivity({
            id: `${this.id}:ambient`,
            providerId: this.id,
            tier: 'ambient',
            slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: this._proxy.get_cached_property('IconName')?.deepUnpack() || 'battery-symbolic',
            label: `${Math.round(pct)}%`,
            sublabel: state === 1 ? 'Şarj oluyor' : state === 4 ? 'Dolu' : 'Pilde',
            data: { mini: true, kisa: plugged0 ? '' : `${Math.round(pct)}%`, renk: lowNow ? KIRMIZI : null },
        }));

        // Plug/unplug transient.
        const plugged = (state === 1 || state === 4);
        if (this._lastPlugged !== null && plugged !== this._lastPlugged) {
            this._flash(plugged ? 'Şarj takıldı' : 'Şarj çıkarıldı',
                plugged ? 'battery-full-charging-symbolic' : 'battery-symbolic');
        }
        this._lastPlugged = plugged;

        // Low-battery transient — only flash when entering a new 5% step below the threshold
        // so the user isn't flashed on every UPower property update while sitting at 14%.
        const threshold = this._settings?.get_int('power-low-threshold') ?? 15;
        const roundedPct = Math.round(pct);
        if (!plugged && roundedPct <= threshold) {
            const step = Math.floor(roundedPct / 5) * 5;
            if (this._lastLowFlashedPct !== step) {
                this._lastLowFlashedPct = step;
                this._flash(format('Pil azaldı — %%%d', roundedPct), 'battery-caution-symbolic');
            }
        } else {
            this._lastLowFlashedPct = null;   // reset when plugged or above threshold
        }
    }

    _flash(label, glyph = 'battery-symbolic') {
        const duration = geciciSure(this._settings);
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`,
            providerId: this.id,
            tier: 'transient',
            slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph,
            label,
            startedAt: now,
            expiresAt: now + duration,
        }));
    }
}
