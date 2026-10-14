// FLUGEL Island — kripto: BTC ya da ETH 24 saatte eşikten (varsayılan %5) fazla değişirse canlı etkinlik.
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {para} from '../ortak.js';

export class KriptoProvider {
    constructor(ortam) {
        this.id = 'kripto';
        this._ortam = ortam;
        this._gizlenen = null;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._ortam.veri.abone('canli', d => this._yaz(d));
    }

    disable() {
        this._abonelik?.();
        this._manager?.remove(`${this.id}:hareket`);
        this._manager = null;
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
            sublabel: `${para(c.fiyat, 0)} $ · 24 saat`,
            data: {kisa: `${ok}${Math.abs(c.degisim).toFixed(0)}%`, eylemler: [
                {ikon: ik, ipucu: 'Kripto sekmesi', fn: () => this._ortam.sekmeAc('kripto')},
            ], kapat: () => {
                this._gizlenen = kademe;
                this._manager?.remove(`${this.id}:hareket`);
            }},
        }));
    }
}
