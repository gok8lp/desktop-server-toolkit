// FLUGEL Island — bildirimler adadan: yeni bildirim gelince ada yaylı bir animasyonla büyüyüp afiş olur
// (uygulama simgesi, başlık, metin); birkaç saniye sonra geri küçülür. Tıklayınca bildirim açılır, sağ tık kapatır.
// GNOME'un ekran üstü afişi Island görünürken bastırılır (bildirimler takvim listesinde yine durur); tam ekranda
// Island gizlenince GNOME'un afişi geri gelir. "Rahatsız etme" açıkken ya da uygulama afişi kapalıysa gösterilmez.
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {createActivity, _now} from '../activity.js';
import {oncelik} from './provider-base.js';
import {_} from '../dil.js';

const DUSUK = 0;

export class BildirimProvider {
    constructor(ortam) {
        this.id = 'bildirim';
        this._ortam = ortam;
        this._kaynaklar = new Map();
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._tray = Main.messageTray;
        this._genel = new Gio.Settings({schema_id: 'org.gnome.desktop.notifications'});
        this._trayIdler = [
            this._tray.connect('source-added', (_t, k) => this._bagla(k)),
            this._tray.connect('source-removed', (_t, k) => this._birak(k)),
        ];
        this._tray.getSources().forEach(k => this._bagla(k));
        // ada görünürken GNOME afişi bastırılır; tam ekranda (ada gizli) GNOME'unki çalışır
        this._kok = this._ortam.adaKok?.();
        this._gorunurId = this._kok?.connect('notify::visible', () => this._engelle()) ?? 0;
        this._kipId = settings.connect('changed::tam-ekran-kipi', () => this._engelle());
        this._engelle();
    }

    // ada bildirimi gösterebiliyorsa (tam ekranda çentik dahil) GNOME afişi bastırılır
    _engelle() {
        this._tray.bannerBlocked = !!this._ortam.adaGorunur?.();
    }

    _bagla(kaynak) {
        if (this._kaynaklar.has(kaynak))
            return;
        this._kaynaklar.set(kaynak, kaynak.connect('notification-added', (_k, n) => this._goster(kaynak, n)));
    }

    _birak(kaynak) {
        const id = this._kaynaklar.get(kaynak);
        if (id) {
            try {
                kaynak.disconnect(id);
            } catch (e) {
                // kaynak yok edilmiş
            }
        }
        this._kaynaklar.delete(kaynak);
    }

    _goster(kaynak, n) {
        if (!this._manager || !this._genel.get_boolean('show-banners') || kaynak.policy?.showBanners === false)
            return;
        if (n.urgency === DUSUK || n.isTransient && !n.title)
            return;
        const now = _now();
        const simge = n.gicon ?? kaynak.icon ?? null;
        this._manager.push(createActivity({
            id: `${this.id}:afis`, providerId: this.id, tier: 'transient', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: simge ?? 'mail-unread-symbolic',
            label: n.title || kaynak.title || _('Bildirim'),
            sublabel: n.body || null,
            startedAt: now,
            expiresAt: now + this._settings.get_int('bildirim-sure') * 1000,
            data: {bildirim: true, uygulama: kaynak.title ?? '', kaynakSimge: kaynak.icon ?? null,
                tikla: () => {
                    this._manager?.remove(`${this.id}:afis`);
                    n.activate();
                },
                kapat: () => this._manager?.remove(`${this.id}:afis`)},
        }));
    }

    disable() {
        for (const id of this._trayIdler ?? [])
            this._tray.disconnect(id);
        this._trayIdler = null;
        for (const k of [...this._kaynaklar.keys()])
            this._birak(k);
        if (this._gorunurId)
            this._kok.disconnect(this._gorunurId);
        if (this._kipId)
            this._settings.disconnect(this._kipId);
        this._kipId = 0;
        this._gorunurId = 0;
        if (this._tray)
            this._tray.bannerBlocked = false;
        this._manager?.remove(`${this.id}:afis`);
        this._manager = null;
        this._genel = null;
    }
}
