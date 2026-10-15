// FLUGEL Island — odak (Atoll'daki "Focus" canlı etkinliği): Rahatsız etme açıkken kapsülün yanında küçük bir ay;
// tıklayınca kapatılır. GNOME'un kendi ayarı (org.gnome.desktop.notifications show-banners) izlenir.
import Gio from 'gi://Gio';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {_} from '../dil.js';

export class OdakProvider {
    constructor() {
        this.id = 'odak';
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._bildirim = new Gio.Settings({schema_id: 'org.gnome.desktop.notifications'});
        this._id = this._bildirim.connect('changed::show-banners', () => this._yaz());
        this._yaz();
    }

    disable() {
        if (this._id)
            this._bildirim.disconnect(this._id);
        this._id = 0;
        this._manager?.remove(`${this.id}:dnd`);
        this._manager = null;
    }

    _yaz() {
        if (!this._manager)
            return;
        if (this._bildirim.get_boolean('show-banners')) {
            this._manager.remove(`${this.id}:dnd`);
            return;
        }
        this._manager.update(createActivity({id: `${this.id}:dnd`, providerId: this.id, tier: 'ambient', slot: 'either',
            priority: oncelik(this._settings, this.id), glyph: 'weather-clear-night-symbolic', label: _('Rahatsız etme açık'),
            sublabel: _('Bildirim afişleri gösterilmiyor'),
            data: {kartta: true, eylemler: [
                {ikon: 'notifications-symbolic', ipucu: _('Rahatsız etmeyi kapat'), fn: () => this._bildirim.set_boolean('show-banners', true)},
            ]}}));
    }
}
