// FLUGEL Island — "Oyunlar" sekmesi (sunucudaki FLUGEL Akış "Oyun fiyatları" sayfasının adadaki hali):
//   Ara        : oyun adıyla fiyat arama (Steam Türkiye + 30'dan fazla PC mağazasında en ucuz, CheapShark)
//   PS Plus    : bu ayın Essential oyunları ve Extra/Premium kataloğu (resmi PlayStation Blog duyurusu)
//   Ücretsiz   : Epic Games'te şimdi ve yakında ücretsiz olanlar
//   Fırsatlar  : PC mağazalarındaki en iyi indirimler (Metacritic / Steam puanlı)
//   Steam      : Steam indirimdekiler, çok satanlar, yeni çıkanlar, öneriler
// Veri: ust-panel-veri oyunlar | psplus | oyun-ara (görseller diskte önbellekli). Tıklayınca mağaza sayfası açılır.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Sayfa} from './sayfa.js';
import {VERI, calistir, jsonAl} from '../ortak.js';
import {Izgara, ResimKaro, bolum, dugme, ipucuBagla, yayliBasma} from '../bilesenler.js';
import {_, f} from '../dil.js';

const KATEGORILER = () => [['psplus', 'PS Plus'], ['epic', _('Ücretsiz')], ['firsatlar', _('Fırsatlar')], ['indirim', _('Steam indirim')],
    ['cok_satan', _('Çok satanlar')], ['yeni', _('Yeni çıkanlar')], ['oneri', _('Öneriler')]];
const para = (v, birim = 'USD') => (Number.isFinite(v) ? (v === 0 ? _('Ücretsiz') : `${v.toFixed(2)} ${birim === 'USD' ? '$' : birim === 'TRY' ? '₺' : birim}`) : '');

export class OyunSayfa extends Sayfa {
    constructor({ayarlar}) {
        super();
        this._ayar = ayarlar;
        this._kat = 'psplus';
        this._iptal = new Gio.Cancellable();
        this._gw = ayarlar.get_int('kart-genislik') - 48;

        // arama
        const ara = new St.BoxLayout({style_class: 'flugel-oyun-ara', x_expand: true});
        this._giris = new St.Entry({style_class: 'flugel-arama', hint_text: _('Oyun ara: Steam TR ve 30+ PC mağazasında fiyat karşılaştır…'),
            can_focus: true, x_expand: true});
        this._giris.clutter_text.connect('button-press-event', () => {
            this._modal(true);
            this._giris.grab_key_focus();
            return Clutter.EVENT_PROPAGATE;
        });
        this._giris.clutter_text.connect('activate', () => this._ara());
        ara.add_child(this._giris);
        ara.add_child(dugme('system-search-symbolic', _('Ara'), () => this._ara(), {stil: 'flugel-dugme flugel-dugme-kucuk'}));
        this.actor.add_child(ara);

        // kategoriler (iki satır)
        const cipler = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style: 'spacing: 6px;'});
        const satirlar = [new St.BoxLayout({style_class: 'flugel-cipler'}), new St.BoxLayout({style_class: 'flugel-cipler'})];
        satirlar.forEach(r => cipler.add_child(r));
        this._cip = {};
        KATEGORILER().forEach(([k, ad], i) => {
            const b = new St.Button({label: ad, style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
            b.connect('clicked', () => this._sec(k));
            this._cip[k] = b;
            satirlar[i < 4 ? 0 : 1].add_child(b);
        });
        this.actor.add_child(cipler);

        this._icerik = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style: 'spacing: 6px;'});
        this.actor.add_child(this._icerik);
    }

    goster() {
        this._sec(this._kat, false);
    }

    gizle() {
        this._modal(false);
    }

    kapandi() {
        super.kapandi();
        this._modal(false);
    }

    _modal(ac) {
        if (ac && !this._grab) {
            let kok = this.actor;
            while (kok && kok.name !== 'flugelIsland')
                kok = kok.get_parent();
            if (kok)
                this._grab = Main.pushModal(kok, {actionMode: Shell.ActionMode.POPUP});
        } else if (!ac && this._grab) {
            // odaktaki yazı kutusundan önce odak alınır (giriş yöntemi uyarı vermesin)
            global.stage.set_key_focus(null);
            Main.popModal(this._grab);
            this._grab = null;
        }
    }

    _ac(url) {
        if (!/^https?:\/\//.test(url ?? ''))
            return;
        this._modal(false);
        this.close();
        calistir(`xdg-open ${GLib.shell_quote(url)}`);
    }

    _cipYaz() {
        for (const [id, b] of Object.entries(this._cip)) {
            if (id === this._kat)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
    }

    async _sec(k, animasyon = true) {
        this._kat = k;
        this._cipYaz();
        const tur = k === 'psplus' ? 'psplus' : 'oyunlar';
        if (!this[`_${tur}`]) {
            this._bekle();
            const d = await jsonAl([VERI, tur], this._iptal);
            if (this._iptal.is_cancelled())
                return;
            this[`_${tur}`] = d;
        }
        if (this._kat === k)
            this._yaz(animasyon);
    }

    _bekle(metin = _('Yükleniyor…')) {
        this._icerik.destroy_all_children();
        this._icerik.add_child(new St.Label({text: metin, style_class: 'flugel-soluk'}));
    }

    _yaz(animasyon) {
        this._icerik.destroy_all_children();
        const k = this._kat;
        if (k === 'psplus')
            this._psPlusYaz();
        else if (k === 'epic')
            this._epicYaz();
        else
            this._listeYaz(this._oyunlar?.[k] ?? [], k === 'firsatlar');
        if (animasyon && St.Settings.get().enable_animations) {
            this._icerik.get_children().slice(0, 14).forEach((c, i) => {
                c.opacity = 0;
                c.translation_y = 8;
                c.ease({opacity: 255, translation_y: 0, delay: i * 30, duration: 220, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            });
        }
    }

    // ---------- PS Plus ----------
    _psPlusYaz() {
        const d = this._psplus;
        if (!d || d.hata) {
            this._bekle(_('PlayStation Blog\'a ulaşılamadı'));
            return;
        }
        for (const [anahtar, baslik] of [['aylik', _('Bu ayın oyunları · Essential')], ['katalog', _('Oyun kataloğu · Extra ve Premium')]]) {
            const v = d[anahtar];
            if (!v?.oyunlar?.length)
                continue;
            const izgara = new Izgara({sutun: 3, bosluk: 8});
            for (const o of v.oyunlar)
                izgara.ekle(this._kapak(o.resim_yol, o.ad, o.platform, v.link, 3));
            this._icerik.add_child(bolum(`${baslik} · ${v.tarih ?? ''}`, izgara, {sag: dugme('send-to-symbolic', _('Duyuruyu aç (PlayStation Blog)'),
                () => this._ac(v.link), {stil: 'flugel-dugme flugel-dugme-kucuk'})}));
        }
        const store = new St.Button({label: _('PS Store Türkiye · Fırsatlar'), style_class: 'flugel-cip', can_focus: true,
            x_align: Clutter.ActorAlign.START});
        store.connect('clicked', () => this._ac('https://store.playstation.com/tr-tr/pages/deals'));
        this._icerik.add_child(store);
    }

    // ---------- Epic ücretsiz ----------
    _epicYaz() {
        const l = this._oyunlar?.epic ?? [];
        if (!l.length) {
            this._bekle(this._oyunlar?.hata ? _('Sunucuya ulaşılamadı') : _('Şu an ücretsiz oyun yok'));
            return;
        }
        const izgara = new Izgara({sutun: 2, bosluk: 8});
        for (const o of l)
            izgara.ekle(this._kapak(o.resim_yol, o.ad, o.durum, o.link, 2));
        this._icerik.add_child(bolum('Epic Games', izgara));
    }

    // yatay kapaklı karo (PS Plus, Epic)
    // sutun: ızgaradaki sütun sayısı; kapak karonun genişliğini tam doldurur (16:9)
    _kapak(resim, ad, alt, link, sutun = 3) {
        const b = new St.Button({style_class: 'flugel-oyun-karo', can_focus: true, x_expand: true});
        const k = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style: 'spacing: 6px;'});
        const gen = Math.floor((this._gw - 8 * (sutun - 1)) / sutun) - 16;
        const g = new St.Bin({style_class: 'flugel-oyun-kapak',
            style: `${ResimKaro.stil(resim)} width: ${gen}px; height: ${Math.round(gen * 9 / 16)}px;`});
        k.add_child(g);
        const l = new St.Label({text: ad, style_class: 'flugel-oyun-ad'});
        l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        k.add_child(l);
        if (alt)
            k.add_child(new St.Label({text: alt, style_class: 'flugel-oyun-alt'}));
        b.set_child(k);
        yayliBasma(b, {basik: 0.95});
        b.connect('clicked', () => this._ac(link));
        ipucuBagla(b, {baslik: ad, ayrinti: [alt, _('Tıkla: sayfayı aç')].filter(Boolean).join(' · ')});
        return b;
    }

    // ---------- fiyat listeleri ----------
    _listeYaz(liste, firsat) {
        if (!liste.length) {
            this._bekle(this._oyunlar?.hata ? _('Sunucuya ulaşılamadı') : _('Liste boş'));
            return;
        }
        for (const o of liste.slice(0, 24))
            this._icerik.add_child(this._satir(o, firsat ? o.magaza : null));
    }

    _satir(o, magaza) {
        const b = new St.Button({style_class: 'flugel-oyun-satir', can_focus: true, x_expand: true});
        const k = new St.BoxLayout({x_expand: true, style: 'spacing: 12px;'});
        k.add_child(new St.Bin({style_class: 'flugel-oyun-kucuk', style: ResimKaro.stil(o.resim_yol), y_align: Clutter.ActorAlign.CENTER}));
        const m = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        const ad = new St.Label({text: o.ad ?? '', style_class: 'flugel-oyun-ad'});
        ad.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        m.add_child(ad);
        const alt = [magaza, o.metacritic ? f(_('Metacritic %s'), o.metacritic) : null, o.steam_puan ? f(_('Steam %%%s'), o.steam_puan) : null]
            .filter(Boolean).join(' · ');
        if (alt)
            m.add_child(new St.Label({text: alt, style_class: 'flugel-oyun-alt'}));
        k.add_child(m);
        const fiyat = new St.BoxLayout({style: 'spacing: 8px;', y_align: Clutter.ActorAlign.CENTER});
        if (o.indirim)
            fiyat.add_child(new St.Label({text: `-%${o.indirim}`, style_class: 'flugel-oyun-indirim', y_align: Clutter.ActorAlign.CENTER}));
        if (o.eski)
            fiyat.add_child(new St.Label({text: para(o.eski, o.para), style_class: 'flugel-oyun-eski', y_align: Clutter.ActorAlign.CENTER}));
        fiyat.add_child(new St.Label({text: para(o.fiyat, o.para), style_class: 'flugel-oyun-fiyat', y_align: Clutter.ActorAlign.CENTER}));
        k.add_child(fiyat);
        b.set_child(k);
        yayliBasma(b, {basik: 0.97});
        b.connect('clicked', () => this._ac(o.link));
        return b;
    }

    // ---------- arama ----------
    async _ara() {
        const soz = this._giris.text.trim();
        this._modal(false);
        if (soz.length < 2)
            return;
        this._kat = null;
        this._cipYaz();
        this._bekle(f(_('“%s” aranıyor…'), soz));
        const d = await jsonAl([VERI, 'oyun-ara', soz], this._iptal);
        if (this._iptal.is_cancelled() || this._kat !== null)
            return;
        this._icerik.destroy_all_children();
        if (d.hata) {
            this._bekle(_('Sunucuya ulaşılamadı'));
            return;
        }
        for (const [anahtar, baslik, etiket] of [['steam', 'Steam Türkiye', 'Steam'], ['en_ucuz', _('En ucuz · PC mağazaları (CheapShark)'), _('en düşük fiyat')]]) {
            const kutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style: 'spacing: 4px;'});
            const l = d[anahtar] ?? [];
            if (!l.length)
                kutu.add_child(new St.Label({text: _('Bulunamadı'), style_class: 'flugel-soluk'}));
            l.forEach(o => kutu.add_child(this._satir(o, etiket)));
            this._icerik.add_child(bolum(baslik, kutu));
        }
    }

    destroy() {
        this._iptal.cancel();
        this._modal(false);
        super.destroy();
    }
}
