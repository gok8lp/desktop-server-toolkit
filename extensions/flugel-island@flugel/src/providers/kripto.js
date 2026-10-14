// FLUGEL Island — kripto: BTC ya da ETH 24 saatte eşikten (varsayılan %5) fazla değişirse canlı etkinlik;
// fiyat alarmları: izlenen fiyat eşiği geçince kapsülde kalıcı uyarı (+ ses), alarm tek seferlik silinir.
import {createActivity, _now} from '../activity.js';
import {oncelik} from './provider-base.js';
import {para} from '../ortak.js';
import {KriptoOlay, alarmlar, birimli} from '../kripto-ortak.js';
import {_, f} from '../dil.js';

export class KriptoProvider {
    constructor(ortam) {
        this.id = 'kripto';
        this._ortam = ortam;
        this._gizlenen = null;
        this._calan = new Set();
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._ortam.veri.abone('canli', d => this._yaz(d));
        this._alarmAbone = this._ortam.veri.abone('kizle', d => this._alarmDenetle(d));
    }

    disable() {
        this._abonelik?.();
        this._alarmAbone?.();
        this._manager?.remove(`${this.id}:hareket`);
        for (const id of this._calan)
            this._manager?.remove(`${this.id}:alarm:${id}`);
        this._calan.clear();
        this._manager = null;
    }

    _alarmDenetle(d) {
        if (!this._manager || !d?.koinler)
            return;
        const fiyat = new Map(d.koinler.filter(k => Number.isFinite(k.fiyat)).map(k => [k.s, k]));
        const hepsi = alarmlar(this._settings);
        const calan = hepsi.filter(a => {
            const k = fiyat.get(a.s);
            return k && (a.yon === 'ust' ? k.fiyat >= a.fiyat : k.fiyat <= a.fiyat);
        });
        if (!calan.length)
            return;
        // tek seferlik: çalan alarmlar listeden çıkar
        const kalan = hepsi.filter(a => !calan.includes(a));
        this._settings.set_string('kripto-alarmlar', JSON.stringify(kalan));
        for (const a of calan) {
            const k = fiyat.get(a.s);
            const id = `${this.id}:alarm:${a.id}`;
            this._calan.add(a.id);
            this._manager.update(createActivity({
                id, providerId: this.id, tier: 'persistent', slot: 'either',
                priority: oncelik(this._settings, this.id, 40),
                glyph: 'alarm-symbolic',
                label: a.yon === 'ust' ? f(_('%s %s üstüne çıktı'), a.s, birimli(a.fiyat, k)) : f(_('%s %s altına indi'), a.s, birimli(a.fiyat, k)),
                sublabel: f(_('şimdi %s'), birimli(k.fiyat, k)),
                data: {kisa: a.s, renk: '#7fb2ff', eylemler: [
                    {ikon: 'utilities-system-monitor-symbolic', ipucu: _('Grafiği aç'), fn: () => {
                        this._ortam.sekmeAc('kripto');
                        KriptoOlay.detayIste?.(a.s);
                    }},
                ], kapat: () => {
                    this._calan.delete(a.id);
                    this._manager?.remove(id);
                }},
            }));
        }
        // ada bir an açılıp alarmı gösterir, sonra kapsülde kalıcı uyarı olarak durur
        const a = calan[0], k = fiyat.get(a.s), now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:alarm-flas`, providerId: this.id, tier: 'transient', slot: 'either',
            priority: oncelik(this._settings, this.id, 60), glyph: 'alarm-symbolic',
            label: f(_('Fiyat alarmı: %s %s'), a.s, birimli(k.fiyat, k)),
            startedAt: now, expiresAt: now + 5000000,
            data: {renk: '#7fb2ff'},
        }));
        if (this._settings.get_boolean('kripto-alarm-ses'))
            global.display.get_sound_player().play_from_theme('alarm-clock-elapsed', _('Kripto alarmı'), null);
    }

    _yaz(d) {
        const esik = this._settings.get_double('kripto-esik');
        const hareket = [['BTC', d?.btc, 'coin-btc'], ['ETH', d?.eth, 'coin-eth']]
            .filter(([, c]) => c && Math.abs(c.degisim ?? 0) >= esik)
            .sort((x, y) => Math.abs(y[1].degisim) - Math.abs(x[1].degisim))[0];
        // kapatılınca aynı yöndeki hareket bir sonraki eşik katına kadar tekrar gösterilmez
        const kademe = hareket ? `${hareket[0]}${Math.sign(hareket[1].degisim) * Math.floor(Math.abs(hareket[1].degisim) / esik)}` : null;
        if (!hareket || kademe === this._gizlenen) {
            this._manager.remove(`${this.id}:hareket`);
            return;
        }
        const [ad, c, ik] = hareket;
        const ok = c.degisim >= 0 ? '▲' : '▼';
        this._manager.update(createActivity({
            id: `${this.id}:hareket`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: ik,
            label: `${ad} ${ok}${Math.abs(c.degisim).toFixed(1)}%`,
            sublabel: f(_('%s $ · 24 saat'), para(c.fiyat, 0)),
            data: {kisa: `${ok}${Math.abs(c.degisim).toFixed(0)}%`, eylemler: [
                {ikon: ik, ipucu: _('Kripto sekmesi'), fn: () => this._ortam.sekmeAc('kripto')},
            ], kapat: () => {
                this._gizlenen = kademe;
                this._manager?.remove(`${this.id}:hareket`);
            }},
        }));
    }
}
