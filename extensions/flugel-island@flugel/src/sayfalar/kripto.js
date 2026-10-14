// FLUGEL Island — "Kripto ve döviz" sekmesi: BTC, ETH, USD/TL, EUR/TL kartları (simge, fiyat, 24 saatlik
// değişim, küçük çizgi grafik). Karta tıklayınca büyük grafik: 24 saat / 7 gün, en yüksek ve en düşük.
// Altında diğer kripto paralar (sadece dolar fiyatı; TL sütunu yok). Veri: ust-panel-veri grafik / kripto.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import {Sayfa} from './sayfa.js';
import {calistir, para} from '../ortak.js';
import {Karo, Izgara, bolum, dugme} from '../bilesenler.js';
import {Grafik} from '../grafik.js';

export const KOIN_IKON = {BTC: 'coin-btc', ETH: 'coin-eth', SOL: 'coin-sol', BNB: 'coin-bnb', XRP: 'coin-xrp',
    DOGE: 'coin-doge', AVAX: 'coin-avax', ADA: 'coin-ada'};
const SIMGE = {BTC: '₿', ETH: 'Ξ', USD: '$', EUR: '€'};
const BIRIM = {BTC: '$', ETH: '$', USD: '₺', EUR: '₺'};
const ok = d => (d === null || d === undefined ? '' : `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(2)}%`);
const fiyat = (v, sembol) => `${para(v, sembol === 'USD' || sembol === 'EUR' ? 2 : 0)} ${BIRIM[sembol] ?? '$'}`;

export class KriptoSayfa extends Sayfa {
    constructor({veri, ayarlar}) {
        super();
        this._veri = veri;
        this._ayar = ayarlar;
        this._donem = '24s';
        this._kartlar = new St.BoxLayout({style_class: 'flugel-kripto-kartlar', x_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(bolum('Kripto ve döviz', this._kartlar, {sag: dugme('view-refresh-symbolic', 'Şimdi yenile',
            () => {
                veri.yenile('grafik', true);
                veri.yenile('kripto', true);
            }, {stil: 'flugel-dugme flugel-dugme-kucuk'})}));

        // büyük grafik paneli
        this._buyuk = new St.BoxLayout({style_class: 'flugel-buyuk-grafik', orientation: Clutter.Orientation.VERTICAL, visible: false});
        const ust = new St.BoxLayout({style_class: 'flugel-buyuk-ust'});
        this._buyukBaslik = new St.Label({style_class: 'flugel-buyuk-baslik', x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        ust.add_child(this._buyukBaslik);
        this._donemDugme = {};
        for (const [d, ad] of [['24s', '24 saat'], ['7g', '7 gün']]) {
            const b = new St.Button({label: ad, style_class: 'flugel-cip', can_focus: true});
            b.connect('clicked', () => {
                this._donem = d;
                this._buyukCiz();
            });
            this._donemDugme[d] = b;
            ust.add_child(b);
        }
        this._buyuk.add_child(ust);
        const gw = ayarlar.get_int('kart-genislik') - 76;
        this._buyukGrafik = new Grafik({genislik: gw, yukseklik: 150, izgara: true});
        this._buyuk.add_child(this._buyukGrafik.actor);
        this._buyukAlt = new St.Label({style_class: 'flugel-buyuk-alt'});
        this._buyuk.add_child(this._buyukAlt);
        this.actor.add_child(this._buyuk);

        this._digerIzgara = new Izgara({genislik: ayarlar.get_int('kart-genislik') - 48, karoGenisligi: 96});
        this.actor.add_child(bolum('Diğer kripto paralar', this._digerIzgara));
        const baglantilar = new Izgara({sutun: 2});
        baglantilar.ekle(new Karo({ikon: 'send-to-symbolic', etiket: 'CoinMarketCap', ipucu: 'coinmarketcap.com',
            eylem: () => this._ac('https://coinmarketcap.com')}));
        baglantilar.ekle(new Karo({ikon: 'send-to-symbolic', etiket: 'TradingView', ipucu: 'BTC grafiği (TradingView)',
            eylem: () => this._ac('https://www.tradingview.com/chart/?symbol=BTCUSDT')}));
        this.actor.add_child(bolum('', baglantilar));

        this._aboneler = [
            veri.abone('grafik', () => this.gorunurse(() => this._kartlarYaz())),
            veri.abone('kripto', () => this.gorunurse(() => this._digerYaz())),
        ];
        this._ayarId = ayarlar.connect('changed', (_s, k) => {
            if (k === 'kripto-varliklar' || k === 'kripto-renk') {
                this._cizilen?.clear();
                this.gorunurse(() => this._kartlarYaz());
            }
        });
    }

    _ac(url) {
        this.close();
        calistir(`xdg-open ${url}`);
    }

    goster() {
        this._kartlarYaz();
        this._digerYaz();
        this._veri.tazele('grafik', 300);
        this._veri.tazele('kripto', 120);
    }

    _kartlarYaz() {
        const d = this._veri.son('grafik');
        if (!this.degisti('grafik', d))
            return;
        this._kartlar.destroy_all_children();
        if (!d || d.hata) {
            this._kartlar.add_child(new St.Label({text: d ? 'Fiyatlar alınamadı' : 'Yükleniyor…', style_class: 'flugel-soluk'}));
            return;
        }
        const secili = new Set(this._ayar.get_strv('kripto-varliklar'));
        const renkli = this._ayar.get_boolean('kripto-renk');
        this._varliklar = d.varliklar.filter(v => secili.has(v.sembol));
        for (const v of this._varliklar) {
            const kart = new St.Button({style_class: 'flugel-kripto-kart', can_focus: true});
            const k = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
            const ust = new St.BoxLayout({style: 'spacing: 6px;'});
            ust.add_child(new St.Label({text: SIMGE[v.sembol] ?? v.sembol, style_class: 'flugel-kripto-simge', y_align: Clutter.ActorAlign.CENTER}));
            ust.add_child(new St.Label({text: v.ad, style_class: 'flugel-kripto-ad', y_align: Clutter.ActorAlign.CENTER}));
            k.add_child(ust);
            k.add_child(new St.Label({text: fiyat(v.fiyat, v.sembol), style_class: 'flugel-kripto-fiyat'}));
            const deg = new St.Label({text: ok(v.degisim_24s), style_class: 'flugel-kripto-degisim'});
            if (renkli && Number.isFinite(v.degisim_24s))
                deg.style = `color: ${v.degisim_24s >= 0 ? '#8fd6a0' : '#f07b7b'};`;
            k.add_child(deg);
            const g = new Grafik({genislik: 136, yukseklik: 34});
            g.ayarla(v.seri_24s, {renkli});
            k.add_child(g.actor);
            kart.set_child(k);
            kart.connect('clicked', () => {
                this._acik = this._acik === v.sembol ? null : v.sembol;
                this._buyukCiz();
            });
            this._kartlar.add_child(kart);
        }
        if (d.eski)
            this._kartlar.add_child(new St.Label({text: 'eski veri', style_class: 'flugel-soluk', y_align: Clutter.ActorAlign.END}));
        this._buyukCiz();
    }

    _buyukCiz() {
        const v = this._varliklar?.find(x => x.sembol === this._acik);
        this._buyuk.visible = !!v;
        if (!v)
            return;
        for (const [d, b] of Object.entries(this._donemDugme)) {
            if (d === this._donem)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        const seri = this._donem === '7g' && v.seri_7g?.length ? v.seri_7g : v.seri_24s;
        if (!seri?.length) {
            this._buyuk.hide();
            return;
        }
        this._buyukGrafik.ayarla(seri, {renkli: this._ayar.get_boolean('kripto-renk')});
        const yuksek = Math.max(...seri), dusuk = Math.min(...seri);
        const degisim = seri.length > 1 ? 100 * (seri[seri.length - 1] - seri[0]) / seri[0] : null;
        this._buyukBaslik.text = `${SIMGE[v.sembol] ?? ''} ${v.ad} · ${fiyat(v.fiyat, v.sembol)}`;
        this._buyukAlt.text = `En yüksek ${fiyat(yuksek, v.sembol)}   ·   En düşük ${fiyat(dusuk, v.sembol)}   ·   ${this._donem === '7g' ? '7 gün' : '24 saat'} ${ok(degisim)}`;
    }

    _digerYaz() {
        const d = this._veri.son('kripto');
        if (!this.degisti('kripto', d))
            return;
        this._digerIzgara.temizle();
        for (const c of (d?.coinler ?? []).filter(x => !['BTC', 'ETH'].includes(x.sym))) {
            this._digerIzgara.ekle(new Karo({ikon: KOIN_IKON[c.sym] ?? 'coin-btc', etiket: `${c.sym} ${para(c.usd)}$`,
                ipucu: {baslik: `${c.sym}: ${para(c.usd)} $`, ayrinti: `24 saat ${ok(c.degisim)} · kaynak ${d.kaynak ?? '?'}`}}));
        }
    }

    destroy() {
        this._aboneler.forEach(f => f());
        this._ayar.disconnect(this._ayarId);
        super.destroy();
    }
}
