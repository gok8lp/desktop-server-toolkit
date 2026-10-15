// FLUGEL Island — bir canlı etkinliğin kapsül/balon/kart içindeki görünümü.
// Etkinlik nesnesi (activity.js) yalnızca veridir; burada St aktörlerine çevrilir ve yerinde güncellenir.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ikon} from './ortak.js';
import {dugme} from './bilesenler.js';
import {Esitleyici} from './medya.js';
import {_} from './dil.js';

function etiket(stil, metin = '') {
    const l = new St.Label({text: metin, style_class: stil, y_align: Clutter.ActorAlign.CENTER});
    l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    return l;
}

// bicim: 'kompakt' (kapsül), 'balon' (ikinci küçük balon), 'flas' (kısa süreli), 'satir' (karttaki liste)
export class EtkinlikGorunumu {
    constructor(bicim) {
        this.bicim = bicim;
        if (bicim === 'bildirim') {
            this._bildirimKur();
            return;
        }
        this.actor = new St.BoxLayout({style_class: `flugel-etkinlik flugel-etkinlik-${bicim}`,
            x_expand: bicim !== 'balon', y_align: Clutter.ActorAlign.CENTER});
        this._kapak = new St.Icon({style_class: 'flugel-kapak', icon_size: bicim === 'satir' ? 36 : 18, visible: false,
            y_align: Clutter.ActorAlign.CENTER});
        this._simge = new St.Icon({style_class: 'flugel-etkinlik-simge', icon_size: bicim === 'satir' ? 22 : 16,
            y_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(this._kapak);
        this.actor.add_child(this._simge);

        if (bicim === 'balon') {
            this._kisa = etiket('flugel-etkinlik-kisa');
            this.actor.add_child(this._kisa);
            return;
        }
        const metinler = new St.BoxLayout({orientation: bicim === 'satir' ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL,
            x_expand: true, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-etkinlik-metin'});
        this._baslik = etiket('flugel-etkinlik-baslik');
        this._alt = etiket('flugel-etkinlik-alt');
        metinler.add_child(this._baslik);
        metinler.add_child(this._alt);
        this.actor.add_child(metinler);

        this._ilerleme = new St.Widget({style_class: 'flugel-ilerleme', visible: false, y_align: Clutter.ActorAlign.CENTER});
        this._dolgu = new St.Widget({style_class: 'flugel-ilerleme-dolgu'});
        this._ilerleme.add_child(this._dolgu);
        this.actor.add_child(this._ilerleme);

        this._kisa = etiket('flugel-etkinlik-kisa');
        this.actor.add_child(this._kisa);

        if (bicim === 'satir') {
            this._eylemler = new St.BoxLayout({style_class: 'flugel-etkinlik-eylemler', y_align: Clutter.ActorAlign.CENTER});
            this.actor.add_child(this._eylemler);
            this._eylemAnahtar = '';
        }
    }

    _bildirimKur() {
        this.actor = new St.BoxLayout({style_class: 'flugel-bildirim', x_expand: true, orientation: Clutter.Orientation.VERTICAL});
        const ust = new St.BoxLayout({style_class: 'flugel-bildirim-ust'});
        this._kaynakSimge = new St.Icon({icon_size: 14, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-bildirim-kaynak-simge'});
        this._uygulama = etiket('flugel-bildirim-uygulama');
        this._uygulama.x_expand = true;
        ust.add_child(this._kaynakSimge);
        ust.add_child(this._uygulama);
        ust.add_child(etiket('flugel-bildirim-zaman', _('şimdi')));
        this.actor.add_child(ust);
        const govde = new St.BoxLayout({style_class: 'flugel-bildirim-govde'});
        this._simge = new St.Icon({icon_size: 40, y_align: Clutter.ActorAlign.START, style_class: 'flugel-bildirim-simge'});
        govde.add_child(this._simge);
        const metin = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this._baslik = etiket('flugel-bildirim-baslik');
        this._alt = new St.Label({style_class: 'flugel-bildirim-metin'});
        this._alt.clutter_text.line_wrap = true;
        this._alt.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        metin.add_child(this._baslik);
        metin.add_child(this._alt);
        govde.add_child(metin);
        this.actor.add_child(govde);
    }

    // kapsülde canlı maç: [logo] Ev  1 – 1  Dep [logo]  dakika
    _macGoster(m) {
        if (!this._mac) {
            this._mac = new St.BoxLayout({style_class: 'flugel-mac-kapsul', x_expand: true, y_align: Clutter.ActorAlign.CENTER});
            const logo = () => new St.Icon({icon_size: 18, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-mac-kapsul-logo'});
            this._macEvLogo = logo();
            this._macEv = etiket('flugel-mac-kapsul-takim');
            this._macSkor = etiket('flugel-mac-kapsul-skor');
            this._macDep = etiket('flugel-mac-kapsul-takim');
            this._macDepLogo = logo();
            this._macDk = etiket('flugel-mac-kapsul-dakika');
            for (const c of [this._macEvLogo, this._macEv, this._macSkor, this._macDep, this._macDepLogo, this._macDk])
                this._mac.add_child(c);
            this.actor.add_child(this._mac);
            // görünüm üst aktörüyle birlikte yok edilirse (destroy() çağrılmadan) zamanlayıcı ölü etikete dokunmasın
            this._mac.connect('destroy', () => {
                if (this._vurguId)
                    GLib.source_remove(this._vurguId);
                this._vurguId = 0;
            });
        }
        const ikonYol = y => (y ? Gio.FileIcon.new(Gio.File.new_for_path(y)) : ikon('emblem-default-symbolic'));
        this._macEvLogo.gicon = ikonYol(m.evLogo);
        this._macDepLogo.gicon = ikonYol(m.depLogo);
        this._macEv.text = m.ev;
        this._macDep.text = m.dep;
        this._macSkor.text = m.skor;
        this._macDk.text = [m.dakika, m.ek].filter(Boolean).join(' · ');
        if (m.vurgu && m.vurguNo !== this._vurguNo) {
            this._vurguNo = m.vurguNo;
            const hedef = m.vurgu === 'ev' ? this._macEv : this._macDep;
            for (const l of [this._macEv, this._macDep])
                l.remove_style_class_name('flugel-mac-kapsul-raund');
            hedef.add_style_class_name('flugel-mac-kapsul-raund');
            if (this._vurguId)
                GLib.source_remove(this._vurguId);
            this._vurguId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4500, () => {
                this._vurguId = 0;
                hedef.remove_style_class_name('flugel-mac-kapsul-raund');
                return GLib.SOURCE_REMOVE;
            });
        }
        this._mac.show();
        for (const c of this.actor.get_children()) {
            if (c !== this._mac)
                c.hide();
        }
    }

    guncelle(a) {
        const d = a.data ?? {};
        if (d.mac && (this.bicim === 'kompakt' || this.bicim === 'flas')) {
            this.id = a.id;
            this._macGoster(d.mac);
            return;
        }
        if (this.bicim === 'bildirim') {
            this.id = a.id;
            this._simge.gicon = ikon(a.glyph ?? 'mail-unread-symbolic');
            this._kaynakSimge.gicon = ikon(d.kaynakSimge ?? a.glyph ?? 'mail-unread-symbolic');
            this._uygulama.text = d.uygulama ?? '';
            this._baslik.text = a.label;
            this._alt.text = (a.sublabel ?? '').slice(0, 240);
            this._alt.visible = !!a.sublabel;
            return;
        }
        this.id = a.id;
        if (d.kapak) {
            this._kapak.gicon = d.kapak;
            this._kapak.show();
        } else {
            this._kapak.hide();
        }
        if (a.glyph) {
            this._simge.gicon = ikon(a.glyph);
            this._simge.show();
        } else {
            this._simge.hide();
        }
        // renk sadece uyarı/kayıt gibi durumlarda; normalde siyah-beyaz
        this._simge.style = d.renk ? `color: ${d.renk};` : null;
        this._simge.opacity = 255;
        if (d.yanip)
            this._simge.add_style_class_name('flugel-yanip');
        else
            this._simge.remove_style_class_name('flugel-yanip');

        if (this.bicim === 'balon') {
            this._kisa.text = d.kisa ?? '';
            this._kisa.visible = !!this._kisa.text;
            return;
        }
        this._baslik.text = a.label;
        this._alt.text = a.sublabel ? (this.bicim === 'satir' ? a.sublabel : `· ${a.sublabel}`) : '';
        this._alt.visible = !!a.sublabel && this.bicim !== 'flas';
        const ilerleme = Number.isFinite(d.ilerleme);
        this._ilerleme.visible = ilerleme;
        if (ilerleme) {
            const genislik = this.bicim === 'satir' ? 120 : 70;
            const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            this._ilerleme.set_width(genislik * s);
            this._dolgu.set_width(Math.round(genislik * s * Math.max(0, Math.min(1, d.ilerleme))));
        }
        this._kisa.text = d.kisa ?? '';
        this._kisa.visible = !!this._kisa.text && this.bicim !== 'flas';
        // çalan medya: kapsülün sağında dans eden ekolayzer (Atoll gibi)
        if (d.medya && this.bicim === 'kompakt') {
            if (!this._esit) {
                this._esit = new Esitleyici({cubuk: 4, yukseklik: 12, genislik: 3});
                this.actor.add_child(this._esit.actor);
            }
            this._esit.actor.show();
            this._esit.caliyor = d.medya.caliyor;
        } else if (this._esit) {
            this._esit.caliyor = false;
            this._esit.actor.hide();
        }

        if (this.bicim === 'satir')
            this._eylemleriKur(d);
    }

    _eylemleriKur(d) {
        const eylemler = d.eylemler ?? [];
        const anahtar = eylemler.map(e => e.ikon).join('|') + (d.kapat ? '|x' : '');
        // aynı simgeler duruyorsa düğmeleri yeniden kurmayız (fare üstündeyken titremesin);
        // sadece geri çağrıları tazeleriz
        this._eylemFonk = eylemler.map(e => e.fn);
        this._kapatFonk = d.kapat ?? null;
        if (anahtar === this._eylemAnahtar)
            return;
        this._eylemAnahtar = anahtar;
        this._eylemler.destroy_all_children();
        eylemler.forEach((e, i) => this._eylemler.add_child(
            dugme(e.ikon, e.ipucu, () => this._eylemFonk[i]?.(), {stil: 'flugel-dugme flugel-dugme-kucuk'})));
        if (d.kapat) {
            this._eylemler.add_child(dugme('window-close-symbolic', _('Gizle'), () => this._kapatFonk?.(),
                {stil: 'flugel-dugme flugel-dugme-kucuk flugel-dugme-soluk', boyut: 14}));
        }
    }

    destroy() {
        if (this._vurguId)
            GLib.source_remove(this._vurguId);
        this._vurguId = 0;
        this.actor.destroy();
    }
}
