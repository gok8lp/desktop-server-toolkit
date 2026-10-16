// FLUGEL Island — ÖNCEKİ TASARIM (v2.8.0) pano ve renk panelleri; Ayarlar → Tasarım → "Önceki" seçilince kullanılır.
// Atoll düzenindeki yeni paneller araclar.js içinde. Gövdeler o sürümün birebir kopyasıdır (sınıf adları ayrı).
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {pano, renkSec} from './araclar.js';
import {ipucuBagla} from './bilesenler.js';
import {_} from './dil.js';

export class PanoPaneliKlasik {
    // ekSatir: başlığın altına konacak satırı kuran işlev (metin dönüştürme düğmeleri; araclar-ek.js)
    constructor({kapat, ekSatir = null}) {
        this._kapat = kapat;
        this._ekSatir = ekSatir;
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
        this._abonelik = pano.abone(() => this._yaz());
        this._yaz();
    }

    _yaz() {
        this.actor.destroy_all_children();
        const ust = new St.BoxLayout({style_class: 'flugel-detay-baslik'});
        ust.add_child(new St.Label({text: _('Pano geçmişi (sadece bu oturumda, bellekte)'), style_class: 'flugel-bolum-baslik', x_expand: true,
            y_align: Clutter.ActorAlign.CENTER}));
        const temizle = new St.Button({label: _('Temizle'), style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
        temizle.connect('clicked', () => pano.temizle());
        ust.add_child(temizle);
        this.actor.add_child(ust);
        if (this._ekSatir)
            this.actor.add_child(this._ekSatir());
        if (!pano.liste.length)
            this.actor.add_child(new St.Label({text: _('Henüz kopyalanan metin yok'), style_class: 'flugel-soluk'}));
        for (const metin of pano.liste.slice(0, 12)) {
            const b = new St.Button({style_class: 'flugel-detay-satir', can_focus: true, x_expand: true,
                button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE});
            const l = new St.Label({text: metin.replace(/\s+/g, ' ').trim(), style_class: 'flugel-detay-ad'});
            l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            b.set_child(l);
            ipucuBagla(b, _('Tıkla: yeniden kopyala · sağ tık: listeden sil'));
            b.connect('clicked', (_b, n) => {
                if (n === 3) {
                    pano.liste = pano.liste.filter(x => x !== metin);
                    this._yaz();
                    return;
                }
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, metin);
                Main.osdWindowManager.showAll(Gio.ThemedIcon.new('edit-copy-symbolic'), _('Kopyalandı'), null, null);
                this._kapat?.();
            });
            this.actor.add_child(b);
        }
    }

    destroy() {
        this._abonelik();
        this.actor.destroy();
    }
}

export class RenkPaneliKlasik {
    constructor({ayarlar, kapat}) {
        this._ayar = ayarlar;
        this._kapat = kapat;
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
        this._id = ayarlar.connect('changed::renk-gecmisi', () => this._yaz());
        this._yaz();
    }

    _yaz() {
        this.actor.destroy_all_children();
        const ust = new St.BoxLayout({style_class: 'flugel-detay-baslik'});
        ust.add_child(new St.Label({text: _('Renk seçici'), style_class: 'flugel-bolum-baslik', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
        const sec = new St.Button({label: _('Ekrandan renk seç'), style_class: 'flugel-cip flugel-anahtar-acik', can_focus: true});
        sec.connect('clicked', () => {
            this._kapat?.();
            renkSec(this._ayar).catch(() => {});
        });
        ust.add_child(sec);
        this.actor.add_child(ust);
        const renkler = this._ayar.get_strv('renk-gecmisi');
        if (!renkler.length)
            this.actor.add_child(new St.Label({text: _('Seçilen renkler burada görünür (HEX olarak panoya kopyalanır)'), style_class: 'flugel-soluk'}));
        const izgara = new St.BoxLayout({style_class: 'flugel-cipler', x_expand: true});
        for (const hex of renkler) {
            const b = new St.Button({style_class: 'flugel-renk-ornek', can_focus: true});
            const k = new St.BoxLayout({style: 'spacing: 6px;'});
            k.add_child(new St.Widget({style_class: 'flugel-renk-kare', style: `background-color: ${hex};`}));
            k.add_child(new St.Label({text: hex, style_class: 'flugel-detay-alt', y_align: Clutter.ActorAlign.CENTER}));
            b.set_child(k);
            b.connect('clicked', () => St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, hex));
            ipucuBagla(b, _('Tıkla: kopyala'));
            izgara.add_child(b);
        }
        this.actor.add_child(izgara);
    }

    destroy() {
        this._ayar.disconnect(this._id);
        this.actor.destroy();
    }
}
