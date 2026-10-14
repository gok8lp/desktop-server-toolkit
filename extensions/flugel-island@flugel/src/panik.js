// FLUGEL Island — panik denetçisi (FLUGEL v1 panelinin panik düğmesinden).
// Yeni: "geri al" — panikle küçültülen pencereler geri gelir, ses eski haline döner. Panik açıkken
// Island'da "Panik modu" canlı etkinliği görünür.
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {bash, calistir} from './ortak.js';
import {_} from './dil.js';

export class PanikDenetci {
    constructor() {
        this.aktif = false;
        this._pencereler = new Map();
        this._dinleyiciler = new Set();
    }

    abone(fn) {
        this._dinleyiciler.add(fn);
        return () => this._dinleyiciler.delete(fn);
    }

    _bildir() {
        for (const fn of this._dinleyiciler)
            fn(this.aktif);
    }

    gizle(kilitle = true) {
        for (const a of global.get_window_actors()) {
            const w = a.meta_window;
            if (w && !w.is_skip_taskbar() && w.can_minimize() && !w.minimized) {
                w.minimize();
                if (!this._pencereler.has(w))
                    this._pencereler.set(w, w.connect('unmanaged', () => this._pencereler.delete(w)));
            }
        }
        bash('wpctl set-mute @DEFAULT_AUDIO_SINK@ 1');
        this.aktif = true;
        this._bildir();
        if (kilitle)
            calistir('loginctl lock-session');
    }

    geriAl() {
        for (const [w, id] of this._pencereler) {
            w.disconnect(id);
            w.unminimize();
        }
        this._pencereler.clear();
        bash('wpctl set-mute @DEFAULT_AUDIO_SINK@ 0');
        this.aktif = false;
        this._bildir();
    }

    enAgir() {
        // gnome-shell, Xwayland ve sistem servisleri hariç en çok RAM kullanan kullanıcı uygulaması
        bash(`p=$(ps -u "$USER" -o pid=,rss=,comm= --sort=-rss | awk '$3 !~ /^(gnome-shell|Xwayland|systemd|pipewire|wireplumber|gjs|claude|dbus)/ {print $1"|"$3; exit}'); ` +
             `pid=\${p%%|*}; ad=\${p#*|}; [ -n "$pid" ] && { kill -TERM $pid; sleep 2; kill -0 $pid 2>/dev/null && kill -KILL $pid; ` +
             `notify-send -a Panik "${_('Kapatıldı')}" "${_('En çok bellek kullanan')}: $ad"; }`);
    }

    hepsiniKapat() {
        const zaman = global.get_current_time();
        for (const a of global.get_window_actors()) {
            const w = a.meta_window;
            if (w && !w.is_skip_taskbar() && w.can_close())
                w.delete(zaman);
        }
        Main.notify(_('Panik'), _('Tüm uygulamalara kapanma isteği gönderildi'));
    }

    sesAcKapa() {
        bash('wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle');
    }

    destroy() {
        for (const [w, id] of this._pencereler)
            w.disconnect(id);
        this._pencereler.clear();
        this._dinleyiciler.clear();
    }
}
