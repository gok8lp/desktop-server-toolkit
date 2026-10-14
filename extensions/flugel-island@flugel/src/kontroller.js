// FLUGEL Island — ses ve parlaklık çubukları (GNOME'un kendi mikseri ve parlaklık yöneticisi).
// Sistem sekmesinin en altında; simgeye tıklamak sesi kapatır/açar.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import {ipucuBagla} from './bilesenler.js';
import {_} from './dil.js';

function satir(ikonAdi, ad) {
    const kutu = new St.BoxLayout({style_class: 'flugel-cubuk-satir', x_expand: true});
    const dugme = new St.Button({style_class: 'flugel-dugme flugel-dugme-kucuk', can_focus: true,
        child: new St.Icon({icon_name: ikonAdi, icon_size: 18}), y_align: Clutter.ActorAlign.CENTER});
    const cubuk = new Slider(0);
    cubuk.x_expand = true;
    cubuk.y_align = Clutter.ActorAlign.CENTER;
    cubuk.accessible_name = ad;
    const yuzde = new St.Label({style_class: 'flugel-cubuk-yuzde', y_align: Clutter.ActorAlign.CENTER});
    kutu.add_child(dugme);
    kutu.add_child(cubuk);
    kutu.add_child(yuzde);
    return {kutu, dugme, cubuk, yuzde};
}

export class SesParlaklik {
    constructor() {
        this.actor = new St.BoxLayout({style_class: 'flugel-cubuklar', orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this._idler = [];

        // ses
        this._ses = satir('audio-volume-high-symbolic', _('Ses'));
        ipucuBagla(this._ses.dugme, _('Sesi kapat / aç'));
        this.actor.add_child(this._ses.kutu);
        this._mikser = Volume.getMixerControl();
        this._idler.push([this._mikser, this._mikser.connect('default-sink-changed', () => this._sinkBagla())]);
        this._idler.push([this._ses.cubuk, this._ses.cubuk.connect('notify::value', () => this._sesAyarla())]);
        this._idler.push([this._ses.dugme, this._ses.dugme.connect('clicked', () => this._sink?.change_is_muted(!this._sink.is_muted))]);
        this._sinkBagla();

        // parlaklık (dizüstü ekranı; GNOME'un parlaklık yöneticisi)
        this._parlaklik = satir('display-brightness-symbolic', _('Parlaklık'));
        this.actor.add_child(this._parlaklik.kutu);
        this._yonetici = Main.brightnessManager;
        if (this._yonetici) {
            this._idler.push([this._yonetici, this._yonetici.connect('changed', () => this._olcekBagla())]);
            this._idler.push([this._parlaklik.cubuk, this._parlaklik.cubuk.connect('notify::value', () => {
                if (!this._kilit && this._olcek)
                    this._olcek.value = this._parlaklik.cubuk.value;
                this._parlaklik.yuzde.text = `${Math.round(this._parlaklik.cubuk.value * 100)}%`;
            })]);
        }
        this._olcekBagla();
    }

    _sinkBagla() {
        if (this._sink && this._sinkIdler)
            this._sinkIdler.forEach(id => this._sink.disconnect(id));
        this._sink = this._mikser.get_default_sink();
        this._sinkIdler = this._sink ? [
            this._sink.connect('notify::volume', () => this._sesOku()),
            this._sink.connect('notify::is-muted', () => this._sesOku()),
        ] : null;
        this._sesOku();
    }

    _sesOku() {
        const s = this._sink;
        this._ses.kutu.reactive = !!s;
        if (!s)
            return;
        const oran = s.volume / this._mikser.get_vol_max_norm();
        this._kilitSes = true;
        this._ses.cubuk.value = Math.min(1, oran);
        this._kilitSes = false;
        this._ses.yuzde.text = s.is_muted ? _('kapalı') : `${Math.round(oran * 100)}%`;
        this._ses.dugme.child.icon_name = s.is_muted || oran === 0 ? 'audio-volume-muted-symbolic'
            : oran < 0.34 ? 'audio-volume-low-symbolic' : oran < 0.67 ? 'audio-volume-medium-symbolic' : 'audio-volume-high-symbolic';
    }

    _sesAyarla() {
        if (this._kilitSes || !this._sink)
            return;
        const v = this._ses.cubuk.value;
        this._sink.volume = v * this._mikser.get_vol_max_norm();
        if (this._sink.is_muted && v > 0)
            this._sink.change_is_muted(false);
        this._sink.push_volume();
    }

    _olcekBagla() {
        if (this._olcek && this._olcekId)
            this._olcek.disconnect(this._olcekId);
        this._olcek = this._yonetici?.globalScale ?? null;
        this._parlaklik.kutu.visible = !!this._olcek;
        if (!this._olcek)
            return;
        const oku = () => {
            this._kilit = true;
            this._parlaklik.cubuk.value = this._olcek.value;
            this._kilit = false;
            this._parlaklik.yuzde.text = `${Math.round(this._olcek.value * 100)}%`;
        };
        this._olcekId = this._olcek.connect('notify::value', oku);
        oku();
    }

    destroy() {
        if (this._sink && this._sinkIdler)
            this._sinkIdler.forEach(id => this._sink.disconnect(id));
        if (this._olcek && this._olcekId)
            this._olcek.disconnect(this._olcekId);
        this._idler.forEach(([n, id]) => n.disconnect(id));
        this._idler = [];
        this.actor.destroy();
    }
}
