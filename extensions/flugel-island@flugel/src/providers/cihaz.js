// FLUGEL Island — kablosuz klavye/fare (Logitech K380s, G305 ve diğerleri): bağlanınca pil yüzdesiyle kısa
// bildirim, pil eşiğin altına düşünce kalıcı uyarı, kartta güncel pil durumu. UPower üzerinden, yoklama yok.
import Gio from 'gi://Gio';
import {createActivity, _now} from '../activity.js';
import {oncelik, geciciSure} from './provider-base.js';
import {KIRMIZI} from '../ortak.js';

const UPOWER = 'org.freedesktop.UPower';
const AYGIT = 'org.freedesktop.UPower.Device';
// UPower aygıt türleri: 5 fare, 6 klavye, 12 kulaklık, 17 kulaklık seti, 20 oyun kolu …
const TURLER = {5: ['input-mouse-symbolic', 'Fare'], 6: ['input-keyboard-symbolic', 'Klavye'],
    12: ['audio-headphones-symbolic', 'Kulaklık'], 17: ['audio-headset-symbolic', 'Kulaklık'],
    20: ['input-gaming-symbolic', 'Oyun kolu']};

export class CihazProvider {
    constructor() {
        this.id = 'cihaz';
        this._aygitlar = new Map();     // yol → {proxy, id, ilk}
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._iptal = new Gio.Cancellable();
        const bus = Gio.DBus.system;
        this._sinyaller = ['DeviceAdded', 'DeviceRemoved'].map(sinyal => bus.signal_subscribe(UPOWER, UPOWER, sinyal,
            '/org/freedesktop/UPower', null, Gio.DBusSignalFlags.NONE, (_c, _s, _p, _i, _ad, params) => {
                const [yol] = params.deepUnpack();
                if (sinyal === 'DeviceAdded')
                    this._ekle(yol, true);
                else
                    this._cikar(yol);
            }));
        bus.call(UPOWER, '/org/freedesktop/UPower', UPOWER, 'EnumerateDevices', null, null,
            Gio.DBusCallFlags.NONE, -1, this._iptal, (_b, res) => {
                try {
                    const [yollar] = bus.call_finish(res).deepUnpack();
                    yollar.forEach(y => this._ekle(y, false));
                } catch (e) {
                    // iptal edildi ya da UPower yok
                }
            });
    }

    disable() {
        this._iptal?.cancel();
        this._sinyaller?.forEach(id => Gio.DBus.system.signal_unsubscribe(id));
        this._sinyaller = null;
        for (const yol of [...this._aygitlar.keys()])
            this._cikar(yol);
        this._manager?.remove(`${this.id}:flash`);
        this._manager?.remove(`${this.id}:liste`);
        this._manager = null;
    }

    _ekle(yol, yeniBaglandi) {
        if (this._aygitlar.has(yol))
            return;
        Gio.DBusProxy.new(Gio.DBus.system, Gio.DBusProxyFlags.NONE, null, UPOWER, yol, AYGIT, this._iptal, (_o, res) => {
            let proxy;
            try {
                proxy = Gio.DBusProxy.new_finish(res);
            } catch (e) {
                return;
            }
            const tur = proxy.get_cached_property('Type')?.unpack();
            if (!TURLER[tur] || !this._manager || this._aygitlar.has(yol))
                return;
            const kayit = {proxy, dusukUyarildi: false};
            kayit.id = proxy.connect('g-properties-changed', () => this._yenile());
            this._aygitlar.set(yol, kayit);
            if (yeniBaglandi)
                this._flas(proxy, 'bağlandı');
            this._yenile();
        });
    }

    _cikar(yol) {
        const k = this._aygitlar.get(yol);
        if (!k)
            return;
        k.proxy.disconnect(k.id);
        this._aygitlar.delete(yol);
        this._manager?.remove(`${this.id}:dusuk:${yol}`);
        this._yenile();
    }

    _bilgi(proxy) {
        const [glyph, tur] = TURLER[proxy.get_cached_property('Type')?.unpack()] ?? ['battery-symbolic', 'Aygıt'];
        const ad = proxy.get_cached_property('Model')?.unpack() || tur;
        const yuzde = Math.round(proxy.get_cached_property('Percentage')?.unpack() ?? -1);
        return {glyph, ad, yuzde};
    }

    _flas(proxy, olay) {
        const {glyph, ad, yuzde} = this._bilgi(proxy);
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`, providerId: this.id, tier: 'transient', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph, label: `${ad} ${olay}${yuzde >= 0 ? ` · %${yuzde}` : ''}`,
            startedAt: now, expiresAt: now + geciciSure(this._settings),
            data: yuzde >= 0 ? {ilerleme: yuzde / 100} : {},
        }));
    }

    _yenile() {
        if (!this._manager)
            return;
        const esik = this._settings.get_int('cihaz-dusuk-esik');
        const satirlar = [];
        for (const [yol, k] of this._aygitlar) {
            const {glyph, ad, yuzde} = this._bilgi(k.proxy);
            if (yuzde < 0)
                continue;
            satirlar.push(`${ad} %${yuzde}`);
            const id = `${this.id}:dusuk:${yol}`;
            if (yuzde <= esik && !k.dusukUyarildi) {
                this._manager.update(createActivity({
                    id, providerId: this.id, tier: 'persistent', slot: 'either',
                    priority: oncelik(this._settings, this.id),
                    glyph, label: `${ad} pili azaldı`, sublabel: `%${yuzde} · şarj et`,
                    data: {renk: KIRMIZI, kisa: `%${yuzde}`, kapat: () => {
                        k.dusukUyarildi = true;
                        this._manager?.remove(id);
                    }},
                }));
            } else if (yuzde > esik) {
                k.dusukUyarildi = false;
                this._manager.remove(id);
            }
        }
        if (!satirlar.length) {
            this._manager.remove(`${this.id}:liste`);
            return;
        }
        // kartta görünen özet (kapsülde yer kaplamaz)
        this._manager.update(createActivity({
            id: `${this.id}:liste`, providerId: this.id, tier: 'ambient', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: 'input-keyboard-symbolic', label: 'Kablosuz aygıtlar', sublabel: satirlar.join(' · '),
            data: {kartta: true},
        }));
    }
}
