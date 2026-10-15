// FLUGEL Island — Hızlı sekmesinin açılır ayrıntı panelleri (GNOME'un kendi servisleriyle, stok Hızlı Ayarlar gibi):
//   WifiPaneli       : çevredeki ağlar (sinyal, kilit, bağlı olan), tıklayınca bağlanır/ayrılır; yeni şifreli ağda
//                      parola penceresini GNOME'un ağ aracısı açar. Açılınca tarama başlar.
//   BluetoothPaneli  : eşleşmiş cihazlar, bağlı olanların pil yüzdesi; tıklayınca bağlanır/ayrılır.
//   UygulamaSesleri  : çıkış cihazı seçimi + çalan her uygulamanın ses çubuğu ve sessiz düğmesi.
// Paneller kapalıyken hiçbir servise abone olmaz; açılınca kurulur, kapanınca bırakılır.
import 'gi://GnomeBluetooth?version=3.0';
import GnomeBluetooth from 'gi://GnomeBluetooth';
import NM from 'gi://NM';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import {ipucuBagla} from './bilesenler.js';
import {_, f} from './dil.js';

Gio._promisify(NM.Client, 'new_async');
Gio._promisify(GnomeBluetooth.Client.prototype, 'connect_service');

// Sinyal bırakma: NM.Device'ın kendi disconnect() metodu (ağ bağlantısını keser) GObject'inkini gölgeler,
// bu yüzden her nesne için GObject.signal_handler_disconnect kullanılır.
const birak = liste => liste?.forEach(([n, id]) => GObject.signal_handler_disconnect(n, id));

// yüksekliği yayla açıp kapatır (içerik ölçülür, sonra serbest bırakılır)
export function yumusakAc(aktor, ac, bitince = null) {
    aktor.remove_transition('height');
    aktor.remove_transition('opacity');
    if (!St.Settings.get().enable_animations) {
        aktor.visible = ac;
        aktor.set_height(-1);
        bitince?.();
        return;
    }
    if (ac) {
        aktor.show();
        aktor.set_height(-1);
        const [, dogal] = aktor.get_preferred_height(aktor.get_parent()?.width ?? -1);
        aktor.set_height(0);
        aktor.opacity = 0;
        aktor.ease({height: dogal, opacity: 255, duration: 240, mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete: () => {
                aktor.set_height(-1);
                bitince?.();
            }});
    } else {
        aktor.ease({height: 0, opacity: 0, duration: 180, mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                aktor.hide();
                aktor.set_height(-1);
                bitince?.();
            }});
    }
}

function baslik(metin, ...sag) {
    const kutu = new St.BoxLayout({style_class: 'flugel-detay-baslik'});
    kutu.add_child(new St.Label({text: metin, style_class: 'flugel-bolum-baslik', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
    sag.forEach(a => kutu.add_child(a));
    return kutu;
}

function kucukDugme(ikonAdi, ipucu, fn) {
    const b = new St.Button({style_class: 'flugel-dugme flugel-dugme-kucuk', can_focus: true,
        child: new St.Icon({icon_name: ikonAdi, icon_size: 14})});
    b.connect('clicked', fn);
    ipucuBagla(b, ipucu);
    return b;
}

// açık/kapalı anahtarı (GNOME'un switch görünümü yerine adanın çip stili)
function anahtar(acik, fn) {
    const b = new St.Button({label: acik ? _('Açık') : _('Kapalı'), style_class: `flugel-cip flugel-cip-kucuk${acik ? ' flugel-anahtar-acik' : ''}`,
        can_focus: true, y_align: Clutter.ActorAlign.CENTER});
    b.connect('clicked', fn);
    return b;
}

function satir({ikon, gicon, ad, alt, sagIkon, secili, fn, ipucu}) {
    const b = new St.Button({style_class: `flugel-detay-satir${secili ? ' flugel-detay-secili' : ''}`, can_focus: true, x_expand: true});
    const k = new St.BoxLayout({x_expand: true, style: 'spacing: 10px;'});
    // gicon: null verilirse icon_name'i siler; sadece dolu olan geçirilir
    k.add_child(new St.Icon({...(gicon ? {gicon} : {icon_name: ikon}), icon_size: 16, y_align: Clutter.ActorAlign.CENTER}));
    const m = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
    const l = new St.Label({text: ad, style_class: 'flugel-detay-ad'});
    l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    m.add_child(l);
    if (alt)
        m.add_child(new St.Label({text: alt, style_class: 'flugel-detay-alt'}));
    k.add_child(m);
    for (const s of sagIkon ?? [])
        k.add_child(new St.Icon({icon_name: s, icon_size: 14, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-soluk'}));
    b.set_child(k);
    if (fn)
        b.connect('clicked', fn);
    if (ipucu)
        ipucuBagla(b, ipucu);
    return b;
}

const sinyalIkon = g => `network-wireless-signal-${g < 20 ? 'none' : g < 40 ? 'weak' : g < 50 ? 'ok' : g < 80 ? 'good' : 'excellent'}-symbolic`;

function ayarlariAc(panel) {
    const app = Shell.AppSystem.get_default().lookup_app('org.gnome.Settings.desktop');
    const p = new GLib.Variant('av', [new GLib.Variant('(sav)', [panel, []])]);
    app?.activate_action('launch-panel', p, 0, -1, null).catch(() => {});
}

// ---------- Wi-Fi ----------
export class WifiPaneli {
    constructor({kapat}) {
        this._kapat = kapat;
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
        this._iptal = new Gio.Cancellable();
        this._kur().catch(e => console.error('FLUGEL Island: Wi-Fi paneli', e));
    }

    async _kur() {
        this._istemci = await NM.Client.new_async(this._iptal);
        if (this._iptal.is_cancelled())
            return;
        this._aygit = this._istemci.get_devices().find(d => d instanceof NM.DeviceWifi) ?? null;
        this._idler = [[this._istemci, this._istemci.connect('notify::wireless-enabled', () => this._planla())]];
        if (this._aygit) {
            for (const s of ['access-point-added', 'access-point-removed', 'notify::active-access-point', 'state-changed'])
                this._idler.push([this._aygit, this._aygit.connect(s, () => this._planla())]);
            this._tara();
        }
        this._yaz();
    }

    _tara() {
        if (!this._aygit || !this._istemci.wireless_enabled)
            return;
        this._taraniyor = true;
        this._aygit.request_scan_async(this._iptal, (a, res) => {
            try {
                a.request_scan_finish(res);
            } catch (e) {
                // çok sık tarama istenirse NM reddeder; sonuçlar yine gelir
            }
            this._taraniyor = false;
            this._planla();
        });
    }

    _planla() {
        if (this._yazId || this._iptal.is_cancelled())
            return;
        this._yazId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._yazId = 0;
            this._yaz();
            return GLib.SOURCE_REMOVE;
        });
    }

    _yaz() {
        this.actor.destroy_all_children();
        const acik = this._istemci.wireless_enabled;
        this.actor.add_child(baslik('Wi-Fi',
            kucukDugme('view-refresh-symbolic', _('Ağları yeniden tara'), () => this._tara()),
            kucukDugme('emblem-system-symbolic', _('Wi-Fi ayarları'), () => {
                this._kapat?.();
                ayarlariAc('wifi');
            }),
            anahtar(acik, () => {
                this._istemci.dbus_set_property(NM.DBUS_PATH, NM.DBUS_INTERFACE, 'WirelessEnabled',
                    new GLib.Variant('b', !acik), -1, null, null);
            })));
        if (!this._aygit) {
            this.actor.add_child(new St.Label({text: _('Kablosuz ağ kartı yok'), style_class: 'flugel-soluk'}));
            return;
        }
        if (!acik) {
            this.actor.add_child(new St.Label({text: _('Wi-Fi kapalı'), style_class: 'flugel-soluk'}));
            return;
        }
        // aynı ağ adının en güçlü erişim noktası
        const aktif = this._aygit.get_active_access_point();
        const aktifSsid = aktif?.get_ssid() ? NM.utils_ssid_to_utf8(aktif.get_ssid().get_data()) : null;
        const aglar = new Map();
        for (const ap of this._aygit.get_access_points()) {
            const ssid = ap.get_ssid();
            if (!ssid)
                continue;
            const ad = NM.utils_ssid_to_utf8(ssid.get_data());
            if (!ad || (aglar.get(ad)?.get_strength() ?? -1) >= ap.get_strength())
                continue;
            aglar.set(ad, ap);
        }
        const liste = [...aglar].sort(([a, x], [b, y]) => (b === aktifSsid) - (a === aktifSsid) || y.get_strength() - x.get_strength())
            .slice(0, 12);
        if (!liste.length)
            this.actor.add_child(new St.Label({text: this._taraniyor ? _('Taranıyor…') : _('Ağ bulunamadı'), style_class: 'flugel-soluk'}));
        const kayitli = this._istemci.get_connections();
        for (const [ad, ap] of liste) {
            const sifreli = ap.get_wpa_flags() !== 0 || ap.get_rsn_flags() !== 0 || (ap.get_flags() & 1) !== 0;
            const bagli = ad === aktifSsid;
            const profil = kayitli.find(c => {
                const s = c.get_setting_wireless()?.get_ssid();
                return s && NM.utils_ssid_to_utf8(s.get_data()) === ad;
            });
            this.actor.add_child(satir({ikon: sinyalIkon(ap.get_strength()), ad,
                alt: bagli ? _('Bağlı · tıkla: bağlantıyı kes') : (profil ? _('Kayıtlı') : null),
                sagIkon: [...(sifreli ? ['changes-prevent-symbolic'] : []), ...(bagli ? ['object-select-symbolic'] : [])],
                secili: bagli, ipucu: f(_('Sinyal %s%%'), ap.get_strength()),
                fn: () => this._baglan(ap, profil, bagli)}));
        }
    }

    _baglan(ap, profil, bagli) {
        if (bagli) {
            this._aygit.disconnect_async(null, null);
            return;
        }
        // kayıtlı ağ: profille; yeni ağ: NM profili oluşturur, şifre gerekirse GNOME'un ağ aracısı sorar
        if (profil)
            this._istemci.activate_connection_async(profil, this._aygit, ap.get_path(), null, null);
        else
            this._istemci.add_and_activate_connection_async(null, this._aygit, ap.get_path(), null, null);
        this._kapat?.();
    }

    destroy() {
        this._iptal.cancel();
        if (this._yazId)
            GLib.source_remove(this._yazId);
        birak(this._idler);
        this.actor.destroy();
    }
}

// ---------- Bluetooth ----------
export class BluetoothPaneli {
    constructor({kapat}) {
        this._kapat = kapat;
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
        this._istemci = new GnomeBluetooth.Client();
        this._model = this._istemci.get_devices();
        this._idler = [
            [this._model, this._model.connect('items-changed', () => this._planla())],
            [this._istemci, this._istemci.connect('notify::default-adapter-powered', () => this._planla())],
            [this._istemci, this._istemci.connect('notify::default-adapter', () => this._planla())],
        ];
        this._aygitIdler = [];
        this._mesgul = new Set();
        this._yaz();
    }

    _planla() {
        if (this._yazId)
            return;
        this._yazId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            this._yazId = 0;
            this._yaz();
            return GLib.SOURCE_REMOVE;
        });
    }

    _yaz() {
        birak(this._aygitIdler);
        this._aygitIdler = [];
        this.actor.destroy_all_children();
        const acik = this._istemci.default_adapter_powered;
        this.actor.add_child(baslik('Bluetooth',
            kucukDugme('emblem-system-symbolic', _('Bluetooth ayarları (yeni cihaz eşleştir)'), () => {
                this._kapat?.();
                ayarlariAc('bluetooth');
            }),
            anahtar(acik, () => {
                this._istemci.default_adapter_powered = !acik;
            })));
        if (!this._istemci.default_adapter) {
            this.actor.add_child(new St.Label({text: _('Bluetooth bağdaştırıcısı yok'), style_class: 'flugel-soluk'}));
            return;
        }
        if (!acik) {
            this.actor.add_child(new St.Label({text: _('Bluetooth kapalı'), style_class: 'flugel-soluk'}));
            return;
        }
        const aygitlar = [];
        for (let i = 0; i < this._model.get_n_items(); i++) {
            const d = this._model.get_item(i);
            if (d.paired || d.trusted)
                aygitlar.push(d);
        }
        aygitlar.sort((a, b) => (b.connected - a.connected) || a.alias.localeCompare(b.alias));
        if (!aygitlar.length)
            this.actor.add_child(new St.Label({text: _('Eşleşmiş cihaz yok'), style_class: 'flugel-soluk'}));
        for (const d of aygitlar) {
            for (const s of ['notify::connected', 'notify::battery-percentage', 'notify::alias'])
                this._aygitIdler.push([d, d.connect(s, () => this._planla())]);
            const pil = d.battery_type !== GnomeBluetooth.BatteryType.NONE && d.battery_percentage > 0 ? d.battery_percentage : null;
            const yol = d.get_object_path();
            const alt = this._mesgul.has(yol) ? (d.connected ? _('Ayrılıyor…') : _('Bağlanıyor…'))
                : d.connected ? (pil !== null ? f(_('Bağlı · pil %%%s'), Math.round(pil)) : _('Bağlı')) : _('Bağlı değil');
            const pilIkon = pil === null ? [] : [`battery-level-${Math.min(100, Math.round(pil / 10) * 10)}-symbolic`];
            this.actor.add_child(satir({ikon: d.icon ? (d.icon.endsWith('-symbolic') ? d.icon : `${d.icon}-symbolic`) : 'bluetooth-active-symbolic', ad: d.alias || d.name || d.address, alt,
                sagIkon: [...pilIkon, ...(d.connected ? ['object-select-symbolic'] : [])], secili: d.connected,
                ipucu: d.connected ? _('Tıkla: bağlantıyı kes') : _('Tıkla: bağlan'),
                fn: () => this._degistir(d)}));
        }
    }

    async _degistir(d) {
        const yol = d.get_object_path();
        if (this._mesgul.has(yol))
            return;
        this._mesgul.add(yol);
        this._yaz();
        try {
            await this._istemci.connect_service(yol, !d.connected, null);
        } catch (e) {
            console.warn(`FLUGEL Island: Bluetooth ${d.alias}: ${e.message}`);
        }
        this._mesgul.delete(yol);
        if (!this._bitti)
            this._planla();
    }

    destroy() {
        this._bitti = true;
        if (this._yazId)
            GLib.source_remove(this._yazId);
        birak(this._aygitIdler);
        birak(this._idler);
        this.actor.destroy();
    }
}

// ---------- uygulama sesleri + çıkış cihazı ----------
export class UygulamaSesleri {
    constructor() {
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-detay-panel', x_expand: true});
        this._mikser = Volume.getMixerControl();
        this._idler = ['stream-added', 'stream-removed', 'default-sink-changed', 'output-added', 'output-removed']
            .map(s => [this._mikser, this._mikser.connect(s, () => this._planla())]);
        this._akisIdler = [];
        this._yaz();
    }

    _planla() {
        if (this._yazId)
            return;
        this._yazId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this._yazId = 0;
            this._yaz();
            return GLib.SOURCE_REMOVE;
        });
    }

    _yaz() {
        birak(this._akisIdler);
        this._akisIdler = [];
        this.actor.destroy_all_children();
        // çıkış cihazları (hoparlör, kulaklık, HDMI…)
        const varsayilan = this._mikser.get_default_sink();
        const cikislar = this._mikser.get_sinks().filter(s => s.get_ports?.().length !== 0 || s.description);
        if (cikislar.length > 1) {
            this.actor.add_child(new St.Label({text: _('Çıkış'), style_class: 'flugel-bolum-baslik'}));
            const cipler = new St.BoxLayout({style_class: 'flugel-cipler', x_expand: true});
            for (const s of cikislar) {
                const b = new St.Button({label: s.description || s.name, style_class: `flugel-cip${s === varsayilan ? ' flugel-anahtar-acik' : ''}`,
                    can_focus: true});
                b.connect('clicked', () => this._mikser.set_default_sink(s));
                cipler.add_child(b);
            }
            this.actor.add_child(cipler);
        }
        this.actor.add_child(new St.Label({text: _('Uygulamalar'), style_class: 'flugel-bolum-baslik'}));
        const akislar = this._mikser.get_sink_inputs().filter(s => !s.is_event_stream && s.get_application_id?.() !== 'org.gnome.VolumeControl');
        if (!akislar.length)
            this.actor.add_child(new St.Label({text: _('Şu an ses çalan uygulama yok'), style_class: 'flugel-soluk'}));
        const azami = this._mikser.get_vol_max_norm();
        for (const s of akislar) {
            const kutu = new St.BoxLayout({style_class: 'flugel-cubuk-satir', x_expand: true});
            const app = s.get_application_id?.() ? Shell.AppSystem.get_default().lookup_app(`${s.get_application_id()}.desktop`) : null;
            const ad = app?.get_name() || s.get_name() || s.get_description() || _('Uygulama');
            const sessiz = new St.Button({style_class: 'flugel-dugme flugel-dugme-kucuk', can_focus: true,
                child: new St.Icon({...((app?.get_icon() ?? s.get_gicon?.()) ? {gicon: app?.get_icon() ?? s.get_gicon()} : {icon_name: 'audio-speakers-symbolic'}),
                    icon_size: 18})});
            sessiz.connect('clicked', () => s.change_is_muted(!s.is_muted));
            ipucuBagla(sessiz, f(_('%s: sesi kapat / aç'), ad));
            const cubuk = new Slider(Math.min(1, s.volume / azami));
            cubuk.x_expand = true;
            cubuk.y_align = Clutter.ActorAlign.CENTER;
            cubuk.accessible_name = ad;
            const yuzde = new St.Label({style_class: 'flugel-cubuk-yuzde', y_align: Clutter.ActorAlign.CENTER});
            const ust = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
            const adEtiket = new St.Label({text: ad, style_class: 'flugel-detay-alt'});
            adEtiket.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            ust.add_child(adEtiket);
            ust.add_child(cubuk);
            kutu.add_child(sessiz);
            kutu.add_child(ust);
            kutu.add_child(yuzde);
            let kilit = false;
            const oku = () => {
                kilit = true;
                cubuk.value = Math.min(1, s.volume / azami);
                kilit = false;
                yuzde.text = s.is_muted ? _('kapalı') : `${Math.round(100 * s.volume / azami)}%`;
                sessiz.opacity = s.is_muted ? 120 : 255;
            };
            oku();
            this._akisIdler.push([cubuk, cubuk.connect('notify::value', () => {
                if (kilit)
                    return;
                s.volume = cubuk.value * azami;
                if (s.is_muted && cubuk.value > 0)
                    s.change_is_muted(false);
                s.push_volume();
            })]);
            this._akisIdler.push([s, s.connect('notify::volume', oku)], [s, s.connect('notify::is-muted', oku)]);
            this.actor.add_child(kutu);
        }
        const ayar = new St.Button({label: _('Ses ayarları'), style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true,
            x_align: Clutter.ActorAlign.END});
        ayar.connect('clicked', () => ayarlariAc('sound'));
        this.actor.add_child(ayar);
    }

    destroy() {
        if (this._yazId)
            GLib.source_remove(this._yazId);
        birak(this._akisIdler);
        birak(this._idler);
        this.actor.destroy();
    }
}
