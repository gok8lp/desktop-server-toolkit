// FLUGEL Island — ortak arayüz bileşenleri (karanlık tema, siyah-beyaz):
//   Ipucu      tek bir paylaşılan açıklama balonu (başlık + 1-2 satır ayrıntı), 350 ms gecikmeli
//   Karo       simge + kısa etiket (+ rozet, + durum noktası); üzerine gelince balon, tıklayınca işlem, klavyeyle seçilir
//   Izgara     karoları sütunlara dizer (sütun sayısı genişliğe göre)
//   ResimKaro  kapak resmi + rozet; üzerine gelince büyüyen önizleme (anime/manga)
//   Bolum      küçük başlıklı bölüm kutusu
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ikon} from './ortak.js';
import {_} from './dil.js';

const GECIKME = 350;
const sf = () => St.ThemeContext.get_for_stage(global.stage).scale_factor;

// ---------- paylaşılan ipucu balonu ----------
let balon = null, balonZaman = 0, balonSahibi = null;

function balonKur() {
    if (balon)
        return balon;
    balon = new St.BoxLayout({style_class: 'flugel-ipucu', orientation: Clutter.Orientation.VERTICAL, visible: false,
        reactive: false});
    balon._baslik = new St.Label({style_class: 'flugel-ipucu-baslik'});
    balon._ayrinti = new St.Label({style_class: 'flugel-ipucu-ayrinti'});
    balon._ayrinti.clutter_text.line_wrap = true;
    balon.add_child(balon._baslik);
    balon.add_child(balon._ayrinti);
    Main.layoutManager.addTopChrome(balon);
    return balon;
}

function balonGizle(sahip) {
    if (sahip && sahip !== balonSahibi)
        return;
    if (balonZaman)
        GLib.source_remove(balonZaman);
    balonZaman = 0;
    balonSahibi = null;
    balon?.hide();
}

// icerik: 'metin' | {baslik, ayrinti} | () => (bunlardan biri)
export function ipucuBagla(aktor, icerik) {
    aktor.connect('notify::hover', () => {
        if (!aktor.hover) {
            balonGizle(aktor);
            return;
        }
        if (balonZaman)
            GLib.source_remove(balonZaman);
        balonSahibi = aktor;
        balonZaman = GLib.timeout_add(GLib.PRIORITY_DEFAULT, GECIKME, () => {
            balonZaman = 0;
            let c = typeof icerik === 'function' ? icerik() : icerik;
            if (!c || !aktor.hover || !aktor.get_stage() || aktor.menu?.isOpen)
                return GLib.SOURCE_REMOVE;
            if (typeof c === 'string')
                c = {baslik: c};
            const b = balonKur();
            b._baslik.text = c.baslik ?? '';
            b._ayrinti.text = c.ayrinti ?? '';
            b._ayrinti.visible = !!c.ayrinti;
            b.show();
            const [x, y] = aktor.get_transformed_position();
            const [w, h] = aktor.get_transformed_size();
            const m = Main.layoutManager.findMonitorForActor(aktor) ?? Main.layoutManager.primaryMonitor;
            const [, bw] = b.get_preferred_width(-1);
            const [, bh] = b.get_preferred_height(bw);
            const bx = Math.max(m.x + 4, Math.min(Math.round(x + w / 2 - bw / 2), m.x + m.width - bw - 4));
            const altta = y + h + 6 + bh < m.y + m.height;
            b.set_position(bx, Math.round(altta ? y + h + 6 : y - bh - 6));
            b.opacity = 0;
            b.ease({opacity: 255, duration: 120, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            return GLib.SOURCE_REMOVE;
        });
    });
    aktor.connect('button-press-event', () => {
        balonGizle(aktor);
        return Clutter.EVENT_PROPAGATE;
    });
    aktor.connect('destroy', () => balonGizle(aktor));
}

// ---------- karo ----------
export class Karo {
    // {ikon, etiket, ipucu, eylem, boyut, rozet, genislik, stil}
    constructor(o) {
        this._o = o;
        this.actor = new St.Button({style_class: `flugel-karo ${o.stil ?? ''}`, can_focus: true, reactive: true,
            accessible_name: o.etiket ?? (typeof o.ipucu === 'string' ? o.ipucu : o.ipucu?.baslik) ?? ''});
        if (o.genislik)
            this.actor.style = `width: ${o.genislik}px;`;
        const kutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER});
        const ust = new St.Widget({layout_manager: new Clutter.BinLayout(), x_align: Clutter.ActorAlign.CENTER});
        this._simge = new St.Icon({gicon: ikon(o.ikon), icon_size: o.boyut ?? 24, style_class: 'flugel-karo-simge'});
        ust.add_child(this._simge);
        this._nokta = new St.Widget({style_class: 'flugel-nokta', visible: false, x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END});
        ust.add_child(this._nokta);
        this._rozet = new St.Label({style_class: 'flugel-rozet', visible: false, x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START});
        ust.add_child(this._rozet);
        kutu.add_child(ust);
        this._etiket = new St.Label({style_class: 'flugel-karo-etiket', text: o.etiket ?? '', visible: !!o.etiket,
            x_align: Clutter.ActorAlign.CENTER});
        this._etiket.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        kutu.add_child(this._etiket);
        this.actor.set_child(kutu);
        // sol tık: eylem, sağ tık: sagTik (ör. sabitlenmiş uygulamayı kaldır)
        this.actor.button_mask = St.ButtonMask.ONE | St.ButtonMask.THREE;
        this.actor.connect('clicked', (_b, n) => (n === 3 ? this._o.sagTik?.() : this._o.eylem?.()));
        if (o.ipucu)
            ipucuBagla(this.actor, () => this._o.ipucu);
        this.rozet(o.rozet);
    }

    rozet(metin) {
        this._rozet.text = metin ? String(metin) : '';
        this._rozet.visible = !!metin;
    }

    // durum: null | 'acik' | 'kapali' | 'bekliyor' | 'uyari'
    nokta(durum) {
        this._nokta.visible = !!durum;
        this._nokta.style_class = `flugel-nokta flugel-nokta-${durum ?? 'yok'}`;
    }

    guncelle(o) {
        Object.assign(this._o, o);
        if (o.ikon)
            this._simge.gicon = ikon(o.ikon);
        if ('etiket' in o) {
            this._etiket.text = o.etiket ?? '';
            this._etiket.visible = !!o.etiket;
        }
        if ('rozet' in o)
            this.rozet(o.rozet);
    }

    secili(evet) {
        if (evet)
            this.actor.add_style_pseudo_class('checked');
        else
            this.actor.remove_style_pseudo_class('checked');
    }
}

// ---------- ızgara ----------
export class Izgara {
    // sutun: sabit sütun sayısı; yoksa genislik/karoGenisligi'nden hesaplanır
    constructor({sutun, karoGenisligi = 88, genislik = 680, bosluk = 6} = {}) {
        this._sutun = sutun ?? Math.max(3, Math.floor((genislik + bosluk) / (karoGenisligi + bosluk)));
        // sabit sütun sayısıyla (sutun verildiyse) karolar genişliği paylaşır; yoksa sabit boyutlu ve ortalı dizilir
        this._sabit = sutun ? null : karoGenisligi;
        this._duzen = new Clutter.GridLayout({column_spacing: bosluk, row_spacing: bosluk, column_homogeneous: true});
        this.actor = new St.Widget({layout_manager: this._duzen, x_expand: !!sutun, style_class: 'flugel-izgara',
            x_align: sutun ? Clutter.ActorAlign.FILL : Clutter.ActorAlign.START});
        this._n = 0;
    }

    ekle(karo) {
        const a = karo.actor ?? karo;
        if (this._sabit)
            a.style = `${a.style ?? ''} width: ${this._sabit}px;`;
        this._duzen.attach(a, this._n % this._sutun, Math.floor(this._n / this._sutun), 1, 1);
        this._n++;
        return karo;
    }

    temizle() {
        this.actor.destroy_all_children();
        this._n = 0;
    }

    get sayi() {
        return this._n;
    }
}

// ---------- bölüm ----------
export function bolum(baslik, icerik, {sag} = {}) {
    const kutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-bolum', x_expand: true});
    if (baslik) {
        const ust = new St.BoxLayout({style_class: 'flugel-bolum-ust'});
        ust.add_child(new St.Label({text: baslik, style_class: 'flugel-bolum-baslik', x_expand: true,
            y_align: Clutter.ActorAlign.CENTER}));
        if (sag)
            ust.add_child(sag);
        kutu.add_child(ust);
    }
    if (icerik)
        kutu.add_child(icerik.actor ?? icerik);
    return kutu;
}

// ---------- resim karo + büyüyen önizleme ----------
let onizleme = null, onizlemeSahibi = null, onizlemeZaman = 0, onizlemeKapat = 0;

export function onizlemeAcik() {
    return !!onizleme?.visible;
}

function onizlemeGizle(hemen = false) {
    if (onizlemeZaman)
        GLib.source_remove(onizlemeZaman);
    onizlemeZaman = 0;
    if (onizlemeKapat)
        GLib.source_remove(onizlemeKapat);
    onizlemeKapat = 0;
    if (!onizleme?.visible)
        return;
    const o = onizleme;
    onizlemeSahibi = null;
    if (hemen || !St.Settings.get().enable_animations) {
        o.hide();
        return;
    }
    o.ease({opacity: 0, scale_x: 0.92, scale_y: 0.92, duration: 140, mode: Clutter.AnimationMode.EASE_IN_QUAD,
        onStopped: () => {
            if (!onizlemeSahibi)
                o.hide();
        }});
}

function onizlemeKapatPlanla() {
    if (onizlemeKapat)
        GLib.source_remove(onizlemeKapat);
    onizlemeKapat = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
        onizlemeKapat = 0;
        if (!onizleme?.hover && !onizlemeSahibi?.hover)
            onizlemeGizle();
        return GLib.SOURCE_REMOVE;
    });
}

function onizlemeKur() {
    if (onizleme)
        return onizleme;
    onizleme = new St.BoxLayout({style_class: 'flugel-onizleme', reactive: true, track_hover: true, visible: false});
    onizleme._resim = new St.Widget({style_class: 'flugel-onizleme-resim'});
    onizleme._metin = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-onizleme-metin',
        y_align: Clutter.ActorAlign.START});
    onizleme.add_child(onizleme._resim);
    onizleme.add_child(onizleme._metin);
    onizleme.connect('notify::hover', () => {
        if (!onizleme.hover)
            onizlemeKapatPlanla();
    });
    Main.layoutManager.addTopChrome(onizleme);
    return onizleme;
}

export class ResimKaro {
    // {resim: dosya yolu, baslik, puan, rozet, boyut (genişlik, px), eylem, sagTik,
    //  onizleme: () => ({resim, baslik, satirlar[], dugmeler[]})}
    // Kapak gerçek oranında (2:3) ve kırpılmadan/sıkıştırılmadan gösterilir; üstte puan, altta başlık şeridi.
    constructor(o) {
        this._o = o;
        const g = o.boyut ?? 108, y = Math.round(g * 1.42);
        this.actor = new St.Button({style_class: 'flugel-resim-karo', can_focus: true, track_hover: true,
            accessible_name: o.baslik ?? ''});
        const bin = new St.Widget({layout_manager: new Clutter.BinLayout(), style_class: 'flugel-kapak-zemin',
            style: `${ResimKaro.stil(o.resim)} width: ${g}px; height: ${y}px;`});
        this._resim = bin;
        // üstte puan + rozet, altta başlık şeridi (tek dikey kutu: hizalama kesin)
        const ust = new St.BoxLayout({style_class: 'flugel-kapak-ust'});
        if (o.puan)
            ust.add_child(new St.Label({text: `★ ${o.puan}`, style_class: 'flugel-kapak-puan'}));
        ust.add_child(new St.Widget({x_expand: true}));
        this._rozet = new St.Label({style_class: 'flugel-rozet flugel-kapak-rozet', visible: false});
        ust.add_child(this._rozet);
        const kat = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, y_expand: true});
        kat.add_child(ust);
        kat.add_child(new St.Widget({y_expand: true}));
        if (o.baslik) {
            const serit = new St.BoxLayout({style_class: 'flugel-kapak-serit', orientation: Clutter.Orientation.VERTICAL});
            const l = new St.Label({text: o.baslik, style_class: 'flugel-kapak-baslik'});
            l.clutter_text.line_wrap = true;
            l.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            serit.add_child(l);
            kat.add_child(serit);
        }
        bin.add_child(kat);
        this.actor.set_child(bin);
        this.actor.set_pivot_point(0.5, 0.5);
        // sol tık: eylem, sağ tık: sagTik (ör. listeden kaldır)
        this.actor.button_mask = St.ButtonMask.ONE | St.ButtonMask.THREE;
        this.actor.connect('clicked', (_b, dugmeNo) => {
            if (dugmeNo === 3)
                this._o.sagTik?.();
            else
                this._o.eylem?.();
        });
        this.actor.connect('notify::hover', () => this._hover());
        this.actor.connect('destroy', () => {
            if (onizlemeSahibi === this.actor)
                onizlemeGizle(true);
        });
        this.rozet(o.rozet);
    }

    // CSS arka planı: resim kutuyu kaplar (cover), oran korunur
    static stil(yol) {
        if (!yol || typeof yol !== 'string')
            return 'background-color: rgba(255,255,255,0.06);';
        const uri = GLib.filename_to_uri(yol, null).replace(/"/g, '%22');
        return `background-image: url("${uri}"); background-size: cover;`;
    }

    static icon(r) {
        if (!r)
            return ikon('image-missing-symbolic');
        if (r instanceof Gio.Icon)
            return r;
        return Gio.FileIcon.new(Gio.File.new_for_path(r));
    }

    rozet(metin) {
        this._rozet.text = metin ? String(metin) : '';
        this._rozet.visible = !!metin;
    }

    _hover() {
        const a = this.actor;
        const anim = St.Settings.get().enable_animations;
        a.remove_transition('scale-x');
        a.remove_transition('scale-y');
        if (anim)
            a.ease({scale_x: a.hover ? 1.06 : 1, scale_y: a.hover ? 1.06 : 1, duration: 160, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        if (!a.hover) {
            onizlemeKapatPlanla();
            return;
        }
        if (!this._o.onizleme)
            return;
        if (onizlemeZaman)
            GLib.source_remove(onizlemeZaman);
        onizlemeZaman = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            onizlemeZaman = 0;
            if (a.hover && a.get_stage())
                this._onizlemeGoster();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onizlemeGoster() {
        const v = this._o.onizleme();
        if (!v)
            return;
        const o = onizlemeKur();
        onizlemeSahibi = this.actor;
        o.remove_all_transitions();
        o._resim.style = `${ResimKaro.stil(v.resim ?? this._o.resim)} width: 240px; height: 340px;`;
        o._metin.destroy_all_children();
        const b = new St.Label({text: v.baslik ?? '', style_class: 'flugel-onizleme-baslik'});
        b.clutter_text.line_wrap = true;
        o._metin.add_child(b);
        for (const s of v.satirlar ?? []) {
            const l = new St.Label({style_class: 'flugel-onizleme-satir'});
            l.clutter_text.line_wrap = true;
            l.clutter_text.set_markup(s);
            o._metin.add_child(l);
        }
        if (v.dugmeler?.length) {
            const dk = new St.BoxLayout({style_class: 'flugel-onizleme-dugmeler'});
            for (const d of v.dugmeler) {
                const btn = new St.Button({style_class: 'flugel-onizleme-dugme', can_focus: true,
                    child: new St.BoxLayout({style: 'spacing: 6px;'})});
                btn.child.add_child(new St.Icon({gicon: ikon(d.ikon), icon_size: 16, style_class: 'flugel-onizleme-dugme-ikon'}));
                btn.child.add_child(new St.Label({text: d.etiket ?? '', y_align: Clutter.ActorAlign.CENTER}));
                btn.connect('clicked', () => {
                    onizlemeGizle(true);
                    d.fn();
                });
                dk.add_child(btn);
            }
            o._metin.add_child(dk);
        }
        o.show();
        const [x, y] = this.actor.get_transformed_position();
        const [w] = this.actor.get_transformed_size();
        const m = Main.layoutManager.findMonitorForActor(this.actor) ?? Main.layoutManager.primaryMonitor;
        const [, ow] = o.get_preferred_width(-1);
        const [, oh] = o.get_preferred_height(ow);
        // kapağın yanında, ekrana sığacak tarafta
        let ox = x + w + Math.round(8 * sf());
        if (ox + ow > m.x + m.width)
            ox = x - ow - Math.round(8 * sf());
        const oy = Math.max(m.y + 4, Math.min(y, m.y + m.height - oh - 4));
        o.set_position(Math.round(ox), Math.round(oy));
        o.set_pivot_point(0, 0);
        if (St.Settings.get().enable_animations) {
            o.opacity = 0;
            o.scale_x = o.scale_y = 0.92;
            o.ease({opacity: 255, scale_x: 1, scale_y: 1, duration: 180, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        } else {
            o.opacity = 255;
            o.scale_x = o.scale_y = 1;
        }
    }
}

// Simge düğmesi (kart başlığı, hızlı başlatma, etkinlik eylemleri)
export function dugme(ikonAdi, ipucu, eylem, {boyut = 16, stil = 'flugel-dugme', etiket = null} = {}) {
    const d = new St.Button({style_class: stil, can_focus: true, accessible_name: ipucu, y_align: Clutter.ActorAlign.CENTER});
    if (etiket) {
        const kutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(new St.Icon({gicon: ikon(ikonAdi), icon_size: boyut, x_align: Clutter.ActorAlign.CENTER}));
        kutu.add_child(new St.Label({text: etiket, style_class: 'flugel-dugme-etiket', x_align: Clutter.ActorAlign.CENTER}));
        d.set_child(kutu);
    } else {
        d.set_child(new St.Icon({gicon: ikon(ikonAdi), icon_size: boyut}));
    }
    d.connect('clicked', () => eylem());
    if (ipucu)
        ipucuBagla(d, ipucu);
    return d;
}

// eklenti kapanırken paylaşılan balonlar kaldırılır
export function bilesenleriTemizle() {
    balonGizle();
    balon?.destroy();
    balon = null;
    onizlemeGizle(true);
    onizleme?.destroy();
    onizleme = null;
}

// aktör kaydırılabilir kart alanında görünmüyorsa yumuşakça görünür hale kaydır (açılan paneller için)
export function gorunurKaydir(aktor) {
    let sv = aktor.get_parent();
    while (sv && !(sv instanceof St.ScrollView))
        sv = sv.get_parent();
    if (!sv || !aktor.mapped)
        return;
    const adj = sv.vadjustment;
    const [, svY] = sv.get_transformed_position();
    const [, aY] = aktor.get_transformed_position();
    const ust = aY - svY + adj.value, alt = ust + aktor.height;
    let hedef = adj.value;
    if (alt > adj.value + adj.page_size)
        hedef = Math.min(ust, alt - adj.page_size);
    else if (ust < adj.value)
        hedef = ust;
    if (hedef !== adj.value)
        adj.ease(hedef, {duration: 260, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
}
