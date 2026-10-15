// FLUGEL Island — hakemlik: bugün görevin varsa ya da maç yaklaşıyorsa (varsayılan 2 saat) canlı etkinlik.
import GLib from 'gi://GLib';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {SARI, bugun} from '../ortak.js';
import {canliMi, favoriVar, macAnahtar, onemSirala} from '../mac-ortak.js';
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
        this._cs2Abone = this._ortam.veri.abone('cs2', d => this._cs2Yaz(d));
        this._raundlar = new Map();
        this._ayarId = settings.connect('changed', (_s, k) => {
            if (['mac-favoriler', 'mac-ozel', 'cs2-takip', 'cs2-min-yildiz', 'cs2-etkin', 'mac-canli-etkinlik'].includes(k)) {
                this._canliYaz(this._ortam.veri.son('maclar'));
                this._cs2Yaz(this._ortam.veri.son('cs2'));
            }
        });
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
        this._cs2Abone?.();
        if (this._ayarId)
            this._settings.disconnect(this._ayarId);
        this._ayarId = 0;
        this._manager?.remove(`${this.id}:canli`);
        this._manager?.remove(`${this.id}:cs2`);
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
        // favori takım → özel maç → yıldız (derbi dahil) sırasıyla en önemli canlı maç
        const canlilar = onemSirala((d?.bugun ?? []).flatMap(l => l.maclar.filter(m => m.durum === 'in').map(m => ({...m, lig: l.lig}))),
            this._settings.get_strv('mac-favoriler'), new Set(this._settings.get_strv('mac-ozel')));
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

    // canlı CS2: kapsülde raund skoru, harita ve seri skoru; son raundu alan takım bir an vurgulanır
    _cs2Yaz(d) {
        if (!this._manager)
            return;
        const id = `${this.id}:cs2`;
        const fav = this._settings.get_strv('mac-favoriler');
        const ozel = new Set(this._settings.get_strv('mac-ozel'));
        const takip = this._settings.get_int('cs2-takip');
        const minY = this._settings.get_int('cs2-min-yildiz');
        const canli = (d?.canli ?? []).filter(canliMi);
        const m = canli.find(x => x.id === takip) ??
            onemSirala(canli.filter(x => favoriVar(fav, x) || ozel.has(macAnahtar(x)) || (x.yildiz ?? 0) >= minY), fav, ozel)[0];
        if (!this._settings.get_boolean('cs2-etkin') || !this._settings.get_boolean('mac-canli-etkinlik') || !m) {
            this._manager.remove(id);
            return;
        }
        const t1 = m.takim1 ?? {}, t2 = m.takim2 ?? {};
        const r1 = t1.raund ?? 0, r2 = t2.raund ?? 0;
        // raund kazananı: önceki skora göre hangi taraf arttı (harita değişince sıfırlanır)
        const once = this._raundlar.get(m.id);
        // harita değişince önceki haritanın vurgusu taşınmaz
        const ayniHarita = once && once.harita === m.harita_no;
        let vurgu = ayniHarita ? once.vurgu : null, vurguNo = once?.vurguNo ?? 0;
        if (ayniHarita && (r1 !== once.r1 || r2 !== once.r2)) {
            vurgu = r1 > once.r1 && r2 === once.r2 ? 'ev' : (r2 > once.r2 && r1 === once.r1 ? 'dep' : null);
            vurguNo++;
        }
        this._raundlar.set(m.id, {r1, r2, harita: m.harita_no, vurgu, vurguNo});
        const seri = `${t1.harita ?? 0}-${t2.harita ?? 0}`;
        const sonRaund = vurgu ? f(_('son raund: %s'), vurgu === 'ev' ? t1.ad : t2.ad) : null;
        this._manager.update(createActivity({
            id, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id, favoriVar(fav, m) || takip === m.id ? 35 : 25),
            glyph: 'input-gaming-symbolic',
            label: `${t1.ad} ${r1}–${r2} ${t2.ad}`,
            sublabel: [m.simdiki_harita, f(_('seri %s'), seri), sonRaund, m.etkinlik].filter(Boolean).join(' · '),
            data: {mac: {ev: t1.ad ?? '', dep: t2.ad ?? '', evLogo: t1.logo_yol ?? null, depLogo: t2.logo_yol ?? null,
                skor: `${r1} – ${r2}`, dakika: m.simdiki_harita ?? 'CS2', ek: seri, vurgu, vurguNo, vurguAnahtar: `${m.id}:${vurguNo}`},
            eylemler: [
                {ikon: 'input-gaming-symbolic', ipucu: _('Maçlar sekmesi'), fn: () => this._ortam.sekmeAc('basket')},
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
