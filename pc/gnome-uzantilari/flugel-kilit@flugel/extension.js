// Flugel Kilit Ekrani — siyah zemin, saatin ustunde FLUGEL, altinda siyah-beyaz widgetlar (sistem-bakim)
//  BTC/ETH · siradaki anime bolumu · pil · sunucu durumu · Re:Zero ekibinden biri
// Veri: ~/.local/bin/ust-panel-veri (canli | anime | pc | sunucu) -> JSON. Sadece kilitliyken, dakikada bir.
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const H = GLib.get_home_dir();
const VERI = `${H}/.local/bin/ust-panel-veri`;
const EKIP = `${H}/.local/share/gnome-shell/extensions/flugel-kilit-panel@flugel/ekip`;
const KARAKTERLER = ['emilia', 'subaru', 'beatrice', 'rem', 'ram', 'julius', 'anastasia', 'meili', 'shaula'];

function veriAl(tur, geri) {
    try {
        const p = Gio.Subprocess.new([VERI, tur], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        p.communicate_utf8_async(null, null, (_p, sonuc) => {
            try {
                const [, cikti] = p.communicate_utf8_finish(sonuc);
                geri(JSON.parse(cikti));
            } catch (e) {
                geri(null);
            }
        });
    } catch (e) {
        geri(null);
    }
}

const para = n => n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${n.toFixed(2)}`;
const isaret = d => `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%`;
function kalan(sn) {
    if (sn <= 0)
        return 'şimdi';
    const g = Math.floor(sn / 86400), s = Math.floor(sn % 86400 / 3600), d = Math.floor(sn % 3600 / 60);
    return g ? `${g}g ${s}s` : s ? `${s}s ${d}dk` : `${d}dk`;
}

const Kart = GObject.registerClass(
class Kart extends St.BoxLayout {
    _init(baslik) {
        super._init({vertical: true, style_class: 'flugel-kilit-kart'});
        this._baslik = new St.Label({text: baslik, style_class: 'flugel-kilit-kart-baslik'});
        this._deger = new St.Label({text: '…', style_class: 'flugel-kilit-kart-deger'});
        this._alt = new St.Label({text: ' ', style_class: 'flugel-kilit-kart-alt'});
        for (const l of [this._baslik, this._deger, this._alt]) {
            l.clutter_text.ellipsize = 3;
            this.add_child(l);
        }
    }

    yaz(deger, alt = ' ') {
        this._deger.text = deger;
        this._alt.text = alt;
    }
});

const KilitPanosu = GObject.registerClass(
class KilitPanosu extends St.BoxLayout {
    _init() {
        super._init({vertical: false, style_class: 'flugel-kilit', x_align: Clutter.ActorAlign.CENTER});
        this.opacity = 0;

        // Re:Zero karakteri (goz kirpar, hafifce suzulur)
        this._ad = KARAKTERLER[Math.floor(Math.random() * KARAKTERLER.length)];
        this._acik = Gio.FileIcon.new(Gio.File.new_for_path(`${EKIP}/${this._ad}-acik.svg`));
        this._kapali = Gio.FileIcon.new(Gio.File.new_for_path(`${EKIP}/${this._ad}-kapali.svg`));
        this._karakter = new St.Icon({gicon: this._acik, icon_size: 72, style_class: 'flugel-kilit-karakter',
            y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._karakter);

        this._kripto = new Kart('KRİPTO');
        this._anime = new Kart('SIRADAKİ BÖLÜM');
        this._pil = new Kart('PİL');
        this._sunucu = new Kart('SUNUCU');
        for (const k of [this._kripto, this._anime, this._pil, this._sunucu])
            this.add_child(k);
        this._anime.add_style_class_name('flugel-kilit-kart-genis');

        this._zamanlayicilar = [];
        this._zamanlayicilar.push(GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this._yenile();
            return GLib.SOURCE_CONTINUE;
        }));
        this._zamanlayicilar.push(GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4200, () => {
            this._karakter.gicon = this._kapali;
            const z = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => {
                this._karakter.gicon = this._acik;
                this._zamanlayicilar = this._zamanlayicilar.filter(x => x !== z);
                return GLib.SOURCE_REMOVE;
            });
            this._zamanlayicilar.push(z);
            return GLib.SOURCE_CONTINUE;
        }));
        this.connect('destroy', () => {
            this._zamanlayicilar.forEach(z => GLib.source_remove(z));
            this._zamanlayicilar = [];
            this._olu = true;
        });

        this._yenile();
        this.ease({opacity: 255, duration: 700, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        this._karakter.translation_y = 0;
        this._karakter.ease({translation_y: -5, duration: 1600, repeatCount: -1, autoReverse: true,
            mode: Clutter.AnimationMode.EASE_IN_OUT_SINE});
    }

    _yenile() {
        veriAl('canli', v => {
            if (this._olu || !v?.btc)
                return;
            this._kripto.yaz(`BTC ${para(v.btc.fiyat)}`,
                `${isaret(v.btc.degisim)}   ETH ${para(v.eth.fiyat)} ${isaret(v.eth.degisim)}`);
        });
        veriAl('anime', v => {
            if (this._olu)
                return;
            const simdi = Date.now() / 1000;
            const s = (v?.anime ?? []).filter(a => a.yayin && a.yayin > simdi - 1800)
                .sort((a, b) => a.yayin - b.yayin)[0];
            if (s)
                this._anime.yaz(s.ad, `${s.sonraki_bolum}. bölüm · ${kalan(s.yayin - simdi)}`);
            else
                this._anime.yaz('Yayın yok', 'takip listesi boş');
        });
        veriAl('pc', v => {
            if (this._olu || !v)
                return;
            this._pil.yaz(`%${v.pil}`, v.pil_durum ?? '');
        });
        veriAl('sunucu', v => {
            if (this._olu)
                return;
            if (!v?.durum) {
                this._sunucu.yaz('ulaşılamıyor', 'bağlantı yok');
                return;
            }
            this._sunucu.yaz(v.durum === 'IYI' ? '● Çalışıyor' : `● ${v.durum}`,
                `${v.konteyner} konteyner · ${v.temp}°C`);
        });
    }
});

export default class FlugelKilit extends Extension {
    enable() {
        this._sinyaller = ['locked-changed', 'active-changed'].map(s =>
            Main.screenShield.connect(s, () => this._sonra()));
        this._sonra();
    }

    _sonra() {
        if (this._bekleyen)
            return;
        this._bekleyen = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._bekleyen = 0;
            this._bagla();
            return GLib.SOURCE_REMOVE;
        });
    }

    _bagla() {
        const saat = Main.screenShield._dialog?._clock;
        if (!saat || !Main.screenShield.active || this._pano?.get_parent() === saat)
            return;
        this._pano?.destroy();
        this._pano = new KilitPanosu();
        this._pano.connect('destroy', () => {
            this._pano = null;
        });
        saat.add_child(this._pano);

        // duz siyah zemin (bulanik masaustu yerine) + saatin ustunde FLUGEL yazisi
        const dialog = Main.screenShield._dialog;
        this._zemin?.destroy();
        this._zemin = new St.Widget({style_class: 'flugel-kilit-zemin'});
        this._zemin.add_constraint(new Clutter.BindConstraint({source: dialog, coordinate: Clutter.BindCoordinate.ALL}));
        this._zemin.connect('destroy', () => {
            this._zemin = null;
        });
        dialog.insert_child_above(this._zemin, dialog._backgroundGroup);

        this._yazi?.destroy();
        this._yazi = new St.Label({text: 'FLUGEL', style_class: 'flugel-kilit-yazi', x_align: Clutter.ActorAlign.CENTER});
        this._yazi.connect('destroy', () => {
            this._yazi = null;
        });
        this._yazi.clutter_text.ellipsize = 0;   // Pango.EllipsizeMode.NONE — saat kutusu dar, kesilmesin
        saat.insert_child_at_index(this._yazi, 0);
        this._yazi.opacity = 0;
        this._yazi.ease({opacity: 255, duration: 1200, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._yazi?.ease({opacity: 150, duration: 2600, repeatCount: -1, autoReverse: true,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE})});
    }

    disable() {
        // unlock-dialog modunda da calisir: kilit ekraninda widget gostermek icin (session-modes)
        this._sinyaller?.forEach(id => Main.screenShield.disconnect(id));
        this._sinyaller = null;
        if (this._bekleyen)
            GLib.source_remove(this._bekleyen);
        this._bekleyen = 0;
        this._pano?.destroy();
        this._pano = null;
        this._yazi?.destroy();
        this._yazi = null;
        this._zemin?.destroy();
        this._zemin = null;
    }
}
