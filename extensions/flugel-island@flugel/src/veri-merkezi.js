// FLUGEL Island — veri merkezi.
// Tüm sayfalar ve canlı etkinlikler aynı veriyi buradan alır; her kaynak için tek bir zamanlayıcı ve
// aynı anda en fazla bir alt süreç çalışır. Pildeyken ve Pil Tasarrufu açıkken yenileme seyrekleşir.
// Ekran kilitliyken eklenti tamamen kapanır (session-modes: user), yani o sırada hiç sorgu yapılmaz.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {VERI, H, ONBELLEK, jsonAl} from './ortak.js';
import {izlenenler} from './kripto-ortak.js';

// tür → [komut, önbellek dosyası (zorla yenilemede silinir), ayar anahtarı (saniye) | null = sadece istenince]
const KAYNAKLAR = {
    island: [[VERI, 'island'], 'island', 'yenileme-sunucu'],
    canli: [[VERI, 'canli'], 'canli', 'yenileme-kripto'],
    pc: [[VERI, 'pc'], null, 'yenileme-pc'],
    kripto: [[VERI, 'kripto'], 'kripto', null],
    // izleme listesi + alarm koinleri (fiyat alarmları bununla denetlenir)
    kizle: [a => [VERI, 'kripto-izle', izlenenler(a).join(',') || 'BTC'], null, 'yenileme-kripto'],
    maclar: [[VERI, 'maclar'], 'maclar-island', 'yenileme-maclar'],
    // CS2 (HLTV): bu PC'deki cs2-veri botu; ayar kapalıysa çalışmaz
    cs2: [a => (a.get_boolean('cs2-etkin') ? [`${H}/.local/bin/cs2-veri`, String(Math.max(20, a.get_int('yenileme-cs2') - 5))] : null), 'cs2', 'yenileme-cs2'],
    basket: [[VERI, 'basket'], 'basket', null],
    anime: [[VERI, 'anime'], 'anime', 'yenileme-anime'],
    vm: [[`${H}/.local/bin/vm`, 'liste'], null, null],
};

export class VeriMerkezi {
    constructor(ayarlar) {
        this._ayar = ayarlar;
        this._veri = new Map();
        this._aboneler = new Map();
        this._zamanlar = new Map();
        this._suruyor = new Set();
        this._zaman = new Map();
        this._iptal = new Gio.Cancellable();
        this._seyrek = false;
        this._ayarId = this._ayar.connect('changed', (_s, anahtar) => {
            if (anahtar.startsWith('yenileme-') || anahtar === 'pil-carpani')
                this._hepsiniPlanla();
            if (anahtar === 'kripto-varliklar')
                this.yenile('kizle');
        });
    }

    baslat() {
        for (const tur of Object.keys(KAYNAKLAR)) {
            if (KAYNAKLAR[tur][2])
                this.yenile(tur);
        }
        this._hepsiniPlanla();
    }

    // fn(veri) hemen (veri varsa) ve her yenilemede çağrılır. Dönen fonksiyon aboneliği bırakır.
    abone(tur, fn) {
        if (!this._aboneler.has(tur))
            this._aboneler.set(tur, new Set());
        this._aboneler.get(tur).add(fn);
        if (this._veri.has(tur))
            fn(this._veri.get(tur));
        return () => this._aboneler.get(tur)?.delete(fn);
    }

    // veri `yas` saniyeden eskiyse yenile (kart her açıldığında boşuna süreç başlatılmasın)
    tazele(tur, yas = 30) {
        const t = this._zaman.get(tur);
        if (!t || GLib.get_monotonic_time() - t > yas * 1e6)
            this.yenile(tur);
    }

    son(tur) {
        return this._veri.get(tur) ?? null;
    }

    async yenile(tur, zorla = false) {
        const k = KAYNAKLAR[tur];
        if (!k || this._suruyor.has(tur) || this._iptal.is_cancelled())
            return;
        if (zorla && k[1])
            GLib.unlink(`${ONBELLEK}/${k[1]}.json`);
        this._suruyor.add(tur);
        const argv = typeof k[0] === 'function' ? k[0](this._ayar) : k[0];
        if (!argv) {
            this._suruyor.delete(tur);
            return;
        }
        const veri = await jsonAl(argv, this._iptal);
        this._suruyor.delete(tur);
        if (this._iptal.is_cancelled())
            return;
        this._veri.set(tur, veri);
        this._zaman.set(tur, GLib.get_monotonic_time());
        for (const fn of this._aboneler.get(tur) ?? []) {
            try {
                fn(veri);
            } catch (e) {
                console.error(`FLUGEL Island: ${tur} abonesi hata verdi`, e);
            }
        }
    }

    // Pilde ya da Pil Tasarrufu açıkken çağrılır: aralıklar pil-carpani ile çarpılır.
    seyrekModu(seyrek) {
        if (this._seyrek === seyrek)
            return;
        this._seyrek = seyrek;
        this._hepsiniPlanla();
    }

    get seyrek() {
        return this._seyrek;
    }

    _hepsiniPlanla() {
        for (const id of this._zamanlar.values())
            GLib.source_remove(id);
        this._zamanlar.clear();
        const carpan = this._seyrek ? Math.max(1, this._ayar.get_int('pil-carpani')) : 1;
        for (const [tur, [, , anahtar]] of Object.entries(KAYNAKLAR)) {
            if (!anahtar)
                continue;
            const sn = Math.max(5, this._ayar.get_int(anahtar)) * carpan;
            const id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, sn, () => {
                this.yenile(tur);
                return GLib.SOURCE_CONTINUE;
            });
            GLib.Source.set_name_by_id(id, `[flugel-island] ${tur}`);
            this._zamanlar.set(tur, id);
        }
    }

    destroy() {
        this._iptal.cancel();
        for (const id of this._zamanlar.values())
            GLib.source_remove(id);
        this._zamanlar.clear();
        this._ayar.disconnect(this._ayarId);
        this._aboneler.clear();
        this._veri.clear();
    }
}
