// FLUGEL Island — bir canlı etkinliğin kapsül/balon/kart içindeki görünümü.
// Etkinlik nesnesi (activity.js) yalnızca veridir; burada St aktörlerine çevrilir ve yerinde güncellenir.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import {ikon} from './ortak.js';
import {dugme} from './bilesenler.js';
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

    guncelle(a) {
        const d = a.data ?? {};
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
        this.actor.destroy();
    }
}
