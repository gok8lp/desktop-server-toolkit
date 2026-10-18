// FLUGEL Island — genişletilmiş kart: başlık (karakter, saat, tarih, düğmeler), canlı etkinlikler listesi,
// sekmeler ve kaydırılabilir sayfa alanı. Sayfalar sayfalar/ altında; hepsi PopupMenuSection tabanlı.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {EtkinlikGorunumu} from './etkinlik-gorunumu.js';
import {MedyaOynatici} from './medya.js';
import {MedyaOynaticiKlasik} from './medya-klasik.js';
import {yumusakAc} from './hizli-detay.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import Gio from 'gi://Gio';

import {ikon} from './ortak.js';
import {Karo, dugme, ipucuBagla, onizlemeAcik} from './bilesenler.js';
import {CalismaAlanlari} from './calisma-alanlari.js';
import {HavaDurumu} from './hava.js';
import {bulanikGecis} from './cam.js';
import {_} from './dil.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {ActivityManager} from './activity-manager.js';

// ekranı karart: Mutter'ın güç tasarrufu kipi (3 = kapalı); fare/klavye ile geri gelir
function ekraniKapat() {
    Gio.DBus.session.call('org.gnome.Mutter.DisplayConfig', '/org/gnome/Mutter/DisplayConfig', 'org.freedesktop.DBus.Properties',
        'Set', new GLib.Variant('(ssv)', ['org.gnome.Mutter.DisplayConfig', 'PowerSaveMode', new GLib.Variant('i', 3)]),
        null, Gio.DBusCallFlags.NONE, 2000, null, null);
}

// v3 (Quiet Orbit): on sayfa beş üst grupta, kayıpsız; sayfa kimlikleri (son-sekme, sekmeAc) aynı kalır
const GRUPLAR = () => [
    {id: 'ana', ad: _('Ana'), ikon: 'grup-ana', sayfalar: ['hizli', 'kisayol']},
    {id: 'sistem', ad: _('Sistem'), ikon: 'grup-sistem', sayfalar: ['sistem', 'vm']},
    {id: 'icerik', ad: _('İçerik'), ikon: 'grup-icerik', sayfalar: ['akis', 'anime', 'oyun']},
    {id: 'takip', ad: _('Takip'), ikon: 'grup-takip', sayfalar: ['basket', 'kripto']},
    {id: 'bildirim', ad: _('Bildirim'), ikon: 'grup-bildirim', sayfalar: ['bildirim']},
];
const CANLI_AZAMI = 2; // v3: kartta en çok iki canlı satır, gerisi "+N daha"

const GUNLER = () => [_('Pazar'), _('Pazartesi'), _('Salı'), _('Çarşamba'), _('Perşembe'), _('Cuma'), _('Cumartesi')];
const AYLAR = () => [_('Ocak'), _('Şubat'), _('Mart'), _('Nisan'), _('Mayıs'), _('Haziran'), _('Temmuz'), _('Ağustos'), _('Eylül'), _('Ekim'), _('Kasım'), _('Aralık')];

export class Kart {
    // sayfalar: [{id, ad, ikon, sayfa}]  (sayfa: sayfalar/sayfa.js Sayfa örneği)
    constructor({ayarlar, veri, sayfalar, ayarlariAc, tepsi, ustCubuk}) {
        this._tepsi = tepsi;
        this._ayar = ayarlar;
        this._sayfalar = sayfalar;
        this._canliGorunumler = new Map();
        this.kapatIstendi = null;
        this.sabitleIstendi = null;
        this.boyutDegisti = null;
        this.disMenuKapandi = null;

        this.actor = new St.BoxLayout({style_class: 'flugel-kart', orientation: Clutter.Orientation.VERTICAL});

        // başlık
        const ust = new St.BoxLayout({style_class: 'flugel-kart-ust'});
        this.ustSerit = ust;
        const zaman = new St.Button({style_class: 'flugel-zaman-dugme', can_focus: true, y_align: Clutter.ActorAlign.CENTER});
        const zamanKutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
        this._saat = new St.Label({style_class: 'flugel-kart-saat'});
        this._tarih = new St.Label({style_class: 'flugel-kart-tarih'});
        zamanKutu.add_child(this._saat);
        zamanKutu.add_child(this._tarih);
        zaman.set_child(zamanKutu);
        zaman.connect('clicked', () => {
            this.kapatIstendi?.();
            ustCubuk.takvim();
        });
        ipucuBagla(zaman, _('Takvim ve bildirimler (sağ tık da açar)'));
        ust.add_child(zaman);
        // hava durumu (Atoll'daki hava küçük aracı gibi)
        this._hava = new HavaDurumu(veri);
        ust.add_child(this._hava.actor);
        ust.add_child(new St.Widget({x_expand: true}));
        // çalışma alanları (üst çubuğun solundaki ekran değiştirici)
        this.calismaAlanlari = new CalismaAlanlari();
        ust.add_child(this.calismaAlanlari.actor);
        this._ustSerit = ust;
        ust.add_child(new St.Widget({x_expand: true}));
        // üst çubuktan taşınanlar: Hızlı Ayarlar (pil, ses, ağ), takvim/bildirimler, Etkinlikler
        const sonra = fn => () => {
            this.kapatIstendi?.();
            fn();
        };
        // v3'te bu dördü (ve çalışma alanları) "Daha fazla" şeridine taşınır; özellik kaybolmaz
        this._tasinan = [
            dugme('view-grid-symbolic', _('Hızlı ayarlar: ses, ağ, pil, güç'), sonra(() => ustCubuk.hizliAyarlar())),
            dugme('x-office-calendar-symbolic', _('Takvim ve bildirimler'), sonra(() => ustCubuk.takvim())),
            dugme('focus-windows-symbolic', _('Etkinlikler: pencereler ve uygulamalar'), sonra(() => ustCubuk.etkinlikler())),
        ];
        this._tasinan.forEach(d => ust.add_child(d));
        this._v3Eylemler = {
            hizli: sonra(() => ustCubuk.hizliAyarlar()),
            takvim: sonra(() => ustCubuk.takvim()),
            etkinlik: sonra(() => ustCubuk.etkinlikler()),
            ayarlar: () => {
                this.kapatIstendi?.();
                ayarlariAc();
            },
        };
        this._gucDugme = dugme('system-shutdown-symbolic', _('Güç: ekranı kapat, kilitle, askıya al, yeniden başlat, kapat'),
            () => this._gucAcKapa());
        ust.add_child(this._gucDugme);
        this._sabitDugme = dugme('view-pin-symbolic', _('Açık tut'), () => this.sabitleIstendi?.());
        ust.add_child(this._sabitDugme);
        this._ayarDugme = dugme('emblem-system-symbolic', _('Island ayarları'), () => {
            this.kapatIstendi?.();
            ayarlariAc();
        });
        ust.add_child(this._ayarDugme);
        this._tasinan.push(this._ayarDugme);
        this._dahaBaslik = dugme('grup-daha', _('Daha fazla: hızlı ayarlar, takvim, etkinlikler, çalışma alanları, ayarlar'),
            () => this._dahaAcKapa());
        this._dahaBaslik.visible = false;
        ust.add_child(this._dahaBaslik);
        ust.add_child(dugme('window-close-symbolic', _('Kapat'), () => this.kapatIstendi?.()));
        this.actor.add_child(ust);
        // güç paneli (başlığın altında yayla açılır)
        this._gucPanel = new St.BoxLayout({style_class: 'flugel-alt-panel flugel-guc-panel', x_expand: true, visible: false,
            clip_to_allocation: true});
        const sistem = SystemActions.getDefault();
        const gucKaro = (ikonAdi, ad, ipucu, fn, tehlikeli = false) => {
            const k = new Karo({ikon: ikonAdi, etiket: ad, ipucu, genislik: 96, stil: tehlikeli ? 'flugel-guc-tehlike' : '', eylem: () => {
                this._gucAcKapa(false);
                this.kapatIstendi?.();
                fn();
            }});
            this._gucPanel.add_child(k.actor);
        };
        gucKaro('video-display-symbolic', _('Ekranı kapat'), _('Ekran kararır; fareyi oynatınca ya da tuşa basınca açılır'), () => ekraniKapat());
        gucKaro('system-lock-screen-symbolic', _('Kilitle'), _('Ekranı kilitle (Super+L)'), () => sistem.activateLockScreen());
        gucKaro('weather-clear-night-symbolic', _('Askıya al'), _('Uyku: pil çok az harcar, kapak açılınca devam eder'), () => sistem.activateSuspend());
        gucKaro('system-log-out-symbolic', _('Oturumu kapat'), _('GNOME onay penceresi açılır'), () => sistem.activateLogout());
        gucKaro('system-reboot-symbolic', _('Yeniden başlat'), _('GNOME onay penceresi açılır (geri sayımlı)'), () => sistem.activateRestart(), true);
        gucKaro('system-shutdown-symbolic', _('Kapat'), _('GNOME onay penceresi açılır (geri sayımlı)'), () => sistem.activatePowerOff(), true);
        this.actor.add_child(this._gucPanel);
        // v3 "Daha fazla" şeridi: başlığın altında, güç paneli gibi yayla açılır (açılır menü değil)
        this._dahaPanel = new St.BoxLayout({style_class: 'flugel-alt-panel flugel-v3-daha-panel', x_expand: true, visible: false,
            clip_to_allocation: true});
        const dahaKaro = (ikonAdi, ad, ipucu, fn) => {
            const k = new Karo({ikon: ikonAdi, etiket: ad, ipucu, genislik: 96, eylem: () => {
                this._dahaAcKapa(false);
                fn();
            }});
            this._dahaPanel.add_child(k.actor);
        };
        dahaKaro('view-grid-symbolic', _('Hızlı ayarlar'), _('Ses, ağ, pil, güç'), () => this._v3Eylemler.hizli());
        dahaKaro('x-office-calendar-symbolic', _('Takvim'), _('Takvim ve bildirimler'), () => this._v3Eylemler.takvim());
        dahaKaro('focus-windows-symbolic', _('Etkinlikler'), _('Pencereler ve uygulamalar'), () => this._v3Eylemler.etkinlik());
        dahaKaro('emblem-system-symbolic', _('Ayarlar'), _('Island ayarları'), () => this._v3Eylemler.ayarlar());
        this._dahaAlanKutu = new St.Bin({x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this._dahaPanel.add_child(this._dahaAlanKutu);
        this.actor.add_child(this._dahaPanel);

        // arka plan uygulamaları (tepsi) — simge yoksa görünmez
        this.actor.add_child(tepsi.actor);
        tepsi.disMenuKapandi = () => this.disMenuKapandi?.();

        // canlı etkinlikler
        this._canli = new St.BoxLayout({style_class: 'flugel-kart-canli', orientation: Clutter.Orientation.VERTICAL, visible: false});
        this.actor.add_child(this._canli);

        // sekmeler
        // sekme çubuğu: ortada, sadece simge; adı ve ne olduğu balonda
        this._sekmeKutu = new St.BoxLayout({style_class: 'flugel-sekmeler', x_align: Clutter.ActorAlign.CENTER});
        this._sekmeler = new Map();
        this._rozetler = new Map();
        for (const s of sayfalar) {
            const d = new St.Button({style_class: 'flugel-sekme', can_focus: true, accessible_name: s.ad});
            const kutu = new St.Widget({layout_manager: new Clutter.BinLayout()});
            kutu.add_child(new St.Icon({gicon: ikon(s.ikon), icon_size: 18, x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER}));
            const rozet = new St.Label({style_class: 'flugel-rozet flugel-sekme-rozet', visible: false,
                x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.START});
            // rozet simgenin sağ üstüne taşar (negatif CSS kenar boşluğu St'de boyutu bozar; kaydırma kullanılır)
            rozet.translation_x = 10;
            rozet.translation_y = -7;
            kutu.add_child(rozet);
            d.set_child(kutu);
            ipucuBagla(d, () => ({baslik: s.ad, ayrinti: [s.aciklama, rozet.visible ? rozet.text : ''].filter(Boolean).join(' · ')}));
            d.connect('clicked', () => this.sekmeSec(s.id));
            this._sekmeKutu.add_child(d);
            this._sekmeler.set(s.id, {dugme: d, ad: s.ad});
            s.sayfa.disMenuKapandi = () => this.disMenuKapandi?.();
            s.sayfa.rozetDegisti = metin => {
                rozet.text = metin ?? '';
                rozet.visible = !!metin;
                this._rozetler.set(s.id, metin ?? '');
                this._grupRozetYaz();
            };
            // bir öğe çalıştırılınca (alt menüdekiler dahil) kart kapanır, menülerdeki gibi
            s.sayfa.connect('open-state-changed', (_m, acik) => {
                if (!acik)
                    this.kapatIstendi?.();
            });
        }
        // seçili sekmenin arkasında kayan yumuşak bir zemin (alt çizgi yok): sekmeler arasında yayla kayar
        const katman = new St.Widget({layout_manager: new Clutter.BinLayout(), style_class: 'flugel-sekmeler-zemin',
            x_align: Clutter.ActorAlign.CENTER});
        const arka = new St.Widget({x_expand: true, y_expand: true});
        this._secici = new St.Widget({style_class: 'flugel-sekme-secici', opacity: 0});
        arka.add_child(this._secici);
        katman.add_child(arka);
        katman.add_child(this._sekmeKutu);
        // yerleşim sırasında başka aktörü taşımamak için bir sonraki boşta
        this._sekmeKutu.connect('notify::allocation', () => {
            if (this._seciciId)
                return;
            this._seciciId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._seciciId = 0;
                this._seciciYerlestir(false);
                return GLib.SOURCE_REMOVE;
            });
        });
        this.actor.add_child(katman);
        this._duzKatman = katman;
        this._v3GezinmeKur(sayfalar);

        // sayfa alanı
        this._kaydirma = new St.ScrollView({style_class: 'flugel-sayfa-kap', hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC, overlay_scrollbars: true, x_expand: true});
        this._sayfaKutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this._kaydirma.child = this._sayfaKutu;
        for (const s of sayfalar) {
            s.sayfa.actor.hide();
            this._sayfaKutu.add_child(s.sayfa.actor);
        }
        this.actor.add_child(this._kaydirma);
        this.actor.connect('notify::height', () => this._boyutBildir());
        // Ada sabit boyuttayken kartın kendi yüksekliği değişmez: içerik (sayfa) uzayıp kısalınca kaydırma alanının
        // içeriğinden izlenir. Yoksa kısa bir listeden uzun birine geçince kart kısa boyda takılı kalır.
        this._sayfaKutu.connect('notify::height', () => this._boyutBildir());
        this._sayfaKutu.connect('queue-relayout', () => this._boyutBildir());

        this._secili = null;
        this._canliAcik = false;
        this._v3Id = this._ayar.connect('changed::tasarim', () => this._tasarimUygula());
        this._tasarimUygula(false);
        const son = this._ayar.get_string('son-sekme');
        this.sekmeSec(sayfalar.some(s => s.id === son) ? son : sayfalar[0].id, false);
        this.saatYaz();
    }

    _v3() {
        return this._ayar.get_string('tasarim') === 'v3';
    }

    // beş grup + seçili grubun iç sayfaları (yalnız v3'te görünür)
    _v3GezinmeKur(sayfalar) {
        const var_ = id => sayfalar.some(s => s.id === id);
        this._gruplar = GRUPLAR().map(g => ({...g, sayfalar: g.sayfalar.filter(var_)})).filter(g => g.sayfalar.length);
        // grupta olmayan sayfa varsa kaybolmasın: son gruba eklenir
        const grupta = new Set(this._gruplar.flatMap(g => g.sayfalar));
        for (const s of sayfalar) {
            if (!grupta.has(s.id))
                this._gruplar[this._gruplar.length - 1].sayfalar.push(s.id);
        }
        this._grupSon = new Map();
        this._v3Gezinme = new St.BoxLayout({style_class: 'flugel-v3-gezinme', orientation: Clutter.Orientation.VERTICAL,
            x_expand: true, visible: false});
        // grup çubuğu: tüm kart genişliği, eşit hücreler; simge üstte, kısa etiket altta
        this._grupKutu = new St.BoxLayout({style_class: 'flugel-v3-gruplar', x_expand: true});
        this._grupDugme = new Map();
        for (const g of this._gruplar) {
            const d = new St.Button({style_class: 'flugel-v3-grup', can_focus: true, accessible_name: g.ad, x_expand: true});
            const ic = new St.BoxLayout({style_class: 'flugel-v3-grup-ic', orientation: Clutter.Orientation.VERTICAL,
                x_align: Clutter.ActorAlign.CENTER});
            const simge = new St.Widget({layout_manager: new Clutter.BinLayout(), x_align: Clutter.ActorAlign.CENTER});
            simge.add_child(new St.Icon({gicon: ikon(g.ikon), icon_size: 18, x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER}));
            const rozet = new St.Label({style_class: 'flugel-rozet flugel-v3-grup-rozet', visible: false,
                x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.START});
            rozet.translation_x = 12;
            rozet.translation_y = -6;
            simge.add_child(rozet);
            ic.add_child(simge);
            ic.add_child(new St.Label({text: g.ad, style_class: 'flugel-v3-grup-etiket', x_align: Clutter.ActorAlign.CENTER}));
            d.set_child(ic);
            ipucuBagla(d, () => ({baslik: g.ad, ayrinti: g.sayfalar.map(id => this._sekmeler.get(id)?.ad).filter(Boolean).join(' · ')}));
            d.connect('clicked', () => this.sekmeSec(this._grupSon.get(g.id) ?? g.sayfalar[0]));
            this._grupKutu.add_child(d);
            this._grupDugme.set(g.id, {dugme: d, rozet});
        }
        this._altKutu = new St.BoxLayout({style_class: 'flugel-v3-alt', x_align: Clutter.ActorAlign.START, visible: false});
        this._altDugme = new Map();
        for (const s of sayfalar) {
            const d = new St.Button({style_class: 'flugel-v3-alt-dugme', label: s.ad, can_focus: true, accessible_name: s.ad,
                visible: false});
            ipucuBagla(d, () => ({baslik: s.ad, ayrinti: [s.aciklama, this._rozetler.get(s.id)].filter(Boolean).join(' · ')}));
            d.connect('clicked', () => this.sekmeSec(s.id));
            this._altKutu.add_child(d);
            this._altDugme.set(s.id, d);
        }
        this._v3Gezinme.add_child(this._grupKutu);
        this._v3Gezinme.add_child(this._altKutu);
        this.actor.add_child(this._v3Gezinme);
    }

    _grupBul(id) {
        return this._gruplar.find(g => g.sayfalar.includes(id));
    }

    _v3SecimYaz() {
        const grup = this._grupBul(this._secili?.id);
        if (grup)
            this._grupSon.set(grup.id, this._secili.id);
        for (const [gid, g] of this._grupDugme) {
            if (gid === grup?.id)
                g.dugme.add_style_pseudo_class('checked');
            else
                g.dugme.remove_style_pseudo_class('checked');
        }
        const coklu = (grup?.sayfalar.length ?? 0) > 1;
        this._altKutu.visible = coklu;
        // iç seçimler grubun tanımlı sırasıyla (ör. İçerik: Akış, Anime, Oyunlar)
        grup?.sayfalar.forEach((sid, i) => this._altKutu.set_child_at_index(this._altDugme.get(sid), i));
        for (const [sid, d] of this._altDugme) {
            d.visible = coklu && grup.sayfalar.includes(sid);
            if (sid === this._secili?.id)
                d.add_style_pseudo_class('checked');
            else
                d.remove_style_pseudo_class('checked');
        }
    }

    // grubun rozeti: içindeki sayfaların rozetlerinden ilki (kritik bilgi grup düzeyinde de görünür)
    _grupRozetYaz() {
        if (!this._grupDugme)
            return;
        for (const g of this._gruplar) {
            const metin = g.sayfalar.map(id => this._rozetler.get(id)).find(Boolean) ?? '';
            const r = this._grupDugme.get(g.id).rozet;
            r.text = metin;
            r.visible = !!metin;
        }
    }

    _tasarimUygula(yenile = true) {
        const v3 = this._v3();
        this._tasinan.forEach(d => (d.visible = !v3));
        this._dahaBaslik.visible = v3;
        // çalışma alanları v3'te şeride, diğerlerinde başlığa (aynı aktör taşınır)
        const alan = this.calismaAlanlari.actor;
        const hedef = v3 ? this._dahaAlanKutu : this._ustSerit;
        if (alan.get_parent() !== hedef) {
            const sira = this._ustSerit.get_children().indexOf(this._hava.actor) + 2;
            alan.get_parent()?.remove_child(alan);
            if (v3)
                this._dahaAlanKutu.set_child(alan);
            else
                this._ustSerit.insert_child_at_index(alan, sira);
        }
        if (!v3)
            this._dahaAcKapa(false);
        this._duzKatman.visible = !v3;
        this._v3Gezinme.visible = v3;
        if (v3)
            this.actor.add_style_class_name('flugel-v3-kart');
        else
            this.actor.remove_style_class_name('flugel-v3-kart');
        if (v3)
            this._v3SecimYaz();
        this._canliAcik = false;
        if (yenile && this._sonCanli)
            this.canliGuncelle(...this._sonCanli);
        this._boyutBildir();
    }

    _boyutBildir() {
        if (this._boyutId)
            return;
        // aynı karede birden çok değişikliği tek animasyonda topla
        this._boyutId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._boyutId = 0;
            if (this.actor.mapped)
                this.boyutDegisti?.();
            return GLib.SOURCE_REMOVE;
        });
    }

    saatYaz() {
        const t = GLib.DateTime.new_now_local();
        this._saat.text = t.format('%H:%M');
        this._tarih.text = `${t.get_day_of_month()} ${AYLAR()[t.get_month() - 1]} ${GUNLER()[t.get_day_of_week() % 7]}`;
    }

    _dahaAcKapa(ac = !this._dahaPanel.visible) {
        if (ac === this._dahaPanel.visible)
            return;
        if (ac) {
            this._gucAcKapa(false);
            this._dahaBaslik.add_style_pseudo_class('checked');
        } else {
            this._dahaBaslik.remove_style_pseudo_class('checked');
        }
        yumusakAc(this._dahaPanel, ac, () => this._boyutBildir());
        this._boyutBildir();
    }

    _gucAcKapa(ac = !this._gucPanel.visible) {
        if (ac === this._gucPanel.visible)
            return;
        if (ac && this._dahaPanel?.visible)
            this._dahaAcKapa(false);
        if (ac)
            this._gucDugme.add_style_pseudo_class('checked');
        else
            this._gucDugme.remove_style_pseudo_class('checked');
        yumusakAc(this._gucPanel, ac, () => this._boyutBildir());
        this._boyutBildir();
    }

    sekmeSec(id, animasyon = true) {
        const yeni = this._sayfalar.find(s => s.id === id);
        if (!yeni || this._secili === yeni)
            return;
        const eski = this._secili;
        this._secili = yeni;
        // ısınma turu dışındaki seçim, tur bitince geri dönülecek sekmedir
        if (!this._isitiyor)
            this._isitHedef = yeni;
        for (const [sid, s] of this._sekmeler) {
            if (sid === id)
                s.dugme.add_style_pseudo_class('checked');
            else
                s.dugme.remove_style_pseudo_class('checked');
        }
        if (eski) {
            eski.sayfa.gizle();
            eski.sayfa.actor.hide();
        }
        // kart açıksa sayfa verisini tazele (kapalıyken sorgu yapılmaz)
        yeni.sayfa.actor.show();
        if (this.actor.mapped)
            yeni.sayfa.goster();
        this._kaydirma.vadjustment.value = 0;
        if (this._v3()) {
            this._v3SecimYaz();
            if (animasyon && this.actor.mapped && St.Settings.get().enable_animations) {
                // v3: kayma yok, kısa opaklık + 4 px; eski geçişler iptal
                yeni.sayfa.actor.remove_all_transitions();
                yeni.sayfa.actor.translation_x = 0;
                yeni.sayfa.actor.opacity = 0;
                yeni.sayfa.actor.translation_y = 4;
                yeni.sayfa.actor.ease({opacity: 255, translation_y: 0, duration: 170, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            }
        } else if (animasyon && this.actor.mapped && St.Settings.get().enable_animations) {
            // sağdaki sekmeye geçince sayfa sağdan, soldakine geçince soldan kayarak gelir
            const sira = s => this._sayfalar.indexOf(s);
            const yon = eski && sira(yeni) < sira(eski) ? -1 : 1;
            yeni.sayfa.actor.opacity = 0;
            yeni.sayfa.actor.translation_x = 26 * yon;
            yeni.sayfa.actor.ease({opacity: 255, translation_x: 0, duration: 240, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            bulanikGecis(yeni.sayfa.actor, {giris: true, yaricap: 6, sure: 240, acik: this._ayar.get_boolean('bulanik-gecis')});
        }
        this._ayar.set_string('son-sekme', id);
        this._seciciYerlestir(animasyon);
        this._boyutBildir();
    }

    _seciciYerlestir(animasyon) {
        const d = this._sekmeler.get(this._secili?.id)?.dugme;
        if (!d || !this._secici)
            return;
        // sayfa değişirken yerleşim yeniden istenir (has_allocation false olur) ama sekmelerin yeri değişmez
        const b = d.get_allocation_box();
        if (b.x2 - b.x1 <= 0)
            return;
        const [x, y] = [b.x1 + this._sekmeKutu.get_allocation_box().x1, b.y1 + this._sekmeKutu.get_allocation_box().y1];
        const [w, h] = [b.x2 - b.x1, b.y2 - b.y1];
        if (this._secici.x === x && this._secici.width === w && this._secici.opacity === 255)
            return;
        this._secici.remove_all_transitions();
        if (animasyon && this._secici.opacity === 255 && St.Settings.get().enable_animations) {
            this._secici.ease({x, y, width: w, height: h, duration: 220, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        } else {
            this._secici.set_position(x, y);
            this._secici.set_size(w, h);
            this._secici.opacity = 255;
        }
    }

    acildi() {
        this.saatYaz();
        this._sayfaYuksekligi();
        this._secili?.sayfa.goster();
        // bölümler sırayla, hafifçe yukarı kayarak belirir (ada büyürken)
        if (St.Settings.get().enable_animations && this._v3()) {
            // v3: kademeli gecikme yok; iki grup (başlık+canlı, gezinme+içerik) birlikte biter
            const ikinci = new Set([this._v3Gezinme, this._kaydirma]);
            this.actor.get_children().filter(c => c.visible).forEach(c => {
                c.remove_transition('opacity');
                c.remove_transition('translation-y');
                c.opacity = 0;
                c.translation_y = 6;
                c.ease({opacity: 255, translation_y: 0, delay: ikinci.has(c) ? 30 : 0, duration: ikinci.has(c) ? 190 : 180,
                    mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            });
        } else if (St.Settings.get().enable_animations) {
            this.actor.get_children().filter(c => c.visible).forEach((c, i) => {
                c.remove_transition('opacity');
                c.opacity = 0;
                c.translation_y = 10;
                c.ease({opacity: 255, translation_y: 0, delay: 70 + i * 45, duration: 280, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            });
        }
    }

    // açılıştan sonra boşta: her sekme bir kez çizilir (ilk açılışta/geçişte takılma olmasın)
    isit(bitince) {
        const sira = [...this._sayfalar];
        this._isitHedef = this._secili;
        const adim = () => {
            const s = sira.shift();
            if (!s || !this.actor.mapped) {
                // tur sırasında kullanıcı sekme değiştirdiyse onda kalınır
                if (this._isitHedef)
                    this.sekmeSec(this._isitHedef.id, false);
                this._isitId = 0;
                bitince?.();
                return GLib.SOURCE_REMOVE;
            }
            this._isitiyor = true;
            this.sekmeSec(s.id, false);
            this._isitiyor = false;
            return GLib.SOURCE_CONTINUE;
        };
        this._isitId = GLib.timeout_add(GLib.PRIORITY_LOW, 150, adim);
    }

    kapandi() {
        if (this._canliAcik) {
            this._canliAcik = false;
            if (this._sonCanli)
                this.canliGuncelle(...this._sonCanli);
        }
        if (this._dahaPanel.visible) {
            this._dahaPanel.hide();
            this._dahaBaslik.remove_style_pseudo_class('checked');
        }
        if (this._gucPanel.visible) {
            this._gucPanel.hide();
            this._gucDugme.remove_style_pseudo_class('checked');
        }
        for (const s of this._sayfalar)
            s.sayfa.kapandi();
    }

    _sayfaYuksekligi() {
        // kart, ekranın %86'sını geçmesin; fazlası kayar
        const m = Main.layoutManager.primaryMonitor;
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        // v3'te başlık + iki satır canlı + grup çubuğu + iç seçim daha uzun; içerik kayar, başlık ve gezinme sabit
        const sabit = this._v3() ? 250 + (this._canli.visible ? 120 : 0) : 190;
        const azami = Math.round((m.height * 0.86) / s) - sabit;
        this._kaydirma.style = `max-height: ${Math.max(220, azami)}px;`;
    }

    sabitDurumu(sabit) {
        if (sabit)
            this._sabitDugme.add_style_pseudo_class('checked');
        else
            this._sabitDugme.remove_style_pseudo_class('checked');
    }

    canliGuncelle(canli, ortam) {
        this._sonCanli = [canli, ortam];
        // tasarım değişince oynatıcılar yeni tasarımla baştan kurulur
        this._tasarimId ??= this._ayar.connect('changed::tasarim', () => {
            for (const [id, g] of [...this._canliGorunumler]) {
                if (g instanceof MedyaOynatici || g instanceof MedyaOynaticiKlasik) {
                    g.destroy();
                    this._canliGorunumler.delete(id);
                }
            }
            if (this._sonCanli)
                this.canliGuncelle(...this._sonCanli);
        });
        // genişletilmiş kartta: kalıcı etkinliklerin hepsi + mini olmayan ortam etkinlikleri
        const tum = [...canli, ...ortam.filter(a => a.data?.kartta)];
        // v3: en çok iki satır; gizli kalanların aktörü kurulmaz
        const kisa = this._v3() && !this._canliAcik && tum.length > CANLI_AZAMI;
        const liste = kisa ? tum.slice(0, CANLI_AZAMI) : tum;
        const kalan = new Set(this._canliGorunumler.keys());
        liste.forEach((a, i) => {
            let g = this._canliGorunumler.get(a.id);
            if (!g) {
                const Oynatici = this._ayar.get_string('tasarim') === 'klasik' ? MedyaOynaticiKlasik : MedyaOynatici;
                g = a.data?.medya ? new Oynatici(this._ayar) : new EtkinlikGorunumu('satir');
                this._canliGorunumler.set(a.id, g);
                this._canli.add_child(g.actor);
            }
            this._canli.set_child_at_index(g.actor, i);
            g.guncelle(a);
            // v3.1: sağ tık (ya da Menü tuşu) satır menüsü: sustur / önceliklendir
            g._flugelEtkinlik = a;
            if (!g._flugelMenuId) {
                g.actor.reactive = true;
                g._flugelMenuId = g.actor.connect('button-press-event', (_act, olay) => {
                    if (olay.get_button() !== 3 || !this._v3())
                        return Clutter.EVENT_PROPAGATE;
                    this._satirMenu(g._flugelEtkinlik, g.actor);
                    return Clutter.EVENT_STOP;
                });
                g.actor.connect('key-press-event', (_act, olay) => {
                    if (olay.get_key_symbol() !== Clutter.KEY_Menu || !this._v3())
                        return Clutter.EVENT_PROPAGATE;
                    this._satirMenu(g._flugelEtkinlik, g.actor);
                    return Clutter.EVENT_STOP;
                });
            }
            kalan.delete(a.id);
        });
        for (const id of kalan) {
            this._canliGorunumler.get(id).destroy();
            this._canliGorunumler.delete(id);
        }
        this._dahaYaz(this._v3() && tum.length > CANLI_AZAMI ? tum.length - CANLI_AZAMI : 0, liste.length);
        this._susturulanYaz();
        this._canli.visible = liste.length > 0 || !!this._susturulanDugme?.visible;
        this._boyutBildir();
    }

    // susturulmuş kaynak varsa küçük hap: "N kaynak susturuldu" — tıklayınca hepsi geri gelir
    _susturulanYaz() {
        const n = this._v3() ? this.susturulanSayisi?.() ?? 0 : 0;
        if (!n) {
            this._susturulanDugme?.hide();
            return;
        }
        if (!this._susturulanDugme) {
            this._susturulanDugme = new St.Button({style_class: 'flugel-v3-daha', can_focus: true, x_align: Clutter.ActorAlign.START});
            this._susturulanDugme.connect('clicked', () => this.susturmaKaldir?.());
            ipucuBagla(this._susturulanDugme, _('Susturulan canlı etkinlikleri geri getir'));
            this._canli.add_child(this._susturulanDugme);
        }
        this._susturulanDugme.label = _('%d kaynak susturuldu').format(n);
        this._susturulanDugme.accessible_name = this._susturulanDugme.label;
        this._canli.set_child_above_sibling(this._susturulanDugme, null);
        this._susturulanDugme.show();
        this._canli.visible = true;
    }

    _satirMenu(a, kaynak) {
        if (!a)
            return;
        this._satirMenuKapat();
        const menu = new PopupMenu.PopupMenu(kaynak, 0.5, St.Side.TOP);
        menu.actor.add_style_class_name('flugel-kart-menu');
        Main.uiGroup.add_child(menu.actor);
        this._satirMenuYon ??= new PopupMenu.PopupMenuManager(this.actor);
        this._satirMenuYon.addMenu(menu);
        if (ActivityManager.isCritical(a)) {
            menu.addMenuItem(new PopupMenu.PopupMenuItem(_('Kritik uyarı susturulamaz'), {reactive: false}));
        } else {
            menu.addAction(_('1 saat sustur'), () => this.susturIstendi?.(a.providerId, 'saat'));
            menu.addAction(_('Bu oturumda sustur'), () => this.susturIstendi?.(a.providerId, 'oturum'));
        }
        menu.addAction(this.onceMi?.(a.providerId) ? _('Önceliği kaldır') : _('Önceliklendir'),
            () => this.oncelikIstendi?.(a.providerId));
        menu.connect('open-state-changed', (_m, acik) => {
            if (acik)
                return;
            this.disMenuKapandi?.();
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (this._satirMenuObj === menu)
                    this._satirMenuKapat();
                return GLib.SOURCE_REMOVE;
            });
        });
        this._satirMenuObj = menu;
        menu.open(true);
    }

    _satirMenuKapat() {
        const m = this._satirMenuObj;
        this._satirMenuObj = null;
        if (!m)
            return;
        this._satirMenuYon?.removeMenu(m);
        m.destroy();
    }

    // "+N daha" / "Daha az" düğmesi (canlı listenin sonunda)
    _dahaYaz(fazla, sira) {
        if (!fazla) {
            this._dahaDugme?.hide();
            return;
        }
        if (!this._dahaDugme) {
            this._dahaDugme = new St.Button({style_class: 'flugel-v3-daha', can_focus: true, x_align: Clutter.ActorAlign.START});
            this._dahaDugme.connect('clicked', () => {
                this._canliAcik = !this._canliAcik;
                if (this._sonCanli)
                    this.canliGuncelle(...this._sonCanli);
            });
            ipucuBagla(this._dahaDugme, () => this._canliAcik ? _('Canlı etkinlikleri kısalt') : _('Tüm canlı etkinlikleri göster'));
            this._canli.add_child(this._dahaDugme);
        }
        this._dahaDugme.label = this._canliAcik ? _('Daha az') : _('+%d daha').format(fazla);
        this._dahaDugme.accessible_name = this._dahaDugme.label;
        this._canli.set_child_at_index(this._dahaDugme, sira);
        this._dahaDugme.show();
    }

    disMenuAcik() {
        return onizlemeAcik() || this._tepsi.disMenuAcik() || !!this._satirMenuObj?.isOpen ||
            this._sayfalar.some(s => s.sayfa.disMenuAcik());
    }

    destroy() {
        this._satirMenuKapat();
        if (this._v3Id)
            this._ayar.disconnect(this._v3Id);
        this._v3Id = 0;
        if (this._tasarimId)
            this._ayar.disconnect(this._tasarimId);
        this._tasarimId = 0;
        this._hava?.destroy();
        if (this._seciciId)
            GLib.source_remove(this._seciciId);
        this._seciciId = 0;
        if (this._isitId)
            GLib.source_remove(this._isitId);
        this._isitId = 0;
        if (this._boyutId)
            GLib.source_remove(this._boyutId);
        this._boyutId = 0;
        for (const s of this._sayfalar)
            s.sayfa.destroy();
        this._tepsi.destroy();
        this.calismaAlanlari.destroy();
        this._canliGorunumler.clear();
        this.actor.destroy();
    }
}
