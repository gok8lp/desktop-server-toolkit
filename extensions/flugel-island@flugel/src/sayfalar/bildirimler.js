// FLUGEL Island — "Bildirimler" sekmesi: sunucudan gelen son 24 saatin bildirimleri.
// Her satır: önem noktası, saat, kategori, tek satır metin; üzerine gelince tam metin açılır (yumuşak),
// tıklayınca açık kalır. Üstte süzgeç (Tümü · Uyarılar · Bilgi) ve kategori bazında susturma (1 sa, 8 sa, süresiz).
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import GLib from 'gi://GLib';
import {Sayfa} from './sayfa.js';
import {emojisiz, ikon} from '../ortak.js';
import {bolum, ipucuBagla} from '../bilesenler.js';
import {KATEGORI_AD, kategori, sessizler, sessizMi, sessizeAl} from '../sunucu-bildirim.js';
import {_, f} from '../dil.js';

const RENK = {KRITIK: '#f07b7b', HATA: '#f07b7b', UYARI: '#e8c66b', BILGI: '#8a8a94'};

export class BildirimlerSayfa extends Sayfa {
    constructor({veri, ayarlar}) {
        super();
        this._veri = veri;
        this._ayar = ayarlar;
        this._suzgec = 'hepsi';
        const ust = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        this._cip = {};
        for (const [k, ad] of [['hepsi', _('Tümü')], ['uyari', _('Uyarılar')], ['bilgi', _('Bilgi')], ['sessiz', _('Susturma')]]) {
            const b = new St.Button({label: ad, style_class: 'flugel-cip', can_focus: true});
            b.connect('clicked', () => {
                this._suzgec = k;
                this._yaz(true);
            });
            this._cip[k] = b;
            ust.add_child(b);
        }
        this.actor.add_child(ust);
        // v3: okunmamış sayısı · gruplama · okundu say · hepsini temizle (iki adımlı)
        this._v3Ust = new St.BoxLayout({style_class: 'flugel-v3-bildirim-ust', x_expand: true, visible: false});
        this._okunmamis = new St.Label({style_class: 'flugel-v3-bildirim-sayi', x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this._v3Ust.add_child(this._okunmamis);
        const v3Dugme = (ipucu, fn) => {
            const b = new St.Button({style_class: 'flugel-cip', can_focus: true});
            b.connect('clicked', fn);
            ipucuBagla(b, ipucu);
            this._v3Ust.add_child(b);
            return b;
        };
        this._grupDugme = v3Dugme(_('Gruplama: kategoriye ya da zamana göre'), () => {
            this._ayar.set_string('bildirim-gruplama', this._ayar.get_string('bildirim-gruplama') === 'kategori' ? 'zaman' : 'kategori');
            this._yaz(true);
        });
        this._okunduDugme = v3Dugme(_('Hepsini okundu say'), () => {
            this._ayar.set_double('bildirim-okundu', Date.now() / 1000);
            this._yaz(true);
        });
        this._temizleDugme = v3Dugme(_('Kritik ve hata bildirimleri korunur'), () => this._temizleBas());
        this.actor.add_child(this._v3Ust);
        this._liste = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-bildirim-listesi', x_expand: true});
        this.actor.add_child(this._liste);
        this._aboneler = [veri.abone('island', s => {
            const sayi = (s?.bildirimler ?? []).filter(b => b.seviye !== 'BILGI' && Date.now() / 1000 - b.ts < 3600).length;
            this.rozetDegisti?.(sayi ? String(sayi) : '');
            this.gorunurse(() => this._yaz());
        })];
        this._ayarId = ayarlar.connect('changed::sunucu-sessiz', () => this.gorunurse(() => this._yaz(true)));
        this._tasarimId = ayarlar.connect('changed::tasarim', () => this.gorunurse(() => this._yaz(true)));
    }

    _v3() {
        return this._ayar.get_string('tasarim') === 'v3';
    }

    // yıkıcı eylem: ilk tık onay ister, 3 sn içinde ikinci tık temizler
    _temizleBas() {
        if (!this._temizleOnay) {
            this._temizleOnay = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
                this._temizleOnay = 0;
                this._temizleDugme.label = _('Hepsini temizle');
                return GLib.SOURCE_REMOVE;
            });
            this._temizleDugme.label = _('Emin misin? Tekrar bas');
            return;
        }
        GLib.source_remove(this._temizleOnay);
        this._temizleOnay = 0;
        const simdi = Date.now() / 1000;
        this._ayar.set_double('bildirim-temizlendi', simdi);
        this._ayar.set_double('bildirim-okundu', simdi);
        this._temizleDugme.label = _('Hepsini temizle');
        this._yaz(true);
    }

    gizle() {
        // sayfadan çıkınca görülenler okundu sayılır
        // (kart açılışındaki ısınma turu sayfalara kısaca uğrar: en az 1,5 sn görünmediyse okundu sayılmaz)
        const sure = this._gosterildi ? (GLib.get_monotonic_time() - this._gosterildi) / 1000 : 0;
        this._gosterildi = 0;
        if (this._v3() && this._enYeni && sure >= 1500)
            this._ayar.set_double('bildirim-okundu', Math.max(this._ayar.get_double('bildirim-okundu'), this._enYeni));
        super.gizle?.();
    }

    goster() {
        this._gosterildi = GLib.get_monotonic_time();
        this._yaz();
    }

    _yaz(zorla = false) {
        const s = this._veri.son('island');
        if (!zorla && !this.degisti('bildirim', [s?.bildirimler, this._suzgec]))
            return;
        for (const [k, b] of Object.entries(this._cip)) {
            if (k === this._suzgec)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        this._liste.destroy_all_children();
        if (this._suzgec === 'sessiz') {
            this._susturmaYaz();
            return;
        }
        const v3 = this._v3();
        const temiz = v3 ? this._ayar.get_double('bildirim-temizlendi') : 0;
        const korunan = b => b.seviye === 'KRITIK' || b.seviye === 'HATA';
        const liste = (s?.bildirimler ?? []).filter(b => this._suzgec === 'hepsi' ||
            (this._suzgec === 'uyari' ? b.seviye !== 'BILGI' : b.seviye === 'BILGI'))
            .filter(b => b.ts > temiz || korunan(b));
        const okundu = this._ayar.get_double('bildirim-okundu');
        this._enYeni = Math.max(0, ...liste.map(b => b.ts));
        this._v3Ust.visible = v3;
        if (v3) {
            const n = liste.filter(b => b.ts > okundu).length;
            this._okunmamis.text = n ? f(_('%s okunmamış'), n) : _('Hepsi okundu');
            this._grupDugme.label = this._ayar.get_string('bildirim-gruplama') === 'kategori' ? _('Kategori') : _('Zaman');
            this._okunduDugme.label = _('Okundu say');
            this._okunduDugme.visible = n > 0;
            if (!this._temizleOnay)
                this._temizleDugme.label = _('Hepsini temizle');
        }
        if (!s || s.hata) {
            this._liste.add_child(new St.Label({text: _('Sunucuya ulaşılamıyor'), style_class: 'flugel-soluk'}));
            return;
        }
        if (!liste.length) {
            this._liste.add_child(new St.Label({text: _('Son 24 saatte bildirim yok'), style_class: 'flugel-soluk'}));
            return;
        }
        if (v3 && this._ayar.get_string('bildirim-gruplama') === 'kategori') {
            // kategoriye göre gruplar: Kritik önce, sonra içinde bildirim olan kategoriler
            const ad = KATEGORI_AD();
            const gruplar = new Map();
            for (const b of liste) {
                const k = korunan(b) ? 'kritik' : kategori(b.metin).k;
                if (!gruplar.has(k))
                    gruplar.set(k, []);
                gruplar.get(k).push(b);
            }
            const sira = ['kritik', ...Object.keys(ad)].filter(k => gruplar.has(k));
            for (const k of sira) {
                const g = gruplar.get(k);
                const yeni = g.filter(b => b.ts > okundu).length;
                const baslik = k === 'kritik' ? _('Kritik') : ad[k];
                this._liste.add_child(new St.Label({text: yeni ? `${baslik} · ${yeni}` : baslik, style_class: 'flugel-bolum-baslik'}));
                for (const b of g)
                    this._liste.add_child(this._satir(b, GLib.DateTime.new_from_unix_local(b.ts), b.ts > okundu));
            }
            return;
        }
        let gun = '';
        for (const b of liste) {
            const t = GLib.DateTime.new_from_unix_local(b.ts);
            const g = t.format('%d.%m');
            if (g !== gun) {
                gun = g;
                this._liste.add_child(new St.Label({text: g === GLib.DateTime.new_now_local().format('%d.%m') ? _('Bugün') : g,
                    style_class: 'flugel-bolum-baslik'}));
            }
            this._liste.add_child(this._satir(b, t, v3 && b.ts > okundu));
        }
    }

    _satir(b, t, yeni = false) {
        const {k, ikon: ik} = kategori(b.metin);
        const sessiz = sessizMi(this._ayar, k);
        const satir = new St.Button({style_class: `flugel-sb-satir${sessiz ? ' flugel-sb-sessiz' : ''}${yeni ? ' flugel-sb-yeni' : ''}`,
            can_focus: true, x_expand: true, track_hover: true});
        const kutu = new St.BoxLayout({x_expand: true, style: 'spacing: 10px;'});
        kutu.add_child(new St.Widget({style_class: 'flugel-nokta', style: `background-color: ${RENK[b.seviye] ?? RENK.BILGI};`,
            y_align: Clutter.ActorAlign.START}));
        kutu.add_child(new St.Icon({gicon: ikon(ik), icon_size: 16, y_align: Clutter.ActorAlign.START, style_class: 'flugel-sb-ikon'}));
        const metinKutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        const ust = new St.BoxLayout({style: 'spacing: 8px;'});
        ust.add_child(new St.Label({text: t.format('%H:%M'), style_class: 'flugel-sb-saat'}));
        ust.add_child(new St.Label({text: KATEGORI_AD()[k], style_class: 'flugel-sb-kategori'}));
        metinKutu.add_child(ust);
        const metin = new St.Label({text: emojisiz(b.metin), style_class: 'flugel-sb-metin', x_expand: true});
        metin.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        metinKutu.add_child(metin);
        kutu.add_child(metinKutu);
        const sus = new St.Button({style_class: 'flugel-dugme flugel-dugme-kucuk flugel-dugme-soluk', can_focus: true, opacity: 0,
            child: new St.Icon({icon_name: sessiz ? 'notifications-symbolic' : 'notifications-disabled-symbolic', icon_size: 14}),
            y_align: Clutter.ActorAlign.START});
        sus.connect('clicked', () => sessizeAl(this._ayar, k, sessiz ? null : 8 * 3600));
        ipucuBagla(sus, sessiz ? f(_('%s: susturmayı kaldır'), KATEGORI_AD()[k]) : f(_('%s: 8 saat sustur'), KATEGORI_AD()[k]));
        kutu.add_child(sus);
        satir.set_child(kutu);
        // üzerine gelince tam metin (kart yüksekliği yayla uyar); tıklayınca açık kalır
        const ac = acik => {
            metin.clutter_text.ellipsize = acik ? Pango.EllipsizeMode.NONE : Pango.EllipsizeMode.END;
            metin.clutter_text.line_wrap = acik;
            sus.ease({opacity: acik || satir.hover ? 255 : 0, duration: 140, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        };
        satir.connect('notify::hover', () => ac(satir.hover || satir._sabit));
        satir.connect('clicked', () => {
            satir._sabit = !satir._sabit;
            ac(satir._sabit);
        });
        return satir;
    }

    _susturmaYaz() {
        const ad = KATEGORI_AD();
        const izgara = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style: 'spacing: 4px;'});
        for (const k of Object.keys(ad)) {
            const satir = new St.BoxLayout({style_class: 'flugel-sb-satir', x_expand: true});
            satir.add_child(new St.Label({text: ad[k], x_expand: true, y_align: Clutter.ActorAlign.CENTER,
                style_class: sessizMi(this._ayar, k) ? 'flugel-sb-sessiz-ad' : 'flugel-sb-ad'}));
            const bitis = sessizler(this._ayar)[k];
            if (sessizMi(this._ayar, k) && bitis > 0) {
                const dk = Math.ceil((bitis - Date.now() / 1000) / 60);
                satir.add_child(new St.Label({text: dk >= 60 ? f(_('%s sa kaldı'), Math.ceil(dk / 60)) : f(_('%s dk kaldı'), dk),
                    style_class: 'flugel-soluk', y_align: Clutter.ActorAlign.CENTER, style: 'margin-right: 8px; font-size: 8.5pt;'}));
            }
            for (const [etiket, sn] of [[_('Açık'), null], [_('1 sa'), 3600], [_('8 sa'), 8 * 3600], [_('Süresiz'), 0]]) {
                const b = new St.Button({label: etiket, style_class: 'flugel-cip', can_focus: true});
                const sessiz = sessizMi(this._ayar, k);
                if ((sn === null && !sessiz) || (sn === 0 && sessiz && bitis === 0))
                    b.add_style_pseudo_class('checked');
                b.connect('clicked', () => sessizeAl(this._ayar, k, sn));
                satir.add_child(b);
            }
            izgara.add_child(satir);
        }
        this._liste.add_child(bolum(_('Susturulan kategoriler kapsülde uyarı olarak gösterilmez'), izgara));
    }

    destroy() {
        if (this._temizleOnay)
            GLib.source_remove(this._temizleOnay);
        this._temizleOnay = 0;
        this._aboneler.forEach(fn => fn());
        this._ayar.disconnect(this._ayarId);
        this._ayar.disconnect(this._tasarimId);
        super.destroy();
    }
}
