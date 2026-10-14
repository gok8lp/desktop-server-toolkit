// FLUGEL Island — çalan medya (MPRIS: Spotify, Chrome/YouTube, mpv, Jellyfin…).
// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) media.js'ten. FLUGEL değişiklikleri (2026-10-13): albüm
// kapağı, önceki / oynat-duraklat / sonraki düğmeleri, duraklatılınca 5 dk daha görünme, öncelik ayardan;
// D-Bus çağrıları eşzamansız ve iptal edilebilir; tüm vekiller disable()'da bırakılır.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {_} from '../dil.js';

const MPRIS_BUS_PREFIX = 'org.mpris.MediaPlayer2.';
const MPRIS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const DURAKLAMA_SURESI = 5 * 60;   // sn

const coz = v => (v?.deepUnpack ? v.deepUnpack() : v);

export class MediaProvider {
    constructor() {
        this.id = 'media';
        this._players = new Map();   // busName → {proxy, propsHandler, duraklatildi}
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._dbus = Gio.DBus.session;
        this._iptal = new Gio.Cancellable();
        this._dakikaId = 0;
        this._busHandler = this._dbus.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', null, Gio.DBusSignalFlags.NONE,
            (_c, _s, _p, _i, _sig, params) => {
                const [name, oldOwner, newOwner] = params.deepUnpack();
                if (!name.startsWith(MPRIS_BUS_PREFIX))
                    return;
                if (newOwner && !oldOwner)
                    this._addPlayer(name);
                else if (oldOwner && !newOwner)
                    this._removePlayer(name);
            });
        this._dbus.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'ListNames',
            null, null, Gio.DBusCallFlags.NONE, -1, this._iptal, (_b, res) => {
                try {
                    const [names] = this._dbus.call_finish(res).deepUnpack();
                    names.filter(n => n.startsWith(MPRIS_BUS_PREFIX)).forEach(n => this._addPlayer(n));
                } catch (e) {
                    // iptal edildi
                }
            });
    }

    disable() {
        this._iptal?.cancel();
        if (this._busHandler)
            this._dbus.signal_unsubscribe(this._busHandler);
        this._busHandler = 0;
        if (this._dakikaId)
            GLib.source_remove(this._dakikaId);
        this._dakikaId = 0;
        for (const name of [...this._players.keys()])
            this._removePlayer(name);
        this._manager = null;
    }

    _addPlayer(busName) {
        if (this._players.has(busName))
            return;
        Gio.DBusProxy.new(this._dbus, Gio.DBusProxyFlags.GET_INVALIDATED_PROPERTIES, null, busName, MPRIS_PATH,
            PLAYER_IFACE, this._iptal, (_o, res) => {
                let proxy;
                try {
                    proxy = Gio.DBusProxy.new_finish(res);
                } catch (e) {
                    return;
                }
                if (!this._manager || this._players.has(busName))
                    return;
                const kayit = {proxy, duraklatildi: 0};
                kayit.propsHandler = proxy.connect('g-properties-changed', () => this._refresh(busName));
                this._players.set(busName, kayit);
                this._refresh(busName);
            });
    }

    _removePlayer(busName) {
        const entry = this._players.get(busName);
        if (entry)
            entry.proxy.disconnect(entry.propsHandler);
        this._players.delete(busName);
        this._manager?.remove(`${this.id}:${busName}`);
    }

    _cagir(busName, yontem) {
        this._players.get(busName)?.proxy.call(yontem, null, Gio.DBusCallFlags.NONE, 2000, this._iptal, null);
    }

    _refresh(busName) {
        const kayit = this._players.get(busName);
        if (!kayit || !this._manager)
            return;
        const proxy = kayit.proxy;
        const status = coz(proxy.get_cached_property('PlaybackStatus'));
        const metadata = coz(proxy.get_cached_property('Metadata')) ?? {};
        const title = coz(metadata['xesam:title']) ?? '';
        const artistArr = coz(metadata['xesam:artist']) ?? [];
        const artist = Array.isArray(artistArr) ? artistArr.join(', ') : String(artistArr);
        const artUrl = coz(metadata['mpris:artUrl']) ?? '';
        const simdi = GLib.get_monotonic_time() / 1e6;

        if (status === 'Playing')
            kayit.duraklatildi = 0;
        else if (status === 'Paused' && !kayit.duraklatildi)
            kayit.duraklatildi = simdi;
        const sureDoldu = kayit.duraklatildi && simdi - kayit.duraklatildi > DURAKLAMA_SURESI;
        if (!title || (status !== 'Playing' && status !== 'Paused') || sureDoldu) {
            this._manager.remove(`${this.id}:${busName}`);
            return;
        }
        if (status === 'Paused')
            this._sureyiIzle();

        const caliyor = status === 'Playing';
        const kapak = /^(file|https?):\/\//.test(artUrl) ? Gio.FileIcon.new(Gio.File.new_for_uri(artUrl)) : null;
        const eylemler = [];
        if (coz(proxy.get_cached_property('CanGoPrevious')))
            eylemler.push({ikon: 'media-skip-backward-symbolic', ipucu: _('Önceki'), fn: () => this._cagir(busName, 'Previous')});
        eylemler.push({ikon: caliyor ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic',
            ipucu: caliyor ? _('Duraklat') : _('Oynat'), fn: () => this._cagir(busName, 'PlayPause')});
        if (coz(proxy.get_cached_property('CanGoNext')))
            eylemler.push({ikon: 'media-skip-forward-symbolic', ipucu: _('Sonraki'), fn: () => this._cagir(busName, 'Next')});

        this._manager.update(createActivity({
            id: `${this.id}:${busName}`,
            providerId: this.id,
            tier: 'persistent',
            slot: 'either',
            // çalan, duraklatılmıştan önce gelir
            priority: oncelik(this._settings, this.id, caliyor ? 50 : 0),
            glyph: kapak ? null : (caliyor ? 'media-playback-start-symbolic' : 'media-playback-pause-symbolic'),
            label: title,
            sublabel: artist || null,
            data: {kapak, kapakUrl: artUrl, kisa: caliyor ? '' : _('duraklatıldı'), eylemler},
        }));
    }

    _sureyiIzle() {
        if (this._dakikaId)
            return;
        // duraklatılmış oyuncu 5 dk sonra kalkar; sadece duraklatılmış varken dakikada bir bakılır
        this._dakikaId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 60, () => {
            for (const name of this._players.keys())
                this._refresh(name);
            const simdi = GLib.get_monotonic_time() / 1e6;
            if ([...this._players.values()].some(k => k.duraklatildi && simdi - k.duraklatildi <= DURAKLAMA_SURESI))
                return GLib.SOURCE_CONTINUE;
            this._dakikaId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }
}
