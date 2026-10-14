// FLUGEL Island — otomatik güncelleme ayarı (otomatik-guncelleme: kapali | gunluk | haftalik).
// Ayar değişince ~/.config/systemd/user/flugel-guncelle.timer yazılır ve etkinleştirilir/kapatılır.
// İşi ~/.local/bin/otomatik-guncelle yapar (apt/snap/flatpak; dağıtım ve sürücü ana sürümü değişmez).
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const ZAMANLAYICI = `${GLib.get_home_dir()}/.config/systemd/user/flugel-guncelle.timer`;
const TAKVIM = {gunluk: 'daily', haftalik: 'Mon *-*-* 12:30:00'};

function calistir(argv) {
    try {
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
    } catch (e) {
        console.error('FLUGEL Island: systemctl çalıştırılamadı', e);
    }
}

export class OtomatikGuncelleme {
    constructor(ayarlar) {
        this._ayar = ayarlar;
        this._id = ayarlar.connect('changed::otomatik-guncelleme', () => this._uygula());
        this._uygula(true);
    }

    _uygula(acilis = false) {
        const kip = this._ayar.get_string('otomatik-guncelleme');
        const takvim = TAKVIM[kip];
        let mevcut = '';
        try {
            mevcut = new TextDecoder().decode(GLib.file_get_contents(ZAMANLAYICI)[1]);
        } catch (e) {
            mevcut = '';
        }
        if (!takvim) {
            if (mevcut)
                calistir(['systemctl', '--user', 'disable', '--now', 'flugel-guncelle.timer']);
            return;
        }
        const icerik = `[Unit]\nDescription=FLUGEL otomatik güncelleme (${kip})\n\n[Timer]\nOnCalendar=${takvim}\n` +
            'Persistent=true\nRandomizedDelaySec=20min\n\n[Install]\nWantedBy=timers.target\n';
        // açılışta: zaten doğruysa hiçbir şey yapma (her oturum açılışında systemctl çağrılmasın)
        if (acilis && mevcut === icerik)
            return;
        GLib.mkdir_with_parents(GLib.path_get_dirname(ZAMANLAYICI), 0o755);
        GLib.file_set_contents(ZAMANLAYICI, icerik);
        calistir(['bash', '-c', 'systemctl --user daemon-reload && systemctl --user enable --now flugel-guncelle.timer']);
    }

    destroy() {
        this._ayar.disconnect(this._id);
    }
}
