// FLUGEL Island — hakemlik: bugün görevin varsa ya da maç yaklaşıyorsa (varsayılan 2 saat) canlı etkinlik.
import GLib from 'gi://GLib';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {SARI, bugun} from '../ortak.js';

export class BasketProvider {
    constructor(ortam) {
        this.id = 'basket';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._ortam.veri.abone('island', s => {
            this._gelecek = s?.basket?.gelecek ?? this._gelecek ?? [];
            this._yaz();
        });
        // geri sayım dakikada bir (sadece bugün maç varken bir şey değişir)
        this._dakikaId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 60, () => {
            this._yaz();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        this._abonelik?.();
        if (this._dakikaId)
            GLib.source_remove(this._dakikaId);
        this._dakikaId = 0;
        this._manager?.remove(`${this.id}:mac`);
        this._manager = null;
    }

    _yaz() {
        if (!this._manager)
            return;
        const b = bugun();
        const m = (this._gelecek ?? []).find(x => x.tarih === b);
        if (!m) {
            this._manager.remove(`${this.id}:mac`);
            return;
        }
        const [sa, dk] = String(m.saat ?? '').split(':').map(Number);
        const simdi = GLib.DateTime.new_now_local();
        const kalanDk = Number.isFinite(sa) ? (sa * 60 + (dk || 0)) - (simdi.get_hour() * 60 + simdi.get_minute()) : null;
        if (kalanDk !== null && kalanDk < -150) {
            // maç bitti sayılır
            this._manager.remove(`${this.id}:mac`);
            return;
        }
        const yakin = kalanDk !== null && kalanDk <= this._settings.get_int('basket-yakin-dk');
        let kisa = m.saat ?? '';
        if (yakin && kalanDk > 0)
            kisa = kalanDk >= 60 ? `${Math.floor(kalanDk / 60)}sa ${kalanDk % 60}dk` : `${kalanDk}dk`;
        else if (yakin)
            kisa = 'şimdi';
        this._manager.update(createActivity({
            id: `${this.id}:mac`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id, yakin ? 60 : 0),
            glyph: 'basket',
            label: `Maç ${m.saat ?? 'bugün'} · ${m.gorev ?? 'görev'}`,
            sublabel: `${m.ev ?? '?'} — ${m.dep ?? '?'} · ${m.salon ?? ''}`,
            data: {renk: yakin ? SARI : null, kisa, eylemler: [
                {ikon: 'basket', ipucu: 'Basket sekmesi', fn: () => this._ortam.sekmeAc('basket')},
            ]},
        }));
    }
}
