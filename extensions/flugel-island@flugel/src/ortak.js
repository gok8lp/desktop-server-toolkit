// FLUGEL Island — ortak yardımcılar.
// Çoğu FLUGEL v1 panelinden (flugel-panel@flugel) taşındı: simgeler, komut çalıştırma, menü satırları, ipuçları.
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {_, f} from './dil.js';

export const H = GLib.get_home_dir();
export const VERI = `${H}/.local/bin/ust-panel-veri`;
export const ONBELLEK = `${H}/.cache/sistem-bakim`;
// ---------- renk paleti (tek yer; CSS'teki sabitler stylesheet.css başındaki tabloyla aynı) ----------
// Siyah-beyaz FLUGEL kimliği: turuncu/kahverengi yok. Uyarı renkleri sadece sorun anında.
export const SARI = '#E8C66B', KIRMIZI = '#F07B7B', SOLUK = '#9A9AA5', YESIL = '#8FD6A0';
export const KAPSUL_RGB = [0, 0, 0];        // boştaki/kompakt kapsül: saf siyah (opaklık: ayar 'saydamlik')
export const KART_RGB = [14, 14, 16];       // açık kart: koyu nötr cam (opaklık: ayar 'kart-saydamlik')

let EXT = '';
export function eklentiYolu(yol) {
    EXT = yol;
}
export const dosya = alt => `${EXT}/${alt}`;

// ---------- simgeler (kural: kendi simgelerimiz ikon/<ad>-mono.svg, gerisi tema simgesi) ----------
const OZEL_IKONLAR = new Set(['anime', 'basket', 'manga', 'kurukafa', 'panik', 'eclipse', 'kapat-daire', 'kalkan', 'fincan', 'goz-kapali', 'top',
    'coin-btc', 'coin-eth', 'coin-sol', 'coin-bnb', 'coin-xrp', 'coin-doge', 'coin-avax', 'coin-ada']);
const ikonOnbellek = new Map();
export function ikon(ad) {
    if (ad instanceof Gio.Icon)
        return ad;
    if (!ikonOnbellek.has(ad) && ad.startsWith('renkli:')) {
        // hizmet logoları (Crunchyroll, HIDIVE, MAL…) kendi renkleriyle: ikon/renkli/<ad>.png
        ikonOnbellek.set(ad, Gio.FileIcon.new(Gio.File.new_for_path(dosya(`ikon/renkli/${ad.slice(7)}.png`))));
    }
    if (!ikonOnbellek.has(ad)) {
        ikonOnbellek.set(ad, OZEL_IKONLAR.has(ad)
            ? Gio.FileIcon.new(Gio.File.new_for_path(dosya(`ikon/${ad}-mono.svg`)))
            : Gio.ThemedIcon.new(ad));
    }
    return ikonOnbellek.get(ad);
}
export function ikonOnbellegiTemizle() {
    ikonOnbellek.clear();
}
export function stIkon(ad, boyut = 16, stil = 'flugel-ikon') {
    return new St.Icon({gicon: ikon(ad), icon_size: boyut, style_class: stil, y_align: Clutter.ActorAlign.CENTER});
}

// ---------- komutlar (hepsi eşzamansız; kabuk asla beklemez) ----------
export function komutCiktisi(argv, iptal = null) {
    return new Promise(coz => {
        let p;
        try {
            p = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            coz(null);
            return;
        }
        p.communicate_utf8_async(null, iptal, (proc, res) => {
            try {
                coz(proc.communicate_utf8_finish(res)[1]);
            } catch (e) {
                coz(null);
            }
        });
    });
}

export async function jsonAl(argv, iptal = null) {
    const cikti = await komutCiktisi(argv, iptal);
    if (cikti === null)
        return {hata: _('komut çalışmadı')};
    try {
        return JSON.parse(cikti);
    } catch (e) {
        return {hata: String(e).slice(0, 60)};
    }
}

export function ekranGoruntusu() {
    try {
        Main.screenshotUI.open().catch(() => {});
    } catch (e) {
        Main.notify(_('Ekran görüntüsü'), _('Açılamadı'));
    }
}

export function calistir(komut) {
    if (komut === '__ekran__')
        return ekranGoruntusu();
    try {
        GLib.spawn_command_line_async(komut);
    } catch (e) {
        Main.notify('FLUGEL Island', f(_('Çalıştırılamadı: %s'), komut));
    }
    return undefined;
}

export function bash(betik) {
    try {
        Gio.Subprocess.new(['bash', '-c', betik], Gio.SubprocessFlags.NONE);
    } catch (e) {
        Main.notify('FLUGEL Island', String(e));
    }
}

// ---------- metin biçimleri ----------
export const kac = t => GLib.markup_escape_text(String(t ?? ''), -1);
export function para(n, ondalik) {
    if (n === null || n === undefined)
        return '-';
    if (ondalik === undefined)
        ondalik = n >= 100 ? 0 : (n >= 1 ? 2 : 4);
    return n.toLocaleString('en-US', {minimumFractionDigits: ondalik, maximumFractionDigits: ondalik});
}
// Normalde renk yok (siyah-beyaz); sadece sorun varsa uyarı rengi
export function renkSicak(t) {
    t = parseInt(t);
    return isNaN(t) ? null : (t >= 85 ? KIRMIZI : (t >= 72 ? SARI : null));
}
export const renkYuzde = y => (y >= 90 ? KIRMIZI : (y >= 75 ? SARI : null));
export const renkli = (metin, renk) => (renk ? `<span foreground="${renk}">${metin}</span>` : metin);
export const soluk = m => `<span foreground="${SOLUK}">${m}</span>`;
export const degisim = d => ((d === null || d === undefined) ? '' : `${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)}%`);

const AYLAR = () => [_('Oca'), _('Şub'), _('Mar'), _('Nis'), _('May'), _('Haz'), _('Tem'), _('Ağu'), _('Eyl'), _('Eki'), _('Kas'), _('Ara')];
export const kisaTarih = t => {
    const p = (t || '').split('-');
    return p.length === 3 ? `${parseInt(p[2])} ${AYLAR()[parseInt(p[1]) - 1]}` : t;
};
export const bugun = () => GLib.DateTime.new_now_local().format('%Y-%m-%d');

export function geriSayim(ts) {
    const fark = ts - Math.floor(Date.now() / 1000);
    if (fark <= 0)
        return _('yayında');
    const g = Math.floor(fark / 86400), sa = Math.floor((fark % 86400) / 3600), dk = Math.floor((fark % 3600) / 60);
    return g > 0 ? f(_('%sg %ssa'), g, sa) : (sa > 0 ? f(_('%ssa %sdk'), sa, dk) : f(_('%sdk'), Math.max(dk, 1)));
}

// ---------- menü satırları (Island kartındaki sayfalar PopupMenuSection kullanır) ----------
export function bilgiSatiri(menu, metin, ikonAdi) {
    const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
    if (ikonAdi)
        item.add_child(stIkon(ikonAdi, 16, 'popup-menu-icon'));
    const l = new St.Label({y_align: Clutter.ActorAlign.CENTER, x_expand: true});
    l.clutter_text.line_wrap = true;
    l.clutter_text.set_markup(metin);
    item.add_child(l);
    item.label = l;
    menu.addMenuItem(item);
    return item;
}
export function menuOgesi(menu, ad, komut, ikonAdi) {
    const it = ikonAdi ? new PopupMenu.PopupImageMenuItem(ad, ikon(ikonAdi)) : new PopupMenu.PopupMenuItem(ad);
    it.connect('activate', () => (typeof komut === 'function' ? komut() : calistir(komut)));
    menu.addMenuItem(it);
    return it;
}
export function altMenu(menu, baslik, ikonAdi) {
    const alt = new PopupMenu.PopupSubMenuMenuItem(baslik, !!ikonAdi);
    if (ikonAdi)
        alt.icon.gicon = ikon(ikonAdi);
    menu.addMenuItem(alt);
    return alt;
}
export function baslik(menu, metin) {
    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(metin));
}
