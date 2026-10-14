// FLUGEL Island — panik modu canlı etkinliği: panikle gizlenen pencereler varken görünür, tek tıkla geri alınır.
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {SARI} from '../ortak.js';
import {_} from '../dil.js';

export class PanikProvider {
    constructor(panik) {
        this.id = 'panik';
        this._panik = panik;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._panik.abone(aktif => this._yaz(aktif));
        this._yaz(this._panik.aktif);
    }

    disable() {
        this._abonelik?.();
        this._manager?.remove(`${this.id}:aktif`);
        this._manager = null;
    }

    _yaz(aktif) {
        if (!aktif) {
            this._manager.remove(`${this.id}:aktif`);
            return;
        }
        this._manager.update(createActivity({
            id: `${this.id}:aktif`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: 'panik', label: _('Panik modu'), sublabel: _('pencereler gizli, ses kapalı'),
            data: {renk: SARI, kisa: 'gizli', eylemler: [
                {ikon: 'edit-undo-symbolic', ipucu: _('Geri al: pencereleri ve sesi getir'), fn: () => this._panik.geriAl()},
            ]},
        }));
    }
}
