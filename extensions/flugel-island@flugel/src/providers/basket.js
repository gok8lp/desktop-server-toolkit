// FLUGEL Island — hakemlik: bugün görevin varsa ya da maç yaklaşıyorsa (varsayılan 2 saat) canlı etkinlik.
import GLib from 'gi://GLib';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {SARI, bugun} from '../ortak.js';
import {_, f} from '../dil.js';

export class BasketProvider {
    constructor(ortam) {
        this.id = 'basket';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._macAbone = this._ortam.veri.abone('maclar', d => this._canliYaz(d));
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
        this._macAbone?.();
        this._manager?.remove(`${this.id}:canli`);
        if (this._dakikaId)
            GLib.source_remove(this._dakikaId);
        this._dakikaId = 0;
        this._manager?.remove(`${this.id}:mac`);
        this._manager = null;
    }

    // canlı maç (sunucudaki Maçlar verisi): kapsülde skor
    _canliYaz(d) {
        if (!this._manager)
            return;
        const id = `${this.id}:canli`;
        const canlilar = (d?.bugun ?? []).flatMap(l => l.maclar.filter(m => m.durum === 'in').map(m => ({...m, lig: l.lig})));
        if (!this._settings.get_boolean('mac-canli-etkinlik') || !canlilar.length) {
            this._manager.remove(id);
            return;
        }
        const m = canlilar[0];
        this._manager.update(createActivity({
            id, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id, 30),
            glyph: /NBA/.test(m.lig) ? 'basket' : 'emblem-default-symbolic',
            label: `${m.ev?.ad} ${m.ev?.skor ?? ''}–${m.dep?.skor ?? ''} ${m.dep?.ad}`,
            sublabel: `${m.lig}${m.detay ? ` · ${m.detay}` : ''}${canlilar.length > 1 ? f(_(' · +%s canlı'), canlilar.length - 1) : ''}`,
            data: {mac: {ev: m.ev?.ad ?? '', dep: m.dep?.ad ?? '', evLogo: m.ev?.logo_yol ?? null, depLogo: m.dep?.logo_yol ?? null,
                skor: `${m.ev?.skor ?? '0'} – ${m.dep?.skor ?? '0'}`, dakika: (m.detay ?? '').replace(/ - .*$/, ''),
                ek: canlilar.length > 1 ? `+${canlilar.length - 1}` : ''}, eylemler: [
                {ikon: 'top', ipucu: _('Maçlar sekmesi'), fn: () => this._ortam.sekmeAc('basket')},
            ]},
        }));
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
            kisa = kalanDk >= 60 ? f(_('%ssa %sdk'), Math.floor(kalanDk / 60), kalanDk % 60) : f(_('%sdk'), kalanDk);
        else if (yakin)
            kisa = _('şimdi');
        this._manager.update(createActivity({
            id: `${this.id}:mac`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id, yakin ? 60 : 0),
            glyph: 'basket',
            label: f(_('Maç %s · %s'), m.saat ?? _('bugün'), m.gorev ?? _('görev')),
            sublabel: `${m.ev ?? '?'} — ${m.dep ?? '?'} · ${m.salon ?? ''}`,
            data: {renk: yakin ? SARI : null, kisa, eylemler: [
                {ikon: 'basket', ipucu: _('Basket sekmesi'), fn: () => this._ortam.sekmeAc('basket')},
            ]},
        }));
    }
}
