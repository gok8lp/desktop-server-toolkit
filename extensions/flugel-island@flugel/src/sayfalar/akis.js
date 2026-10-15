// FLUGEL Island — "Akış" sekmesi: sunucudaki FLUGEL Akış (haber/oyun/anime akışı) adanın içinde.
// Üstte kategori çipleri; her haber bir kart: küçük görsel, başlık (çeviri varsa Türkçesi), kaynak · ne zaman,
// önemliyse sarı işaret. Üzerine gelince özet yayla açılır; tıklayınca haber tarayıcıda açılır ve okundu sayılır;
// sağ tık kaydeder/kaydı kaldırır. Veri: ust-panel-veri akis KATEGORİ (sunucu API'si, 2 dk önbellek).
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import {Sayfa} from './sayfa.js';
import {VERI, calistir, emojisiz, jsonAl} from '../ortak.js';
import {ResimKaro, dugme, ipucuBagla, yayliBasma} from '../bilesenler.js';
import {_, f} from '../dil.js';

const KATEGORILER = () => [['ana', _('Sana özel')], ['one', _('Öne çıkanlar')], ['uyari', _('Takip')], ['oyun', _('Oyun')],
    ['teknoloji', _('Teknoloji')], ['anime', _('Anime')], ['gundem', _('Gündem')], ['film', _('Film')], ['youtube', 'YouTube'],
    ['kayitli', _('Kaydedilenler')]];
const AKIS_ADRES = 'http://192.168.0.15:3012';

const once = ts => {
    const s = Date.now() / 1000 - ts;
    if (s < 60)
        return _('şimdi');
    if (s < 3600)
        return f(_('%s dk'), Math.floor(s / 60));
    if (s < 86400)
        return f(_('%s sa'), Math.floor(s / 3600));
    return f(_('%s gün'), Math.floor(s / 86400));
};

export class AkisSayfa extends Sayfa {
    constructor({ayarlar}) {
        super();
        this._ayar = ayarlar;
        this._kat = 'ana';
        this._iptal = new Gio.Cancellable();
        this._veriler = new Map();   // kategori → {ogeler, zaman}

        const ust = new St.BoxLayout({style_class: 'flugel-akis-ust', x_expand: true});
        // çipler iki satırda: kesilmeden, hep görünür
        this._cipler = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style: 'spacing: 6px;'});
        const satirlar = [new St.BoxLayout({style_class: 'flugel-cipler'}), new St.BoxLayout({style_class: 'flugel-cipler'})];
        satirlar.forEach(r => this._cipler.add_child(r));
        this._cip = {};
        KATEGORILER().forEach(([k, ad], i) => {
            const b = new St.Button({label: ad, style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
            b.connect('clicked', () => this._sec(k));
            this._cip[k] = b;
            satirlar[i < 5 ? 0 : 1].add_child(b);
        });
        ust.add_child(this._cipler);
        ust.add_child(dugme('view-refresh-symbolic', _('Yenile'), () => this._al(true), {stil: 'flugel-dugme flugel-dugme-kucuk'}));
        ust.add_child(dugme('send-to-symbolic', _('FLUGEL Akış\'ı tarayıcıda aç'), () => this._ac(AKIS_ADRES),
            {stil: 'flugel-dugme flugel-dugme-kucuk'}));
        this.actor.add_child(ust);

        this._liste = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-akis-liste', x_expand: true});
        this.actor.add_child(this._liste);
    }

    goster() {
        this._sec(this._kat, false);
    }

    _ac(url) {
        this.close();
        calistir(`xdg-open ${GLib.shell_quote(url)}`);
    }

    _sec(k, animasyon = true) {
        this._kat = k;
        for (const [id, b] of Object.entries(this._cip)) {
            if (id === k)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        const d = this._veriler.get(k);
        this._yaz(d, animasyon);
        if (!d || Date.now() - d.alindi > 120000)
            this._al();
    }

    async _al(zorla = false) {
        const k = this._kat;
        if (zorla)
            this._veriler.delete(k);
        const d = await jsonAl([VERI, 'akis', k, '24'], this._iptal);
        if (this._iptal.is_cancelled())
            return;
        d.alindi = Date.now();
        const ilkKez = !this._veriler.has(k);
        this._veriler.set(k, d);
        // aynı haberler geldiyse yeniden çizilmez (okurken liste zıplamasın)
        if (this._kat === k && this.degisti(`akis-${k}`, (d.ogeler ?? []).map(o => `${o.id}:${o.kayitli}:${o.okundu}`)))
            this._yaz(d, ilkKez);
    }

    _yaz(d, animasyon) {
        this._liste.destroy_all_children();
        if (!d) {
            this._liste.add_child(new St.Label({text: _('Yükleniyor…'), style_class: 'flugel-soluk'}));
            return;
        }
        if (d.hata) {
            this._liste.add_child(new St.Label({text: _('FLUGEL Akış\'a ulaşılamadı (sunucu?)'), style_class: 'flugel-soluk'}));
            return;
        }
        const ogeler = (d.ogeler ?? []).slice(0, 24);
        if (!ogeler.length)
            this._liste.add_child(new St.Label({text: _('Bu kategoride haber yok'), style_class: 'flugel-soluk'}));
        ogeler.forEach((o, i) => {
            const kart = this._kart(o);
            this._liste.add_child(kart);
            if (animasyon && St.Settings.get().enable_animations && i < 12) {
                kart.opacity = 0;
                kart.translation_y = 8;
                kart.ease({opacity: 255, translation_y: 0, delay: i * 28, duration: 220, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            }
        });
    }

    _kart(o) {
        const b = new St.Button({style_class: `flugel-akis-kart${o.okundu ? ' flugel-akis-okundu' : ''}`, can_focus: true, x_expand: true,
            track_hover: true, button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE});
        const k = new St.BoxLayout({x_expand: true, style: 'spacing: 12px;'});
        if (o.resim_yol) {
            const r = new St.Bin({style_class: 'flugel-akis-resim', y_align: Clutter.ActorAlign.START,
                style: ResimKaro.stil(o.resim_yol)});
            k.add_child(r);
        }
        const m = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        const ustSatir = new St.BoxLayout({style: 'spacing: 6px;'});
        if ((o.onem ?? 0) >= 80)
            ustSatir.add_child(new St.Label({text: '▲', style_class: 'flugel-akis-onemli', y_align: Clutter.ActorAlign.CENTER}));
        ustSatir.add_child(new St.Label({text: `${o.kaynak ?? ''} · ${once(o.ts ?? 0)}`, style_class: 'flugel-akis-kaynak',
            y_align: Clutter.ActorAlign.CENTER}));
        if (o.kayitli)
            ustSatir.add_child(new St.Icon({icon_name: 'user-bookmarks-symbolic', icon_size: 12, style_class: 'flugel-soluk'}));
        m.add_child(ustSatir);
        const baslik = new St.Label({text: emojisiz(o.baslik_tr || o.baslik || ''), style_class: 'flugel-akis-baslik', x_expand: true});
        baslik.clutter_text.line_wrap = true;
        baslik.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        m.add_child(baslik);
        const ozet = emojisiz(o.ozet_tr || o.ozet || '');
        const ozetEtiket = new St.Label({text: ozet, style_class: 'flugel-akis-ozet', visible: false});
        ozetEtiket.clutter_text.line_wrap = true;
        m.add_child(ozetEtiket);
        k.add_child(m);
        b.set_child(k);
        yayliBasma(b, {basik: 0.97});
        // üzerine gelince özet yayla açılır
        b.connect('notify::hover', () => {
            if (!ozet)
                return;
            ozetEtiket.remove_transition('opacity');
            if (b.hover) {
                ozetEtiket.show();
                if (St.Settings.get().enable_animations) {
                    ozetEtiket.opacity = 0;
                    ozetEtiket.ease({opacity: 255, duration: 180, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
                }
            } else {
                ozetEtiket.hide();
            }
        });
        ipucuBagla(b, () => (o.neden ? {baslik: f(_('Önem %s'), o.onem ?? 0), ayrinti: `${emojisiz(o.neden)}\n${_('Tıkla: aç · sağ tık: kaydet')}`}
            : _('Tıkla: aç · sağ tık: kaydet')));
        b.connect('clicked', (_b, n) => {
            if (n === 3) {
                calistir(`${VERI} akis-isaret ${GLib.shell_quote(o.id)} kaydet ${o.kayitli ? 0 : 1}`);
                o.kayitli = o.kayitli ? 0 : 1;
                this._yaz(this._veriler.get(this._kat), false);
                return;
            }
            if (o.link) {
                calistir(`${VERI} akis-isaret ${GLib.shell_quote(o.id)} okundu 1`);
                this._ac(o.link);
            }
        });
        return b;
    }

    destroy() {
        this._iptal.cancel();
        super.destroy();
    }
}
