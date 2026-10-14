// FLUGEL Island — "Kripto" sekmesi: dolar/euro kuru ve kripto paralar (FLUGEL v1 panelinden).
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {bilgiSatiri, menuOgesi, baslik, para, degisim, soluk} from '../ortak.js';

export const KOIN_IKON = {BTC: 'coin-btc', ETH: 'coin-eth', SOL: 'coin-sol', BNB: 'coin-bnb', XRP: 'coin-xrp',
    DOGE: 'coin-doge', AVAX: 'coin-avax', ADA: 'coin-ada'};

export class KriptoSayfa extends Sayfa {
    constructor({veri}) {
        super();
        this._veri = veri;
        this._ozet = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._ozet);
        baslik(this, 'Kripto paralar');
        this._liste = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._liste);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this, 'Şimdi yenile', () => {
            veri.yenile('canli', true);
            veri.yenile('kripto', true);
        }, 'view-refresh-symbolic');
        menuOgesi(this, 'CoinMarketCap', 'xdg-open https://coinmarketcap.com', 'send-to-symbolic');
        menuOgesi(this, 'TradingView BTC grafiği', 'xdg-open https://www.tradingview.com/chart/?symbol=BTCUSDT', 'send-to-symbolic');
        this._aboneler = [
            veri.abone('canli', () => this.gorunurse(() => this._ozetYaz())),
            veri.abone('kripto', () => this.gorunurse(() => this._listeYaz())),
        ];
    }

    goster() {
        this._ozetYaz();
        this._listeYaz();
        this._veri.tazele('kripto', 60);
    }

    _ozetYaz() {
        if (!this.degisti('canli', this._veri.son('canli')))
            return;
        const d = this._veri.son('canli') ?? {};
        this._ozet.removeAll();
        const satir = (s, k, ik) => bilgiSatiri(this._ozet, s ? `<b>${k} ${para(s.fiyat, 0)} $</b>  ${soluk(degisim(s.degisim))}` : `${k} …`, ik);
        satir(d.btc, 'BTC', 'coin-btc');
        satir(d.eth, 'ETH', 'coin-eth');
        bilgiSatiri(this._ozet, d.usdtry ? `<b>1 $ = ${d.usdtry.fiyat.toFixed(2)} ₺</b>  ${soluk(degisim(d.usdtry.degisim))}` : '1 $ = …', 'money-symbolic');
        bilgiSatiri(this._ozet, d.eurtry ? `<b>1 € = ${d.eurtry.fiyat.toFixed(2)} ₺</b>  ${soluk(degisim(d.eurtry.degisim))}` : '1 € = …', 'money-symbolic');
        bilgiSatiri(this._ozet, `<small>${soluk(`anlık · ${d.zaman || ''}${d.hata ? ' · alınamadı' : ''}`)}</small>`);
    }

    _listeYaz() {
        if (!this.degisti('kripto', this._veri.son('kripto')))
            return;
        const d = this._veri.son('kripto');
        this._liste.removeAll();
        if (!d) {
            bilgiSatiri(this._liste, soluk('Yükleniyor…'));
            return;
        }
        if (!d.coinler || !d.coinler.length) {
            bilgiSatiri(this._liste, soluk('Fiyatlar alınamadı'));
            return;
        }
        for (const c of d.coinler) {
            bilgiSatiri(this._liste,
                `<b>${c.sym}</b>  <tt>${para(c.usd).padStart(10)} $  ${para(c.try, c.try >= 100 ? 0 : 2).padStart(12)} ₺</tt>  ${soluk(degisim(c.degisim))}`,
                KOIN_IKON[c.sym]);
        }
        bilgiSatiri(this._liste, `<small>${soluk(`Kaynak: ${d.kaynak || '?'} · ${d.zaman || ''}${d.eski ? ' · eski veri' : ''}`)}</small>`);
    }

    destroy() {
        this._aboneler.forEach(f => f());
        super.destroy();
    }
}
