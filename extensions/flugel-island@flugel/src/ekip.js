// FLUGEL Island — Re:Zero ekibi sürprizi (easter egg).
// Ekip sekmesi ve sürekli dönen/sallanan karakter kaldırıldı (kapsülü her karede yeniden çizdiriyordu).
// Onun yerine ara sıra (1,5–3,5 saatte bir, rastgele) bir chibi karakter adanın kenarından 3–4 sn görünüp
// kaybolur; kapsüle 2 sn içinde 5 kez tıklayınca da çıkar. Tam ekranda, ekran kaydında, panik modunda ya da
// "animasyonları azalt" açıkken asla çıkmaz. Ayar: ekip-surpriz.
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {dosya} from './ortak.js';

export const EKIP = ['emilia', 'subaru', 'beatrice', 'rem', 'ram', 'julius', 'anastasia', 'meili', 'shaula'];
const SURE = 3500;

export class EkipSurprizi {
    constructor(ayarlar, panik) {
        this._ayar = ayarlar;
        this._panik = panik;
        this._tiklar = [];
        this._planla();
    }

    baglan(kok) {
        this._kok = kok;
    }

    _planla() {
        const sn = Math.round(5400 + Math.random() * 7200);
        this._zamanId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, sn, () => {
            this.goster();
            this._planla();
            return GLib.SOURCE_REMOVE;
        });
    }

    tik() {
        const t = GLib.get_monotonic_time();
        this._tiklar = [...this._tiklar.filter(x => t - x < 2e6), t];
        if (this._tiklar.length >= 5) {
            this._tiklar = [];
            this.goster();
        }
    }

    _uygunMu() {
        return this._ayar.get_boolean('ekip-surpriz') && St.Settings.get().enable_animations &&
            !this._panik?.aktif && !Main.screenshotUI.screencast_in_progress &&
            !!this._kok?.visible && this._kok.mapped && !this._aktor;
    }

    goster() {
        if (!this._uygunMu())
            return;
        const kim = EKIP[Math.floor(Math.random() * EKIP.length)];
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const boyut = Math.round(34 * s);
        const aktor = new St.Icon({gicon: Gio.FileIcon.new(Gio.File.new_for_path(dosya(`ekip/${kim}-acik.svg`))),
            icon_size: 34, reactive: false, opacity: 0});
        this._aktor = aktor;
        Main.layoutManager.addTopChrome(aktor);
        const solda = Math.random() < 0.5;
        const x = solda ? this._kok.x - boyut - Math.round(6 * s) : this._kok.x + this._kok.width + Math.round(6 * s);
        aktor.set_position(Math.round(x), this._kok.y + Math.round(this._kok.height / 2));
        aktor.translation_y = -boyut / 2;
        aktor.ease({opacity: 255, translation_y: 0, duration: 450, mode: Clutter.AnimationMode.EASE_OUT_BACK,
            onComplete: () => {
                this._bekleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SURE, () => {
                    this._bekleId = 0;
                    aktor.ease({opacity: 0, translation_y: -boyut / 2, duration: 400, mode: Clutter.AnimationMode.EASE_IN_QUAD,
                        onStopped: () => this._kaldir()});
                    return GLib.SOURCE_REMOVE;
                });
            }});
    }

    _kaldir() {
        if (this._bekleId)
            GLib.source_remove(this._bekleId);
        this._bekleId = 0;
        this._aktor?.destroy();
        this._aktor = null;
    }

    destroy() {
        if (this._zamanId)
            GLib.source_remove(this._zamanId);
        this._zamanId = 0;
        this._aktor?.remove_all_transitions();
        this._kaldir();
        this._kok = null;
    }
}
