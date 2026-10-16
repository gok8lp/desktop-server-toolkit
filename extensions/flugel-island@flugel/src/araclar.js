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
        this.zaman = new Map();   // metin → kopyalandığı an (ms)
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
                this.zaman.set(metin, Date.now());
                for (const k of [...this.zaman.keys()]) {
                    if (!this.liste.includes(k))
                        this.zaman.delete(k);
                }
                this._yay();
            });
        });
    }

    durdur() {
        if (this._id)
            this._secim.disconnect(this._id);
        this._id = 0;
        this.liste = [];
        this.zaman.clear();
    }

    abone(fn) {
        this._abone.add(fn);
        return () => this._abone.delete(fn);
    }

    sil(metin) {
        this.liste = this.liste.filter(x => x !== metin);
        this.zaman.delete(metin);
        this._yay();
    }

    temizle() {
        this.liste = [];
        this.zaman.clear();
        this._yay();
    }

    _yay() {
        this._abone.forEach(fn => fn());
    }
}
export const pano = new PanoKaydi();

// "3 dk önce" gibi
export function onceMetni(ms) {
    if (!ms)
        return '';
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60)
        return _('az önce');
    if (s < 3600)
        return f(_('%s dk önce'), Math.floor(s / 60));
    if (s < 86400)
        return f(_('%s sa önce'), Math.floor(s / 3600));
    return f(_('%s gün önce'), Math.floor(s / 86400));
}

const panoTuru = m => (/^\s*https?:\/\/\S+\s*$/i.test(m) ? ['link', _('Bağlantı')]
    : /^\s*[\w.+-]+@[\w-]+\.[\w.-]+\s*$/.test(m) ? ['mail', _('E-posta')]
    : /^#[0-9a-f]{6}$/i.test(m.trim()) ? ['renk', _('Renk')]
    : /[{};=<>]|=>|\bfunction\b|\bconst\b|\bimport\b/.test(m) && m.includes('\n') ? ['kod', _('Kod')]
    : ['metin', _('Metin')]);
const TUR_IKON = {link: 'insert-link-symbolic', mail: 'mail-unread-symbolic', renk: 'color-select-symbolic',
    kod: 'text-x-script-symbolic', metin: 'text-x-generic-symbolic'};

// Atoll'daki pano yöneticisi düzeni: başlık + sil, Geçmiş / Favoriler sekmeleri (sayılı), arama, türüne göre simgeli
// satırlar (metin, tür · ne zaman). Favoriler kalıcıdır (ayar: pano-favoriler; sadece yıldızlananlar diske yazılır).
export class PanoPaneli {
    // ekSatir: başlığın altına konacak satırı kuran işlev (metin dönüştürme düğmeleri; araclar-ek.js)
    constructor({kapat, ekSatir = null, ayarlar = null}) {
        this._kapat = kapat;
        this._ekSatir = ekSatir;
        this._ayar = ayarlar;
        this._sekme = 'gecmis';
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
        const ust = new St.BoxLayout({style_class: 'flugel-detay-baslik'});
        ust.add_child(new St.Icon({icon_name: 'edit-paste-symbolic', icon_size: 18, style_class: 'flugel-panel-baslik-simge', y_align: Clutter.ActorAlign.CENTER}));
        ust.add_child(new St.Label({text: _('Pano yöneticisi'), style_class: 'flugel-panel-baslik', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
        const temizle = new St.Button({style_class: 'flugel-dugme flugel-dugme-kucuk flugel-dugme-tehlike', can_focus: true,
            child: new St.Icon({icon_name: 'user-trash-symbolic', icon_size: 16})});
        temizle.connect('clicked', () => pano.temizle());
        ipucuBagla(temizle, _('Geçmişi temizle (favoriler kalır)'));
        ust.add_child(temizle);
        this.actor.add_child(ust);
        this._sekmeler = new St.BoxLayout({style_class: 'flugel-cipler'});
        this.actor.add_child(this._sekmeler);
        this._arama = new St.Entry({style_class: 'flugel-arama', hint_text: _('Panoda ara…'), can_focus: true, x_expand: true,
            primary_icon: new St.Icon({icon_name: 'system-search-symbolic', icon_size: 14})});
        this._arama.clutter_text.connect('text-changed', () => this._listeYaz());
        this._arama.clutter_text.connect('button-press-event', () => {
            this._modal(true);
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.add_child(this._arama);
        if (this._ekSatir)
            this.actor.add_child(this._ekSatir());
        this._liste = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this.actor.add_child(this._liste);
        this._abonelik = pano.abone(() => this._yaz());
        this._favId = ayarlar?.connect('changed::pano-favoriler', () => this._yaz());
        this._yaz();
    }

    _favoriler() {
        return this._ayar?.get_strv('pano-favoriler') ?? [];
    }

    _favDegistir(metin) {
        if (!this._ayar)
            return;
        const l = this._favoriler();
        this._ayar.set_strv('pano-favoriler', l.includes(metin) ? l.filter(x => x !== metin) : [metin, ...l].slice(0, 40));
    }

    _modal(ac) {
        if (ac && !this._grab) {
            let kok = this.actor;
            while (kok && kok.name !== 'flugelIsland')
                kok = kok.get_parent();
            if (kok)
                this._grab = Main.pushModal(kok, {actionMode: Shell.ActionMode.POPUP});
            this._arama.grab_key_focus();
        } else if (!ac && this._grab) {
            global.stage.set_key_focus(null);
            Main.popModal(this._grab);
            this._grab = null;
        }
    }

    _yaz() {
        this._sekmeler.destroy_all_children();
        const fav = this._favoriler();
        for (const [id, ad, ikon, n] of [['gecmis', _('Geçmiş'), 'document-open-recent-symbolic', pano.liste.length],
            ['favori', _('Favoriler'), 'starred-symbolic', fav.length]]) {
            const b = new St.Button({style_class: `flugel-cip flugel-pano-sekme${this._sekme === id ? ' flugel-anahtar-acik' : ''}`, can_focus: true});
            const k = new St.BoxLayout({style: 'spacing: 6px;'});
            k.add_child(new St.Icon({icon_name: ikon, icon_size: 14, y_align: Clutter.ActorAlign.CENTER}));
            k.add_child(new St.Label({text: ad, y_align: Clutter.ActorAlign.CENTER}));
            k.add_child(new St.Label({text: String(n), style_class: 'flugel-pano-sayi', y_align: Clutter.ActorAlign.CENTER}));
            b.set_child(k);
            b.connect('clicked', () => {
                this._sekme = id;
                this._yaz();
            });
            this._sekmeler.add_child(b);
        }
        this._listeYaz();
    }

    _listeYaz() {
        this._liste.destroy_all_children();
        const fav = this._favoriler();
        const ara = this._arama.text.trim().toLocaleLowerCase('tr');
        const kaynak = this._sekme === 'favori' ? fav : pano.liste;
        const l = kaynak.filter(m => !ara || m.toLocaleLowerCase('tr').includes(ara)).slice(0, 12);
        if (!l.length) {
            this._liste.add_child(new St.Label({style_class: 'flugel-soluk', text: ara ? _('Eşleşen yok')
                : this._sekme === 'favori' ? _('Yıldızladığın metinler burada kalıcı durur') : _('Henüz kopyalanan metin yok')}));
            return;
        }
        for (const metin of l) {
            const [tur, turAd] = panoTuru(metin);
            const b = new St.Button({style_class: 'flugel-pano-satir', can_focus: true, x_expand: true,
                button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE});
            const k = new St.BoxLayout({x_expand: true, style: 'spacing: 12px;'});
            k.add_child(new St.Icon({icon_name: TUR_IKON[tur], icon_size: 18, style_class: 'flugel-pano-tur-simge', y_align: Clutter.ActorAlign.START}));
            const m = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
            const ana = new St.Label({text: metin.replace(/\s+/g, ' ').trim().slice(0, 300), style_class: 'flugel-pano-metin'});
            ana.clutter_text.line_wrap = true;
            ana.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            m.add_child(ana);
            const alt = new St.BoxLayout();
            alt.add_child(new St.Label({text: turAd, style_class: 'flugel-pano-alt', x_expand: true}));
            alt.add_child(new St.Label({text: onceMetni(pano.zaman.get(metin)), style_class: 'flugel-pano-alt'}));
            m.add_child(alt);
            k.add_child(m);
            const yildiz = new St.Button({style_class: 'flugel-dugme flugel-dugme-kucuk', can_focus: true, y_align: Clutter.ActorAlign.CENTER,
                child: new St.Icon({icon_name: fav.includes(metin) ? 'starred-symbolic' : 'non-starred-symbolic', icon_size: 14,
                    style_class: fav.includes(metin) ? 'flugel-oyun-istek-yildiz' : ''})});
            yildiz.connect('clicked', () => this._favDegistir(metin));
            ipucuBagla(yildiz, fav.includes(metin) ? _('Favorilerden çıkar') : _('Favorilere ekle (kalıcı)'));
            k.add_child(yildiz);
            b.set_child(k);
            ipucuBagla(b, _('Tıkla: yeniden kopyala · sağ tık: sil'));
            b.connect('clicked', (_b, n) => {
                if (n === 3) {
                    if (this._sekme === 'favori')
                        this._favDegistir(metin);
                    else
                        pano.sil(metin);
                    return;
                }
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, metin);
                Main.osdWindowManager.showAll(Gio.ThemedIcon.new('edit-copy-symbolic'), _('Kopyalandı'), null, null);
                this._kapat?.();
            });
            this._liste.add_child(b);
        }
    }

    destroy() {
        this._modal(false);
        this._abonelik();
        if (this._favId)
            this._ayar.disconnect(this._favId);
        this.actor.destroy();
    }
}

// ---------- renk seçici ----------
// geçmiş: renk-gecmisi (HEX), seçildiği an: renk-zaman ("HEX=ms")
export async function renkSec(ayarlar) {
    const secici = new PickPixel(new Shell.Screenshot());
    const c = await secici.pickAsync();
    if (!c)
        return null;
    const hex = `#${[c.red, c.green, c.blue].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, hex);
    const l = [hex, ...ayarlar.get_strv('renk-gecmisi').filter(x => x !== hex)].slice(0, 30);
    const zaman = ayarlar.get_strv('renk-zaman').filter(x => l.includes(x.split('=')[0]) && !x.startsWith(`${hex}=`));
    ayarlar.set_strv('renk-zaman', [`${hex}=${Date.now()}`, ...zaman]);
    ayarlar.set_strv('renk-gecmisi', l);
    Main.osdWindowManager.showAll(Gio.ThemedIcon.new('color-select-symbolic'), f(_('%s kopyalandı'), hex), null, null);
    return hex;
}

// HEX → biçimler (HEX, RGB, RGBA, HSL, HSLA, HSV, GTK/CSS)
export function renkBicimleri(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const [r1, g1, b1] = [r, g, b].map(v => v / 255);
    const mx = Math.max(r1, g1, b1), mn = Math.min(r1, g1, b1), d = mx - mn;
    let h = 0;
    if (d) {
        h = mx === r1 ? ((g1 - b1) / d) % 6 : mx === g1 ? (b1 - r1) / d + 2 : (r1 - g1) / d + 4;
        h = Math.round(h * 60 + 360) % 360;
    }
    const l = (mx + mn) / 2;
    const sl = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    const sv = mx ? d / mx : 0;
    const y = v => Math.round(v * 100);
    return [
        ['HEX', hex],
        ['RGB', `rgb(${r}, ${g}, ${b})`],
        ['RGBA', `rgba(${r}, ${g}, ${b}, 1)`],
        ['HSL', `hsl(${h}, ${y(sl)}%, ${y(l)}%)`],
        ['HSLA', `hsla(${h}, ${y(sl)}%, ${y(l)}%, 1)`],
        ['HSV', `hsv(${h}, ${y(sv)}%, ${y(mx)}%)`],
        ['GdkRGBA', `rgba(${(r1).toFixed(3)}, ${(g1).toFixed(3)}, ${(b1).toFixed(3)}, 1.0)`],
    ];
}

// Atoll'daki renk seçici düzeni: solda son renkler (yuvarlak örnek, HEX, ne zaman), sağda seçilenin ayrıntısı
// (büyük örnek, ne zaman seçildi, biçimler — tıklayınca kopyalanır).
export class RenkPaneli {
    constructor({ayarlar, kapat}) {
        this._ayar = ayarlar;
        this._kapat = kapat;
        this._secili = null;
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
        this._ids = ['changed::renk-gecmisi', 'changed::renk-zaman'].map(k => ayarlar.connect(k, () => this._yaz()));
        this._yaz();
    }

    _zaman(hex) {
        const z = this._ayar.get_strv('renk-zaman').find(x => x.startsWith(`${hex}=`));
        return z ? Number(z.split('=')[1]) : 0;
    }

    _kopyala(metin) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, metin);
        Main.osdWindowManager.showAll(Gio.ThemedIcon.new('edit-copy-symbolic'), f(_('%s kopyalandı'), metin), null, null);
    }

    _yaz() {
        this.actor.destroy_all_children();
        const renkler = this._ayar.get_strv('renk-gecmisi');
        if (!renkler.includes(this._secili))
            this._secili = renkler[0] ?? null;
        const ust = new St.BoxLayout({style_class: 'flugel-detay-baslik'});
        ust.add_child(new St.Icon({icon_name: 'color-select-symbolic', icon_size: 18, style_class: 'flugel-panel-baslik-simge', y_align: Clutter.ActorAlign.CENTER}));
        ust.add_child(new St.Label({text: _('Renk seçici'), style_class: 'flugel-panel-baslik', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
        const sec = new St.Button({style_class: 'flugel-cip flugel-anahtar-acik', can_focus: true});
        const sk = new St.BoxLayout({style: 'spacing: 6px;'});
        sk.add_child(new St.Icon({icon_name: 'list-add-symbolic', icon_size: 14, y_align: Clutter.ActorAlign.CENTER}));
        sk.add_child(new St.Label({text: _('Renk seç'), y_align: Clutter.ActorAlign.CENTER}));
        sec.set_child(sk);
        sec.connect('clicked', () => {
            this._kapat?.();
            renkSec(this._ayar).catch(() => {});
        });
        ust.add_child(sec);
        if (renkler.length) {
            const sil = new St.Button({style_class: 'flugel-dugme flugel-dugme-kucuk flugel-dugme-tehlike', can_focus: true,
                child: new St.Icon({icon_name: 'user-trash-symbolic', icon_size: 16})});
            sil.connect('clicked', () => {
                this._ayar.set_strv('renk-gecmisi', []);
                this._ayar.set_strv('renk-zaman', []);
            });
            ipucuBagla(sil, _('Renk geçmişini temizle'));
            ust.add_child(sil);
        }
        this.actor.add_child(ust);
        if (!renkler.length) {
            this.actor.add_child(new St.Label({text: _('Seçilen renkler burada görünür (HEX olarak panoya kopyalanır)'), style_class: 'flugel-soluk'}));
            return;
        }
        const govde = new St.BoxLayout({x_expand: true, style_class: 'flugel-renk-govde'});
        // sol: son renkler
        const sol = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-renk-liste'});
        const solBas = new St.BoxLayout();
        solBas.add_child(new St.Label({text: _('Son renkler'), style_class: 'flugel-bolum-baslik', x_expand: true}));
        solBas.add_child(new St.Label({text: String(renkler.length), style_class: 'flugel-pano-sayi'}));
        sol.add_child(solBas);
        for (const hex of renkler.slice(0, 7)) {
            const b = new St.Button({style_class: `flugel-renk-satir${hex === this._secili ? ' flugel-renk-satir-secili' : ''}`, can_focus: true, x_expand: true});
            const k = new St.BoxLayout({style: 'spacing: 10px;', x_expand: true});
            k.add_child(new St.Widget({style_class: 'flugel-renk-daire', style: `background-color: ${hex};`, y_align: Clutter.ActorAlign.CENTER}));
            const m = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
            m.add_child(new St.Label({text: hex, style_class: 'flugel-renk-hex'}));
            m.add_child(new St.Label({text: onceMetni(this._zaman(hex)), style_class: 'flugel-pano-alt'}));
            k.add_child(m);
            b.set_child(k);
            b.connect('clicked', () => {
                this._secili = hex;
                this._yaz();
            });
            sol.add_child(b);
        }
        govde.add_child(sol);
        // sağ: ayrıntı
        const sag = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style_class: 'flugel-renk-ayrinti'});
        sag.add_child(new St.Label({text: _('Renk ayrıntısı'), style_class: 'flugel-bolum-baslik'}));
        const ornek = new St.Button({style_class: 'flugel-renk-buyuk', style: `background-color: ${this._secili};`, x_expand: true, can_focus: true});
        ornek.connect('clicked', () => this._kopyala(this._secili));
        ipucuBagla(ornek, _('Tıkla: HEX kopyala'));
        sag.add_child(ornek);
        const z = this._zaman(this._secili);
        if (z)
            sag.add_child(new St.Label({text: f(_('%s seçildi'), onceMetni(z)), style_class: 'flugel-pano-alt', x_align: Clutter.ActorAlign.CENTER}));
        sag.add_child(new St.Label({text: _('Biçimler'), style_class: 'flugel-bolum-baslik'}));
        for (const [ad, deger] of renkBicimleri(this._secili)) {
            const b = new St.Button({style_class: 'flugel-renk-bicim', can_focus: true, x_expand: true});
            const k = new St.BoxLayout({x_expand: true});
            k.add_child(new St.Label({text: ad, style_class: 'flugel-renk-bicim-ad'}));
            const d = new St.Label({text: deger, style_class: 'flugel-renk-bicim-deger', x_expand: true});
            d.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            k.add_child(d);
            b.set_child(k);
            b.connect('clicked', () => this._kopyala(deger));
            ipucuBagla(b, _('Tıkla: kopyala'));
            sag.add_child(b);
        }
        govde.add_child(sag);
        this.actor.add_child(govde);
    }

    destroy() {
        this._ids.forEach(id => this._ayar.disconnect(id));
        this.actor.destroy();
    }
}
