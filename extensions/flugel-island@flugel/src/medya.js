// FLUGEL Island — kart içindeki medya oynatıcı ve kapsüldeki ekolayzer.
// Atoll'un (GPL-3.0, macOS) oynatıcı tasarımından esinlenildi; kod GNOME/MPRIS için baştan yazıldı:
//   kapak + başlık/sanatçı + canlı ekolayzer çubukları; sürüklenebilir ilerleme çubuğu (geçen / kalan süre);
//   −10 sn · önceki · oynat/duraklat · sonraki · +10 sn; çıkış cihazı seçimi; oynatıcı üzerinde iki parmakla
//   yatay kaydırma (ayar: parça değiştir ya da ±10 sn sar). Düğmeler basınca yaylanır.
// Konum MPRIS'ten sadece kart açıkken okunur (3 sn'de bir; arada yerel saatle ilerletilir).
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import {ipucuBagla, yayliBasma} from './bilesenler.js';
import {_} from './dil.js';

const MPRIS_YOL = '/org/mpris/MediaPlayer2';
const OYNATICI = 'org.mpris.MediaPlayer2.Player';
const ON_SN = 10 * 1e6;

const sure = us => {
    if (!Number.isFinite(us) || us < 0)
        return '0:00';
    const s = Math.floor(us / 1e6);
    const sa = Math.floor(s / 3600), dk = Math.floor((s % 3600) / 60), sn = s % 60;
    return sa ? `${sa}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}` : `${dk}:${String(sn).padStart(2, '0')}`;
};

function cagir(bus, yontem, parametre = null) {
    Gio.DBus.session.call(bus, MPRIS_YOL, OYNATICI, yontem, parametre, null, Gio.DBusCallFlags.NONE, 2000, null, null);
}

function konumOku(bus, iptal) {
    return new Promise(coz => {
        Gio.DBus.session.call(bus, MPRIS_YOL, 'org.freedesktop.DBus.Properties', 'Get',
            new GLib.Variant('(ss)', [OYNATICI, 'Position']), null, Gio.DBusCallFlags.NONE, 1500, iptal, (b, res) => {
                try {
                    coz(Number(b.call_finish(res).deepUnpack()[0].deepUnpack()));
                } catch (e) {
                    coz(null);
                }
            });
    });
}

// ---------- ekolayzer: çalarken dans eden 4-5 çubuk ----------
export class Esitleyici {
    constructor({cubuk = 4, yukseklik = 14, genislik = 3} = {}) {
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._h = yukseklik * s;
        this.actor = new St.BoxLayout({style_class: 'flugel-esitleyici', y_align: Clutter.ActorAlign.CENTER,
            height: this._h});
        this._cubuklar = [];
        for (let i = 0; i < cubuk; i++) {
            const c = new St.Widget({style_class: 'flugel-esitleyici-cubuk', width: genislik * s, height: this._h,
                y_align: Clutter.ActorAlign.END});
            c.set_pivot_point(0.5, 1);
            c.scale_y = 0.3;
            this.actor.add_child(c);
            this._cubuklar.push(c);
        }
        this._caliyor = false;
        this.actor.connect('notify::mapped', () => this._zamanla());
        this.actor.connect('destroy', () => this._durdur());
    }

    set caliyor(v) {
        if (this._caliyor === v)
            return;
        this._caliyor = v;
        this._zamanla();
    }

    _zamanla() {
        this._durdur();
        if (!this._caliyor || !this.actor.mapped || !St.Settings.get().enable_animations) {
            this._cubuklar.forEach(c => c.ease({scale_y: 0.25, duration: 200, mode: Clutter.AnimationMode.EASE_OUT_QUAD}));
            return;
        }
        const adim = () => {
            this._cubuklar.forEach(c => c.ease({scale_y: 0.25 + Math.random() * 0.75, duration: 170,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE}));
            return GLib.SOURCE_CONTINUE;
        };
        adim();
        this._id = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 180, adim);
    }

    _durdur() {
        if (this._id)
            GLib.source_remove(this._id);
        this._id = 0;
    }
}

// ---------- kart içindeki oynatıcı ----------
export class MedyaOynatici {
    constructor(ayarlar) {
        this._ayar = ayarlar;
        this._iptal = new Gio.Cancellable();
        this.actor = new St.BoxLayout({style_class: 'flugel-oynatici', orientation: Clutter.Orientation.VERTICAL,
            x_expand: true, reactive: true});

        const ust = new St.BoxLayout({style_class: 'flugel-oynatici-ust'});
        this._kapak = new St.Bin({style_class: 'flugel-oynatici-kapak', y_align: Clutter.ActorAlign.CENTER});
        this._kapakSimge = new St.Icon({icon_name: 'audio-x-generic-symbolic', icon_size: 28});
        this._kapak.set_child(this._kapakSimge);
        ust.add_child(this._kapak);
        const metin = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this._baslik = new St.Label({style_class: 'flugel-oynatici-baslik'});
        this._baslik.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._sanatci = new St.Label({style_class: 'flugel-oynatici-sanatci'});
        this._sanatci.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._kaynak = new St.Label({style_class: 'flugel-oynatici-kaynak'});
        metin.add_child(this._baslik);
        metin.add_child(this._sanatci);
        metin.add_child(this._kaynak);
        ust.add_child(metin);
        this._esit = new Esitleyici({cubuk: 5, yukseklik: 22, genislik: 4});
        ust.add_child(this._esit.actor);
        this.actor.add_child(ust);

        // ilerleme
        const ilerleme = new St.BoxLayout({style_class: 'flugel-oynatici-ilerleme'});
        this._gecen = new St.Label({style_class: 'flugel-oynatici-sure', y_align: Clutter.ActorAlign.CENTER});
        this._cubuk = new Slider(0);
        this._cubuk.x_expand = true;
        this._cubuk.y_align = Clutter.ActorAlign.CENTER;
        this._cubuk.add_style_class_name('flugel-oynatici-cubuk');
        this._kalan = new St.Label({style_class: 'flugel-oynatici-sure', y_align: Clutter.ActorAlign.CENTER});
        ilerleme.add_child(this._gecen);
        ilerleme.add_child(this._cubuk);
        ilerleme.add_child(this._kalan);
        this.actor.add_child(ilerleme);
        // sürüklerken konum etiketi canlı, bırakınca SetPosition
        this._cubuk.connect('drag-begin', () => {
            this._surukleniyor = true;
        });
        this._cubuk.connect('notify::value', () => {
            if (this._surukleniyor || this._klavye)
                this._sureYaz(this._cubuk.value * this._m.uzunluk);
        });
        this._cubuk.connect('drag-end', () => {
            this._surukleniyor = false;
            this._konumaGit(this._cubuk.value * this._m.uzunluk);
        });
        this._cubuk.connect('scroll-event', () => Clutter.EVENT_STOP);

        // denetimler
        const denetim = new St.BoxLayout({style_class: 'flugel-oynatici-denetim', x_align: Clutter.ActorAlign.CENTER});
        const d = (ikon, ipucu, fn, buyuk = false) => {
            const b = new St.Button({style_class: `flugel-oynatici-dugme${buyuk ? ' flugel-oynatici-dugme-buyuk' : ''}`, can_focus: true,
                child: new St.Icon({icon_name: ikon, icon_size: buyuk ? 28 : 20})});
            b.connect('clicked', fn);
            yayliBasma(b);
            ipucuBagla(b, ipucu);
            denetim.add_child(b);
            return b;
        };
        this._geriSar = d('media-seek-backward-symbolic', _('10 sn geri'), () => this._sar(-ON_SN));
        this._onceki = d('media-skip-backward-symbolic', _('Önceki'), () => cagir(this._m.bus, 'Previous'));
        this._oynat = d('media-playback-start-symbolic', _('Oynat / duraklat'), () => cagir(this._m.bus, 'PlayPause'), true);
        this._sonraki = d('media-skip-forward-symbolic', _('Sonraki'), () => cagir(this._m.bus, 'Next'));
        this._ileriSar = d('media-seek-forward-symbolic', _('10 sn ileri'), () => this._sar(ON_SN));
        this.actor.add_child(denetim);

        // çıkış cihazı
        const alt = new St.BoxLayout({style_class: 'flugel-oynatici-alt'});
        alt.add_child(new St.Widget({x_expand: true}));
        this._cikisDugme = new St.Button({style_class: 'flugel-oynatici-dugme flugel-oynatici-cikis', can_focus: true,
            child: new St.Icon({icon_name: 'audio-speakers-symbolic', icon_size: 16})});
        ipucuBagla(this._cikisDugme, _('Çıkış cihazı'));
        yayliBasma(this._cikisDugme);
        this._cikisDugme.connect('clicked', () => this._cikislar(!this._cikis.visible));
        alt.add_child(this._cikisDugme);
        this.actor.add_child(alt);
        this._cikis = new St.BoxLayout({style_class: 'flugel-cipler', x_expand: true, visible: false});
        this.actor.add_child(this._cikis);

        // iki parmakla yatay kaydırma: parça değiştir ya da ±10 sn
        this.actor.connect('scroll-event', (_a, e) => this._kaydir(e));
        // paralaks: imleç kapağın üzerinde gezerken kapak hafifçe eğilir (Atoll'daki gibi)
        this._kapak.reactive = true;
        this._kapak.track_hover = true;
        this._kapak.set_pivot_point(0.5, 0.5);
        this._kapak.connect('motion-event', (_a, e) => {
            if (!St.Settings.get().enable_animations)
                return Clutter.EVENT_PROPAGATE;
            const [x, y] = e.get_coords();
            const [, ax, ay] = this._kapak.transform_stage_point(x, y);
            const dx = ax / Math.max(1, this._kapak.width) - 0.5, dy = ay / Math.max(1, this._kapak.height) - 0.5;
            this._kapak.rotation_angle_y = dx * 18;
            this._kapak.rotation_angle_x = -dy * 18;
            this._kapak.scale_x = this._kapak.scale_y = 1.06;
            return Clutter.EVENT_PROPAGATE;
        });
        this._kapak.connect('notify::hover', () => {
            if (!this._kapak.hover)
                this._kapak.ease({rotation_angle_x: 0, rotation_angle_y: 0, scale_x: 1, scale_y: 1, duration: 300, mode: Clutter.AnimationMode.EASE_OUT_BACK});
        });
        this.actor.connect('notify::mapped', () => this._izle());
        this.actor.connect('destroy', () => this._birak());
        this._m = {uzunluk: 0};
    }

    guncelle(a) {
        const m = a.data?.medya;
        if (!m)
            return;
        const yeniParca = m.parca !== this._m.parca || m.bus !== this._m.bus;
        this._m = m;
        this.id = a.id;
        this._baslik.text = m.baslik || '';
        this._sanatci.text = m.sanatci || '';
        this._sanatci.visible = !!m.sanatci;
        this._kaynak.text = [m.oynatici, m.album].filter(Boolean).join(' · ');
        this._kaynak.visible = !!this._kaynak.text;
        if (m.kapakUrl && /^(file|https?):\/\//.test(m.kapakUrl)) {
            const uri = m.kapakUrl.replace(/"/g, '%22');
            this._kapak.style = `background-image: url("${uri}"); background-size: cover;`;
            this._kapakSimge.hide();
        } else {
            this._kapak.style = null;
            this._kapakSimge.show();
        }
        this._oynat.child.icon_name = m.caliyor ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        this._esit.caliyor = m.caliyor;
        this._onceki.reactive = m.oncekiVar;
        this._onceki.opacity = m.oncekiVar ? 255 : 90;
        this._sonraki.reactive = m.sonrakiVar;
        this._sonraki.opacity = m.sonrakiVar ? 255 : 90;
        const sar = m.sarilabilir && m.uzunluk > 0;
        for (const b of [this._geriSar, this._ileriSar]) {
            b.reactive = sar;
            b.opacity = sar ? 255 : 90;
        }
        this._cubuk.reactive = sar;
        this._gecen.visible = this._kalan.visible = this._cubuk.visible = m.uzunluk > 0;
        if (yeniParca && this.actor.mapped && St.Settings.get().enable_animations) {
            // yeni parça: kapak ve yazı hafifçe kayarak gelir
            for (const x of [this._kapak, this._baslik, this._sanatci]) {
                x.opacity = 0;
                x.translation_x = 12;
                x.ease({opacity: 255, translation_x: 0, duration: 260, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            }
        }
        if (yeniParca)
            this._konum = {us: 0, zaman: GLib.get_monotonic_time()};
        this._konumuYenile();
    }

    // ---------- konum ----------
    _izle() {
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this._tikId = 0;
        if (!this.actor.mapped)
            return;
        this._konumuYenile();
        let say = 0;
        this._tikId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 500, () => {
            if (++say % 6 === 0)
                this._konumuYenile();
            this._ciz();
            return GLib.SOURCE_CONTINUE;
        });
    }

    async _konumuYenile() {
        if (!this._m.bus || !this.actor.mapped)
            return;
        const us = await konumOku(this._m.bus, this._iptal);
        if (us === null || this._iptal.is_cancelled())
            return;
        this._konum = {us, zaman: GLib.get_monotonic_time()};
        this._ciz();
    }

    _simdi() {
        if (!this._konum)
            return 0;
        const gecen = this._m.caliyor ? GLib.get_monotonic_time() - this._konum.zaman : 0;
        return Math.min(this._m.uzunluk || Infinity, this._konum.us + gecen * (this._m.hiz ?? 1));
    }

    _ciz() {
        if (this._surukleniyor || !this._m.uzunluk)
            return;
        const us = this._simdi();
        this._klavye = false;
        this._cubuk.value = Math.max(0, Math.min(1, us / this._m.uzunluk));
        this._sureYaz(us);
    }

    _sureYaz(us) {
        this._gecen.text = sure(us);
        this._kalan.text = `−${sure(Math.max(0, this._m.uzunluk - us))}`;
    }

    _konumaGit(us) {
        if (!this._m.sarilabilir || !this._m.parca)
            return;
        us = Math.max(0, Math.min(this._m.uzunluk - 1, Math.round(us)));
        cagir(this._m.bus, 'SetPosition', new GLib.Variant('(ox)', [this._m.parca, us]));
        this._konum = {us, zaman: GLib.get_monotonic_time()};
        this._ciz();
    }

    _sar(fark) {
        if (!this._m.sarilabilir)
            return;
        cagir(this._m.bus, 'Seek', new GLib.Variant('(x)', [fark]));
        this._konum = {us: Math.max(0, this._simdi() + fark), zaman: GLib.get_monotonic_time()};
        this._ciz();
        // sarma geri bildirimi: ilerleme çubuğu bir an parlar
        this._cubuk.ease({opacity: 150, duration: 90, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._cubuk.ease({opacity: 255, duration: 180, mode: Clutter.AnimationMode.EASE_OUT_QUAD})});
    }

    // ---------- iki parmakla yatay kaydırma ----------
    _kaydir(e) {
        if (e.get_scroll_direction() !== Clutter.ScrollDirection.SMOOTH)
            return Clutter.EVENT_PROPAGATE;
        const [dx, dy] = e.get_scroll_delta();
        if (Math.abs(dx) <= Math.abs(dy))
            return Clutter.EVENT_PROPAGATE;   // dikey: kart kaysın
        const simdi = GLib.get_monotonic_time();
        if (simdi - (this._sonAdim ?? 0) < 450000)
            return Clutter.EVENT_STOP;
        if (simdi - (this._sonOlay ?? 0) > 250000)
            this._birikim = 0;
        this._sonOlay = simdi;
        this._birikim = (this._birikim ?? 0) + dx;
        if (Math.abs(this._birikim) < 2.5)
            return Clutter.EVENT_STOP;
        const ileri = this._birikim > 0;
        this._birikim = 0;
        this._sonAdim = simdi;
        if (this._ayar?.get_string('medya-kaydirma') === 'sarma') {
            this._sar(ileri ? ON_SN : -ON_SN);
        } else {
            cagir(this._m.bus, ileri ? 'Next' : 'Previous');
            // ilgili düğme sanki basılmış gibi yaylanır
            const b = ileri ? this._sonraki : this._onceki;
            if (St.Settings.get().enable_animations) {
                b.set_pivot_point(0.5, 0.5);
                b.ease({scale_x: 0.82, scale_y: 0.82, duration: 90, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => b.ease({scale_x: 1, scale_y: 1, duration: 320, mode: Clutter.AnimationMode.EASE_OUT_BACK})});
            }
        }
        // kaydırma yönünde küçük bir sarsıntı
        if (St.Settings.get().enable_animations) {
            this._kapak.translation_x = ileri ? -10 : 10;
            this._kapak.ease({translation_x: 0, duration: 320, mode: Clutter.AnimationMode.EASE_OUT_BACK});
        }
        return Clutter.EVENT_STOP;
    }

    // ---------- çıkış cihazı ----------
    _cikislar(ac) {
        this._cikis.destroy_all_children();
        this._cikis.visible = ac;
        if (ac) {
            this._cikisDugme.add_style_pseudo_class('checked');
            const mikser = Volume.getMixerControl();
            const varsayilan = mikser.get_default_sink();
            for (const s of mikser.get_sinks()) {
                const b = new St.Button({label: s.description || s.name, can_focus: true,
                    style_class: `flugel-cip flugel-cip-kucuk${s === varsayilan ? ' flugel-anahtar-acik' : ''}`});
                b.connect('clicked', () => {
                    mikser.set_default_sink(s);
                    this._cikislar(true);
                });
                this._cikis.add_child(b);
            }
        } else {
            this._cikisDugme.remove_style_pseudo_class('checked');
        }
    }

    _birak() {
        this._iptal.cancel();
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this._tikId = 0;
    }

    destroy() {
        this._birak();
        this.actor.destroy();
    }
}
