// FLUGEL Island — Hızlı Ayarlar'daki anahtarlar adada (karo olarak): Wi-Fi, Bluetooth, uçak modu, gece ışığı,
// rahatsız etme, güç modu, mikrofon. Durum açılırken okunur; değişiklik GNOME'un kendi servisleriyle yapılır.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import {_} from './dil.js';

const RFKILL = ['org.gnome.SettingsDaemon.Rfkill', '/org/gnome/SettingsDaemon/Rfkill', 'org.gnome.SettingsDaemon.Rfkill'];
const GUC = ['net.hadess.PowerProfiles', '/net/hadess/PowerProfiles', 'net.hadess.PowerProfiles'];
const NMD = ['org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager'];
const GUC_SIRA = ['power-saver', 'balanced', 'performance'];

function oku(bus, [ad, yol, arayuz], ozellik) {
    return new Promise(coz => {
        bus.call(ad, yol, 'org.freedesktop.DBus.Properties', 'Get', new GLib.Variant('(ss)', [arayuz, ozellik]),
            null, Gio.DBusCallFlags.NONE, 2000, null, (b, res) => {
                try {
                    coz(b.call_finish(res).deepUnpack()[0].deepUnpack());
                } catch (e) {
                    coz(null);
                }
            });
    });
}

function yaz(bus, [ad, yol, arayuz], ozellik, deger) {
    bus.call(ad, yol, 'org.freedesktop.DBus.Properties', 'Set', new GLib.Variant('(ssv)', [arayuz, ozellik, deger]),
        null, Gio.DBusCallFlags.NONE, 2000, null, null);
}

export class HizliAyarlar {
    constructor() {
        this._renk = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.color'});
        this._bildirim = new Gio.Settings({schema_id: 'org.gnome.desktop.notifications'});
    }

    // [{id, ikon, ad, acik, ayrinti}] — karo listesi için
    async durumlar() {
        const sis = Gio.DBus.system, otr = Gio.DBus.session;
        const [wifi, bt, ucak, guc] = await Promise.all([
            oku(sis, NMD, 'WirelessEnabled'), oku(otr, RFKILL, 'BluetoothAirplaneMode'),
            oku(otr, RFKILL, 'AirplaneMode'), oku(sis, GUC, 'ActiveProfile')]);
        const mik = Volume.getMixerControl().get_default_source();
        const gucAd = {'power-saver': _('Tasarruf'), 'balanced': _('Dengeli'), 'performance': _('Performans')};
        return [
            {id: 'wifi', ikon: wifi ? 'network-wireless-symbolic' : 'network-wireless-disabled-symbolic', ad: 'Wi-Fi',
                acik: !!wifi, ayrinti: wifi ? _('Açık · tıkla: kapat') : _('Kapalı · tıkla: aç')},
            {id: 'bt', ikon: bt === false ? 'bluetooth-active-symbolic' : 'bluetooth-disabled-symbolic', ad: 'Bluetooth',
                acik: bt === false, ayrinti: bt === false ? _('Açık') : _('Kapalı')},
            {id: 'ucak', ikon: 'airplane-mode-symbolic', ad: _('Uçak modu'), acik: !!ucak,
                ayrinti: _('Tüm kablosuz bağlantılar')},
            {id: 'gece', ikon: 'night-light-symbolic', ad: _('Gece ışığı'), acik: this._renk.get_boolean('night-light-enabled'),
                ayrinti: _('Ekran rengini ısıtır')},
            {id: 'dnd', ikon: 'notifications-disabled-symbolic', ad: _('Rahatsız etme'), acik: !this._bildirim.get_boolean('show-banners'),
                ayrinti: _('Bildirim afişleri gösterilmez (listede kalır)')},
            {id: 'guc', ikon: guc === 'performance' ? 'power-profile-performance-symbolic'
                : guc === 'power-saver' ? 'power-profile-power-saver-symbolic' : 'power-profile-balanced-symbolic',
            ad: gucAd[guc] ?? _('Güç modu'), acik: guc === 'performance', ayrinti: _('Tıkla: tasarruf → dengeli → performans')},
            {id: 'mik', ikon: mik?.is_muted ? 'microphone-disabled-symbolic' : 'audio-input-microphone-symbolic',
                ad: _('Mikrofon'), acik: !!mik && !mik.is_muted, ayrinti: mik?.is_muted ? _('Sessiz') : _('Açık')},
        ];
    }

    async degistir(id) {
        const sis = Gio.DBus.system, otr = Gio.DBus.session;
        if (id === 'wifi') {
            yaz(sis, NMD, 'WirelessEnabled', new GLib.Variant('b', !(await oku(sis, NMD, 'WirelessEnabled'))));
        } else if (id === 'bt') {
            yaz(otr, RFKILL, 'BluetoothAirplaneMode', new GLib.Variant('b', !(await oku(otr, RFKILL, 'BluetoothAirplaneMode'))));
        } else if (id === 'ucak') {
            yaz(otr, RFKILL, 'AirplaneMode', new GLib.Variant('b', !(await oku(otr, RFKILL, 'AirplaneMode'))));
        } else if (id === 'gece') {
            this._renk.set_boolean('night-light-enabled', !this._renk.get_boolean('night-light-enabled'));
        } else if (id === 'dnd') {
            this._bildirim.set_boolean('show-banners', !this._bildirim.get_boolean('show-banners'));
        } else if (id === 'guc') {
            const simdi = await oku(sis, GUC, 'ActiveProfile');
            yaz(sis, GUC, 'ActiveProfile', new GLib.Variant('s', GUC_SIRA[(GUC_SIRA.indexOf(simdi) + 1) % GUC_SIRA.length]));
        } else if (id === 'mik') {
            const m = Volume.getMixerControl().get_default_source();
            m?.change_is_muted(!m.is_muted);
        }
    }
}
