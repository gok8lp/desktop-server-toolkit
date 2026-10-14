import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { createActivity } from '../activity.js';
import { format } from '../i18n.js';
import { oncelik } from './provider-base.js';

// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) kaynağından. FLUGEL değişikliği (2026-10-13): simge,
// öncelik ayardan, Türkçe metinler. Varsayılan olarak kapalı (ayarlardan açılır).

export class NotificationProvider {
    constructor() {
        this.id = 'notification';
        this._manager = null;
        this._settings = null;
        this._tray = null;
        this._trayHandlers = [];
        this._sourceHandlers = new Map();         // source → handler id
        this._notificationHandlers = new Map();   // notification → handler id
        this._active = new Set();
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._tray = Main.messageTray;

        this._trayHandlers.push(
            this._tray.connect('source-added', (_t, source) => this._bindSource(source)),
            this._tray.connect('source-removed', (_t, source) => this._unbindSource(source)),
        );
        for (const src of this._tray.getSources()) this._bindSource(src);
    }

    disable() {
        if (!this._tray) return;
        for (const id of this._trayHandlers) this._tray.disconnect(id);
        this._trayHandlers = [];

        for (const [source, id] of this._sourceHandlers) 
            try { source.disconnect(id); } catch (_) { /* zaten ayrılmış */ }
        
        this._sourceHandlers.clear();

        for (const [notif, id] of this._notificationHandlers) 
            try { notif.disconnect(id); } catch (_) { /* zaten ayrılmış */ }
        
        this._notificationHandlers.clear();

        this._active.clear();
        this._manager?.remove(`${this.id}:aggregate`);
        this._manager = null;
        this._tray = null;
    }

    _bindSource(source) {
        if (this._sourceHandlers.has(source)) return;
        const id = source.connect('notification-added', (_s, n) => {
            const excluded = this._settings?.get_strv('notification-excluded-apps') ?? [];
            if (source.app?.get_id && excluded.includes(source.app.get_id())) return;

            this._active.add(n);
            const destroyId = n.connect('destroy', () => {
                this._notificationHandlers.delete(n);
                this._active.delete(n);
                this._rebuild();
            });
            this._notificationHandlers.set(n, destroyId);
            this._rebuild();
        });
        this._sourceHandlers.set(source, id);
    }

    _unbindSource(source) {
        const id = this._sourceHandlers.get(source);
        if (id !== undefined) {
            try { source.disconnect(id); } catch (_) { /* zaten ayrılmış */ }
            this._sourceHandlers.delete(source);
        }
    }

    _rebuild() {
        const n = this._active.size;
        if (n === 0) {
            this._manager?.remove(`${this.id}:aggregate`);
            return;
        }

        const threshold = this._settings?.get_int('notification-coalesce-threshold') ?? 3;
        let label, sublabel;
        if (n < threshold) {
            const latest = [...this._active].pop();
            // Fallback when the source provides no title — translatable.
            // Notification title/body itself comes from the source app and is
            // intentionally NOT translated here.
            label = latest.title ?? latest.source?.title ?? 'Bildirim';
            sublabel = latest.bannerBodyText ?? latest.body ?? '';
        } else {
            label = format('%d yeni', n);
            sublabel = 'Bildirimler';
        }

        this._manager?.update(createActivity({
            id: `${this.id}:aggregate`,
            providerId: this.id,
            tier: 'persistent',
            slot: 'trailing',
            priority: oncelik(this._settings, this.id),
            glyph: 'mail-unread-symbolic',
            label, sublabel,
            data: { kisa: String(n) },
        }));
    }
}
