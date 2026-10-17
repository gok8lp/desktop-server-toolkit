// FLUGEL Island — dil (Türkçe / English). Kaynak metinler Türkçe; İngilizce çeviri po/en.po → locale/en/…/flugel-island.mo.
// Dil, sistem dilinden bağımsız seçilebilir (ayar: dil = sistem | tr | en). Kabuğun kendi dilini (setlocale)
// değiştirmemek için .mo dosyası burada okunur. Saf modül: hem kabukta hem ayar penceresinde çalışır.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {systemLanguage} from './i18n.js';

let tablo = null;
export let DIL = 'tr';

function moOku(yol) {
    try {
        const [, veri] = Gio.File.new_for_path(yol).load_contents(null);
        const v = new DataView(veri.buffer, veri.byteOffset, veri.byteLength);
        const sihir = v.getUint32(0, true);
        const le = sihir === 0x950412de;
        if (!le && v.getUint32(0, false) !== 0x950412de)
            return null;
        const n = v.getUint32(8, le), o = v.getUint32(12, le), t = v.getUint32(16, le);
        const coz = new TextDecoder('utf-8');
        const metin = (uz, ofs) => coz.decode(veri.subarray(ofs, ofs + uz));
        const m = new Map();
        for (let i = 0; i < n; i++) {
            const kaynak = metin(v.getUint32(o + 8 * i, le), v.getUint32(o + 8 * i + 4, le));
            const ceviri = metin(v.getUint32(t + 8 * i, le), v.getUint32(t + 8 * i + 4, le));
            if (kaynak && ceviri)
                m.set(kaynak, ceviri);
        }
        return m;
    } catch (e) {
        return null;
    }
}

export function dilKur(eklentiYolu, secim = 'sistem') {
    const sistem = systemLanguage(GLib.get_language_names());
    DIL = secim === 'tr' || secim === 'en' ? secim : sistem;
    tablo = DIL === 'tr' ? null : moOku(`${eklentiYolu}/locale/${DIL}/LC_MESSAGES/flugel-island.mo`);
}

// gettext benzeri: çeviri yoksa kaynak (Türkçe) metin
export function _(metin) {
    return tablo?.get(metin) ?? metin;
}

// "%s" / "%d" yer tutucularını sırayla doldurur: f(_('Çalışma alanı %d'), 3)
export function f(kalip, ...degerler) {
    let i = 0;
    return kalip.replace(/%[sd%]/g, m => (m === '%%' ? '%' : String(degerler[i++])));
}
