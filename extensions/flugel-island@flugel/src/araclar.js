// FLUGEL Island — Atoll'dan uyarlanan araçlar (kod GNOME için baştan yazıldı):
//   Zamanlayici   : geri sayım; kapsülde kalan süre ve ilerleme, bitince ses + ada açılır.
//   PanoGecmisi   : kopyalanan son 30 metin (sadece bellekte; oturum kapanınca silinir), tıklayınca yeniden kopyalanır.
//   renkSec()     : GNOME'un ekran renk seçicisi; seçilen renk panoya HEX olarak kopyalanır, son 12 renk hatırlanır.
// Paneller Hızlı sekmesindeki karolardan açılır (sayfalar/hizli.js).
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {PickPixel} from 'resource:///org/gnome/shell/ui/screenshot.js';
import {createActivity, _now} from './activity.js';
import {oncelik} from './providers/provider-base.js';
import {ipucuBagla} from './bilesenler.js';
import {_, f} from './dil.js';

const sureMetni = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const sa = Math.floor(s / 3600), dk = Math.floor((s % 3600) / 60), sn = s % 60;
    return sa ? `${sa}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}` : `${dk}:${String(sn).padStart(2, '0')}`;
};

// ---------- zamanlayıcı (tek, uygulama boyunca) ----------
class ZamanlayiciDurumu {
    constructor() {
        this._abone = new Set();
        this.sifirla();
    }

    sifirla() {
        this.toplam = 0;       // ms
        this.bitis = 0;        // monotonik ms (çalışırken)
        this.kalanDurak = 0;   // duraklatılmışken kalan ms
        this.bitti = false;
        this._yay();
    }

    get calisiyor() {
        return this.bitis > 0;
    }

    get duraklatildi() {
        return !this.bitis && this.kalanDurak > 0;
    }

    get kalan() {
        if (this.bitis)
            return Math.max(0, this.bitis - GLib.get_monotonic_time() / 1000);
        return this.kalanDurak;
    }

    baslat(ms) {
        this.toplam = ms;
        this.bitis = GLib.get_monotonic_time() / 1000 + ms;
        this.kalanDurak = 0;
        this.bitti = false;
        this._yay();
    }

    duraklatDevam() {
        if (this.bitis) {
            this.kalanDurak = this.kalan;
            this.bitis = 0;
        } else if (this.kalanDurak > 0) {
            this.bitis = GLib.get_monotonic_time() / 1000 + this.kalanDurak;
            this.kalanDurak = 0;
        }
        this._yay();
    }

    ekle(ms) {
        if (this.bitis)
            this.bitis += ms;
        else if (this.kalanDurak)
            this.kalanDurak += ms;
        else if (this.bitti)
            return this.baslat(ms);
        this.toplam += ms;
        return this._yay();
    }

    bitir() {
        this.bitis = 0;
        this.kalanDurak = 0;
        this.bitti = true;
        this._yay();
    }

    abone(fn) {
        this._abone.add(fn);
        return () => this._abone.delete(fn);
    }

    _yay() {
        for (const fn of this._abone) {
            try {
                fn();
            } catch (e) {
                console.error('FLUGEL Island: zamanlayıcı', e);
            }
        }
    }
}
export const zamanlayici = new ZamanlayiciDurumu();

// ---------- kronometre (tek, uygulama boyunca): ileri sayar, tur alır; çalışırken kapsülde görünür ----------
export const kronoMetni = (ms, onda = true) => {
    const t = Math.max(0, Math.floor(ms / 100));
    const sn = Math.floor(t / 10), sa = Math.floor(sn / 3600), dk = Math.floor((sn % 3600) / 60), s = sn % 60;
    const ana = sa ? `${sa}:${String(dk).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${dk}:${String(s).padStart(2, '0')}`;
    return onda ? `${ana}.${t % 10}` : ana;
};

class KronometreDurumu {
    constructor() {
        this._abone = new Set();
        this.sifirla();
    }

    sifirla() {
        this.baslangic = 0;   // monotonik ms (çalışırken)
        this.birikmis = 0;    // duraklatılmadan önce geçen ms
        this.turlar = [];     // her turun bitiş anındaki toplam ms
        this._yay();
    }

    get calisiyor() {
        return this.baslangic > 0;
    }

    get gecen() {
        return this.birikmis + (this.baslangic ? GLib.get_monotonic_time() / 1000 - this.baslangic : 0);
    }

    get bos() {
        return !this.calisiyor && this.birikmis === 0;
    }

    baslatDurdur() {
        if (this.baslangic) {
            this.birikmis = this.gecen;
            this.baslangic = 0;
        } else {
            this.baslangic = GLib.get_monotonic_time() / 1000;
        }
        this._yay();
    }

    tur() {
        if (!this.calisiyor)
            return;
        this.turlar = [...this.turlar, this.gecen].slice(-99);
        this._yay();
    }

    abone(fn) {
        this._abone.add(fn);
        return () => this._abone.delete(fn);
    }

    _yay() {
        for (const fn of this._abone) {
            try {
                fn();
            } catch (e) {
                console.error('FLUGEL Island: kronometre', e);
            }
        }
    }
}
export const kronometre = new KronometreDurumu();

// kapsüldeki zamanlayıcı etkinliği
export class ZamanlayiciProvider {
    constructor(ortam) {
        this.id = 'zamanlayici';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = zamanlayici.abone(() => this._yaz());
        this._kronoAbonelik = kronometre.abone(() => this._kronoYaz());
        this._yaz();
        this._kronoYaz();
    }

    // kronometre: çalışırken ya da duraklatılmışken kapsülde (saniyede bir güncellenir)
    _kronoYaz() {
        if (!this._manager)
            return;
        const id = `${this.id}:krono`;
        if (this._kronoId)
            GLib.source_remove(this._kronoId);
        this._kronoId = 0;
        if (kronometre.bos) {
            this._manager.remove(id);
            return;
        }
        const ciz = () => {
            const c = kronometre.calisiyor;
            this._manager?.update(createActivity({id, providerId: this.id, tier: 'persistent', slot: 'either',
                priority: oncelik(this._settings, this.id, 18), glyph: c ? 'kronometre' : 'media-playback-pause-symbolic',
                label: f(c ? _('Kronometre · %s') : _('Kronometre duraklatıldı · %s'), kronoMetni(kronometre.gecen, false)),
                sublabel: kronometre.turlar.length ? f(_('%s tur'), kronometre.turlar.length) : '',
                data: {kisa: kronoMetni(kronometre.gecen, false), eylemler: [
                    {ikon: c ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic', ipucu: c ? _('Durdur') : _('Devam'),
                        fn: () => kronometre.baslatDurdur()},
                    ...(c ? [{ikon: 'bayrak', ipucu: _('Tur'), fn: () => kronometre.tur()}] : []),
                ], kapat: () => kronometre.sifirla()}}));
            return GLib.SOURCE_CONTINUE;
        };
        ciz();
        if (kronometre.calisiyor)
            this._kronoId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, ciz);
    }

    disable() {
        this._abonelik?.();
        this._kronoAbonelik?.();
        if (this._kronoId)
            GLib.source_remove(this._kronoId);
        this._kronoId = 0;
        this._manager?.remove(`${this.id}:krono`);
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this._tikId = 0;
        this._manager?.remove(`${this.id}:sayac`);
        this._manager = null;
    }

    _yaz() {
        if (!this._manager)
            return;
        const id = `${this.id}:sayac`;
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this._tikId = 0;
        if (zamanlayici.bitti) {
            global.display.get_sound_player().play_from_theme('alarm-clock-elapsed', _('Zamanlayıcı'), null);
            const now = _now();
            this._manager.push(createActivity({id: `${this.id}:bitti`, providerId: this.id, tier: 'transient', slot: 'either',
                priority: oncelik(this._settings, this.id, 60), glyph: 'alarm-symbolic', label: _('Süre doldu'),
                startedAt: now, expiresAt: now + 6000000, data: {renk: '#e8c66b'}}));
            this._manager.update(createActivity({id, providerId: this.id, tier: 'persistent', slot: 'either',
                priority: oncelik(this._settings, this.id, 40), glyph: 'alarm-symbolic', label: _('Süre doldu'),
                sublabel: sureMetni(zamanlayici.toplam),
                data: {kisa: '0:00', renk: '#e8c66b', yanip: true, eylemler: [
                    {ikon: 'view-refresh-symbolic', ipucu: _('Yeniden başlat'), fn: () => zamanlayici.baslat(zamanlayici.toplam)},
                ], kapat: () => zamanlayici.sifirla()}}));
            return;
        }
        if (!zamanlayici.calisiyor && !zamanlayici.duraklatildi) {
            this._manager.remove(id);
            return;
        }
        const ciz = () => {
            const kalan = zamanlayici.kalan;
            if (zamanlayici.calisiyor && kalan <= 0) {
                this._tikId = 0;
                zamanlayici.bitir();
                return GLib.SOURCE_REMOVE;
            }
            this._manager?.update(createActivity({id, providerId: this.id, tier: 'persistent', slot: 'either',
                priority: oncelik(this._settings, this.id, 20), glyph: zamanlayici.duraklatildi ? 'media-playback-pause-symbolic' : 'alarm-symbolic',
                label: zamanlayici.duraklatildi ? f(_('Zamanlayıcı duraklatıldı · %s'), sureMetni(kalan)) : f(_('Zamanlayıcı · %s'), sureMetni(kalan)),
                sublabel: f(_('toplam %s'), sureMetni(zamanlayici.toplam)),
                data: {kisa: sureMetni(kalan), ilerleme: 1 - kalan / Math.max(1, zamanlayici.toplam), eylemler: [
                    {ikon: zamanlayici.duraklatildi ? 'media-playback-start-symbolic' : 'media-playback-pause-symbolic',
                        ipucu: zamanlayici.duraklatildi ? _('Devam') : _('Duraklat'), fn: () => zamanlayici.duraklatDevam()},
                    {ikon: 'list-add-symbolic', ipucu: _('+1 dakika'), fn: () => zamanlayici.ekle(60000)},
                ], kapat: () => zamanlayici.sifirla()}}));
            return GLib.SOURCE_CONTINUE;
        };
        ciz();
        if (zamanlayici.calisiyor)
            this._tikId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, ciz);
    }
}

// Hızlı sekmesindeki zamanlayıcı paneli
export class ZamanlayiciPaneli {
    constructor() {
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
        this._abonelik = zamanlayici.abone(() => this._yaz());
        this._yaz();
    }

    _yaz() {
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this._tikId = 0;
        this.actor.destroy_all_children();
        const buyuk = new St.Label({style_class: 'flugel-sayac-buyuk', x_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(buyuk);
        const yaz = () => {
            buyuk.text = zamanlayici.calisiyor || zamanlayici.duraklatildi ? sureMetni(zamanlayici.kalan)
                : (zamanlayici.bitti ? _('Süre doldu') : _('Süre seç'));
            return GLib.SOURCE_CONTINUE;
        };
        yaz();
        if (zamanlayici.calisiyor)
            this._tikId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, yaz);
        const cipler = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        for (const dk of [1, 3, 5, 10, 15, 25, 45, 60]) {
            const b = new St.Button({label: dk === 60 ? _('1 sa') : f(_('%s dk'), dk), style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
            b.connect('clicked', () => zamanlayici.baslat(dk * 60000));
            cipler.add_child(b);
        }
        this.actor.add_child(cipler);
        if (zamanlayici.calisiyor || zamanlayici.duraklatildi) {
            const denetim = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
            const d = (etiket, fn) => {
                const b = new St.Button({label: etiket, style_class: 'flugel-cip', can_focus: true});
                b.connect('clicked', fn);
                denetim.add_child(b);
            };
            d(zamanlayici.duraklatildi ? _('Devam') : _('Duraklat'), () => zamanlayici.duraklatDevam());
            d(_('+1 dk'), () => zamanlayici.ekle(60000));
            d(_('+5 dk'), () => zamanlayici.ekle(300000));
            d(_('İptal'), () => zamanlayici.sifirla());
            this.actor.add_child(denetim);
        }
    }

    destroy() {
        this._abonelik();
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this.actor.destroy();
    }
}

// ---------- pano geçmişi ----------
const PANO_SINIR = 30;
class PanoKaydi {
    constructor() {
        this.liste = [];
        this._abone = new Set();
    }

    baslat() {
        if (this._id)
            return;
        this._secim = global.display.get_selection();
        this._id = this._secim.connect('owner-changed', (_s, tur) => {
            if (tur !== Meta.SelectionType.SELECTION_CLIPBOARD)
                return;
            St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_c, metin) => {
                if (!metin || !metin.trim() || metin.length > 20000)
                    return;
                this.liste = [metin, ...this.liste.filter(x => x !== metin)].slice(0, PANO_SINIR);
                this._abone.forEach(fn => fn());
            });
        });
    }

    durdur() {
        if (this._id)
            this._secim.disconnect(this._id);
        this._id = 0;
        this.liste = [];
    }

    abone(fn) {
        this._abone.add(fn);
        return () => this._abone.delete(fn);
    }

    temizle() {
        this.liste = [];
        this._abone.forEach(fn => fn());
    }
}
export const pano = new PanoKaydi();

export class PanoPaneli {
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

// ---------- renk seçici ----------
export async function renkSec(ayarlar) {
    const secici = new PickPixel(new Shell.Screenshot());
    const c = await secici.pickAsync();
    if (!c)
        return null;
    const hex = `#${[c.red, c.green, c.blue].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, hex);
    const l = [hex, ...ayarlar.get_strv('renk-gecmisi').filter(x => x !== hex)].slice(0, 12);
    ayarlar.set_strv('renk-gecmisi', l);
    Main.osdWindowManager.showAll(Gio.ThemedIcon.new('color-select-symbolic'), f(_('%s kopyalandı'), hex), null, null);
    return hex;
}

export class RenkPaneli {
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
