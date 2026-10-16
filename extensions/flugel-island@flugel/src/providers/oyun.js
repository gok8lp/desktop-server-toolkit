// FLUGEL Island — oyun duyuruları: istek listesindeki bir oyunun Steam fiyatı düşünce, yeni PS Plus aylık oyunları
// duyurulunca ve Epic'te yeni bir oyun ücretsiz olunca kapsülde uyarı (ada kısa süre açılır, sonra kalıcı durur).
// İlk açılışta mevcut durum sessizce kaydedilir; sadece sonradan gelen yenilikler duyurulur.
import GLib from 'gi://GLib';
import {createActivity, _now} from '../activity.js';
import {oncelik} from './provider-base.js';
import {calistir} from '../ortak.js';
import {fiyatMetni, gorulen, gorulenYaz, istekListesi, sonFiyatYaz} from '../oyun-ortak.js';
import {_, f} from '../dil.js';

export class OyunProvider {
    constructor(ortam) {
        this.id = 'oyun';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        const v = this._ortam.veri;
        this._aboneler = [
            v.abone('oyuntakip', d => this._fiyatlar(d)),
            v.abone('psplus', d => this._psplus(d)),
            v.abone('oyunlar', d => this._epic(d)),
        ];
    }

    disable() {
        this._aboneler?.forEach(fn => fn());
        this._aboneler = null;
        this._manager = null;
    }

    _duyur(id, glyph, label, sublabel, link, renk = '#8fd6a0') {
        if (!this._manager)
            return;
        const now = _now();
        this._manager.push(createActivity({id: `${this.id}:flas`, providerId: this.id, tier: 'transient', slot: 'either',
            priority: oncelik(this._settings, this.id, 30), glyph, label, startedAt: now, expiresAt: now + 6000000, data: {renk}}));
        this._manager.update(createActivity({id: `${this.id}:${id}`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id), glyph, label, sublabel,
            data: {renk, kartta: true, eylemler: [
                {ikon: 'send-to-symbolic', ipucu: _('Aç'), fn: () => calistir(`xdg-open ${GLib.shell_quote(link)}`)},
                {ikon: 'input-gaming-symbolic', ipucu: _('Oyunlar sekmesi'), fn: () => this._ortam.sekmeAc('oyun')},
            ], kapat: () => this._manager?.remove(`${this.id}:${id}`)}}));
    }

    // istek listesi: Steam fiyatı bir öncekinden düşükse uyar
    _fiyatlar(d) {
        if (!d?.oyunlar)
            return;
        for (const o of istekListesi(this._settings)) {
            const st = d.oyunlar[o.id]?.steam;
            if (!st || !Number.isFinite(st.fiyat))
                continue;
            const once = o.son?.steam;
            if (Number.isFinite(once) && st.fiyat < once - 0.009) {
                this._duyur(`dusus:${o.id}`, 'emblem-ok-symbolic', f(_('Fiyat düştü: %s'), o.ad),
                    [`${fiyatMetni(once, st.para)} → ${fiyatMetni(st.fiyat, st.para)}`, st.indirim ? `-%${st.indirim}` : null, 'Steam']
                        .filter(Boolean).join(' · '), `https://store.steampowered.com/app/${o.id}`);
            }
            if (once !== st.fiyat)
                sonFiyatYaz(this._settings, o.id, {steam: st.fiyat});
        }
    }

    _psplus(d) {
        const v = d?.aylik;
        if (!v?.link)
            return;
        const g = gorulen(this._settings).psplus;
        if (!g) {
            gorulenYaz(this._settings, 'psplus', [v.link]);
            return;
        }
        if (g.includes(v.link))
            return;
        gorulenYaz(this._settings, 'psplus', [...g, v.link]);
        this._duyur('psplus', 'input-gaming-symbolic', _('Yeni PS Plus aylık oyunları'),
            (v.oyunlar ?? []).map(o => o.ad).join(', '), v.link, '#7fb2ff');
    }

    _epic(d) {
        const simdi = (d?.epic ?? []).filter(o => /şimdi|now/i.test(o.durum ?? '')).map(o => o.ad);
        if (!d?.epic)
            return;
        const g = gorulen(this._settings).epic;
        if (!g) {
            gorulenYaz(this._settings, 'epic', simdi);
            return;
        }
        const yeni = simdi.filter(a => !g.includes(a));
        if (!yeni.length)
            return;
        gorulenYaz(this._settings, 'epic', [...g, ...yeni]);
        const o = d.epic.find(x => x.ad === yeni[0]);
        this._duyur('epic', 'emblem-favorite-symbolic', f(_('Epic\'te ücretsiz: %s'), yeni.join(', ')), _('Sınırlı süre · hesabına ekle'),
            o?.link ?? 'https://store.epicgames.com/tr/free-games', '#e8c66b');
    }
}
