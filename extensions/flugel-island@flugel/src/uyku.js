// FLUGEL Island — uyku engelleme (fincan). GNOME'un kendi mekanizması: org.gnome.SessionManager.Inhibit
// (ekran kararması/kapanması + bekleme/uyku engellenir). Süre: süresiz · 1 sa · 2 sa · video oynarken
// (MPRIS'te bir oynatıcı "Playing" iken). Açıkken boştaki kapsülde küçük fincan görünür. Eklenti kapanınca
// engel kalkar (çerez bırakılır).
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {createActivity} from './activity.js';
import {oncelik} from './providers/provider-base.js';
import {_} from './dil.js';

const SM = 'org.gnome.SessionManager';
const BOSTA = 8, UYKU = 4;
export const UYKU_KIPLERI = () => [
    ['suresiz', _('Süresiz'), 0],
    ['1sa', _('1 saat'), 3600],
    ['2sa', _('2 saat'), 7200],
    ['video', _('Video oynarken'), -1],
];

export class UykuEngeli {
    constructor(yonetici, ayarlar) {
        this._yonetici = yonetici;
        this._ayar = ayarlar;
        this.kip = null;           // null = kapalı
        this._cerez = 0;
        this._iptal = new Gio.Cancellable();
        this._calanlar = new Set();
        this._dinleyiciler = new Set();
    }

    abone(fn) {
        this._dinleyiciler.add(fn);
        return () => this._dinleyiciler.delete(fn);
    }

    get acik() {
        return this.kip !== null;
    }

    get bitis() {
        return this._bitis ?? 0;
    }

    ac(kip = 'suresiz') {
        this.kapat(false);
        this.kip = kip;
        const sn = UYKU_KIPLERI().find(k => k[0] === kip)?.[2] ?? 0;
        if (sn > 0) {
            this._bitis = Date.now() + sn * 1000;
            this._sureId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, sn, () => {
                this._sureId = 0;
                this.kapat();
                return GLib.SOURCE_REMOVE;
            });
        }
        if (kip === 'video')
            this._videoIzle();
        else
            this._engelle(true);
        this._bildir();
    }

    kapat(bildir = true) {
        if (this._sureId)
            GLib.source_remove(this._sureId);
        this._sureId = 0;
        this._bitis = 0;
        this._videoBirak();
        this._engelle(false);
        this.kip = null;
        if (bildir)
            this._bildir();
    }

    _bildir() {
        const id = 'uyku:mini';
        if (this.kip === null) {
            this._yonetici?.remove(id);
        } else {
            const ad = UYKU_KIPLERI().find(k => k[0] === this.kip)?.[1] ?? '';
            this._yonetici?.update(createActivity({
                id, providerId: 'uyku', tier: 'ambient', slot: 'either',
                priority: oncelik(this._ayar, 'privacy', 90),
                glyph: 'fincan', label: _('Uyku engelli'), sublabel: ad,
                data: {mini: true, kartta: true},
            }));
        }
        for (const fn of this._dinleyiciler)
            fn(this);
    }

    _engelle(evet) {
        if (evet && !this._cerez && !this._istek) {
            this._istek = true;
            Gio.DBus.session.call(SM, '/org/gnome/SessionManager', SM, 'Inhibit',
                new GLib.Variant('(susu)', ['org.gnome.Shell.Extensions.FlugelIsland', 0, _('FLUGEL Island: uyku engelleme'), BOSTA | UYKU]),
                new GLib.VariantType('(u)'), Gio.DBusCallFlags.NONE, -1, this._iptal, (bus, res) => {
                    this._istek = false;
                    try {
                        const [cerez] = bus.call_finish(res).deepUnpack();
                        // bu arada kapatıldıysa hemen bırak
                        if (this.kip === null || (this.kip === 'video' && !this._calanlar.size))
                            this._birak(cerez);
                        else
                            this._cerez = cerez;
                    } catch (e) {
                        console.error('FLUGEL Island: uyku engellenemedi', e);
                    }
                });
        } else if (!evet && this._cerez) {
            this._birak(this._cerez);
            this._cerez = 0;
        }
    }

    _birak(cerez) {
        Gio.DBus.session.call(SM, '/org/gnome/SessionManager', SM, 'Uninhibit', new GLib.Variant('(u)', [cerez]),
            null, Gio.DBusCallFlags.NONE, -1, null, null);
    }

    // ---------- video kipi: bir MPRIS oynatıcı çalarken engelle ----------
    _videoIzle() {
        const bus = Gio.DBus.session;
        this._mprisId = bus.signal_subscribe(null, 'org.freedesktop.DBus.Properties', 'PropertiesChanged',
            '/org/mpris/MediaPlayer2', null, Gio.DBusSignalFlags.NONE, (_c, gonderen, _y, _a, _s, params) => {
                const [arayuz, degisen] = params.deepUnpack();
                if (arayuz !== 'org.mpris.MediaPlayer2.Player' || !('PlaybackStatus' in degisen))
                    return;
                this._durum(gonderen, degisen.PlaybackStatus.deepUnpack() === 'Playing');
            });
        this._sahipId = bus.signal_subscribe('org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', null, Gio.DBusSignalFlags.NONE, (_c, _g, _y, _a, _s, params) => {
                const [, eski, yeni] = params.deepUnpack();
                if (eski && !yeni)
                    this._durum(eski, false);
            });
        // şu an çalanlar
        bus.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'ListNames', null, null,
            Gio.DBusCallFlags.NONE, -1, this._iptal, (_b, res) => {
                let adlar = [];
                try {
                    [adlar] = bus.call_finish(res).deepUnpack();
                } catch (e) {
                    return;
                }
                for (const ad of adlar.filter(a => a.startsWith('org.mpris.MediaPlayer2.'))) {
                    bus.call(ad, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties', 'Get',
                        new GLib.Variant('(ss)', ['org.mpris.MediaPlayer2.Player', 'PlaybackStatus']), null,
                        Gio.DBusCallFlags.NONE, 2000, this._iptal, (_b2, r2) => {
                            try {
                                const [v] = bus.call_finish(r2).deepUnpack();
                                if (v.deepUnpack() === 'Playing')
                                    this._durum(ad, true);
                            } catch (e) {
                                // oynatıcı cevap vermedi
                            }
                        });
                }
            });
    }

    _durum(kim, caliyor) {
        if (this.kip !== 'video')
            return;
        if (caliyor)
            this._calanlar.add(kim);
        else
            this._calanlar.delete(kim);
        this._engelle(this._calanlar.size > 0);
    }

    _videoBirak() {
        for (const id of [this._mprisId, this._sahipId]) {
            if (id)
                Gio.DBus.session.signal_unsubscribe(id);
        }
        this._mprisId = this._sahipId = 0;
        this._calanlar.clear();
    }

    destroy() {
        this.kapat(false);
        this._yonetici?.remove('uyku:mini');
        this._iptal.cancel();
        this._dinleyiciler.clear();
        this._yonetici = null;
    }
}
