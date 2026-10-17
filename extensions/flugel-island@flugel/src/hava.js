// FLUGEL Island — kart başlığındaki hava durumu (Atoll'un hava küçük aracından): sembolik simge + sıcaklık;
// üzerine gelince durum, en yüksek/en düşük, hissedilen, nem, rüzgâr ve sonraki 6 saat. Veri: ust-panel-veri hava
// (Open-Meteo, anahtarsız). Şehir ayarı boşsa görünmez.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import {ipucuBagla} from './bilesenler.js';
import {_, f} from './dil.js';

// WMO hava kodları (çeviri için burada; betik Türkçe adı da gönderir)
const DURUM = () => ({0: _('Açık hava'), 1: _('Az bulutlu'), 2: _('Parçalı bulutlu'), 3: _('Kapalı hava'), 45: _('Sisli'), 48: _('Sisli'),
    51: _('Çisenti'), 53: _('Çisenti'), 55: _('Çisenti'), 61: _('Yağmur'), 63: _('Yağmur'), 65: _('Kuvvetli yağmur'),
    71: _('Kar'), 73: _('Kar'), 75: _('Yoğun kar'), 80: _('Sağanak'), 81: _('Sağanak'), 82: _('Şiddetli sağanak'),
    95: _('Gök gürültülü fırtına')});

export class HavaDurumu {
    constructor(veri) {
        this._veri = veri;
        this.actor = new St.Button({style_class: 'flugel-hava', can_focus: true, visible: false, y_align: Clutter.ActorAlign.CENTER});
        const kutu = new St.BoxLayout({style: 'spacing: 5px;'});
        this._simge = new St.Icon({icon_size: 16, y_align: Clutter.ActorAlign.CENTER});
        this._derece = new St.Label({style_class: 'flugel-hava-derece', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._simge);
        kutu.add_child(this._derece);
        this.actor.set_child(kutu);
        ipucuBagla(this.actor, () => this._ipucu());
        this.actor.connect('clicked', () => {
            const app = Shell.AppSystem.get_default().lookup_app('org.gnome.Weather.desktop');
            app?.activate();
        });
        this._abone = veri.abone('hava', d => this._yaz(d));
        veri.tazele('hava', 900);
    }

    _yaz(d) {
        this._d = d;
        this.actor.visible = !!d && !d.hata && Number.isFinite(d.derece);
        if (!this.actor.visible)
            return;
        this._simge.icon_name = d.simge || 'weather-clear-symbolic';
        this._derece.text = `${d.derece}°`;
    }

    _ipucu() {
        const d = this._d;
        if (!d)
            return '';
        const durum = DURUM()[d.kod] ?? d.durum ?? '';
        const saatlik = (d.saatlik ?? []).map(s => `${s.saat}  ${s.derece}°${s.yagis ? `  %${s.yagis}` : ''}`).join('\n');
        return {baslik: `${d.sehir}: ${d.derece}° · ${durum}`,
            ayrinti: [f(_('En yüksek %s° · en düşük %s° · hissedilen %s°'), d.en_yuksek, d.en_dusuk, d.hissedilen),
                f(_('Nem %%%s · rüzgâr %s km/sa · gün doğumu %s · batımı %s'), d.nem, d.ruzgar, d.gun_dogumu, d.gun_batimi),
                saatlik].filter(Boolean).join('\n')};
    }

    destroy() {
        this._abone?.();
        this.actor.destroy();
    }
}
