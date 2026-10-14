// FLUGEL Island — "Hızlı" sekmesi: hızlı başlatma, zorla kapat (kurukafa), panik, ekran görüntüsü/kaydı,
// uyku engelleme ve karanlık tema. (FLUGEL v1 panelinin sol tarafı + araçlar)
import St from 'gi://St';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {H, bash, calistir, dugme, ekranGoruntusu, ikon, bilgiSatiri, menuOgesi, altMenu, soluk, baslik} from '../ortak.js';

export const ECLIPSE = `/snap/bin/eclipse -data ${H}/Documents/eclipse-workspace`;

function surecOldur(pid, ad) {
    if (!pid || pid <= 1)
        return;
    // önce kibarca (TERM), 2 sn sonra hâlâ açıksa alt süreçleriyle birlikte KILL
    bash(`kill -TERM ${pid} 2>/dev/null; pkill -TERM -P ${pid} 2>/dev/null; sleep 2; ` +
         `if kill -0 ${pid} 2>/dev/null; then pkill -KILL -P ${pid}; kill -KILL ${pid}; fi`);
    Main.notify('Zorla kapatılıyor', ad);
}

export class HizliSayfa extends Sayfa {
    constructor({panik}) {
        super();
        this._panik = panik;

        // hızlı başlatma satırı
        const satir = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'flugel-baslat-satiri'});
        const kutu = new St.BoxLayout({style_class: 'flugel-baslat', x_expand: true});
        const baslat = [
            ['eclipse', 'Eclipse', 'Eclipse — C/C++ geliştirme', () => calistir(ECLIPSE)],
            ['utilities-terminal-symbolic', 'Terminal', 'Terminal (kitty)', () => calistir('kitty')],
            ['web-browser-symbolic', 'Chrome', 'Google Chrome', () => calistir('google-chrome')],
            ['folder-symbolic', 'Dosyalar', 'Dosyalar', () => calistir('nautilus')],
            ['camera-photo-symbolic', 'Görüntü', 'Ekran görüntüsü al', ekranGoruntusu],
            ['camera-video-symbolic', 'Kayıt', 'Ekran kaydı (Kooha: MP4, GIF)', () => calistir('kooha')],
        ];
        for (const [ik, ad, ipucu, fn] of baslat) {
            kutu.add_child(dugme(ik, ipucu, () => {
                this.close();
                fn();
            }, {boyut: 22, stil: 'flugel-dugme flugel-baslat-dugme', etiket: ad}));
        }
        satir.add_child(kutu);
        this.addMenuItem(satir);

        baslik(this, 'Araçlar');
        this._zorla = altMenu(this, 'Zorla kapat — donan uygulamayı seç', 'kurukafa');
        this._zorla.menu.connect('open-state-changed', (_m, acik) => {
            if (acik)
                this._zorlaDoldur();
        });

        const p = altMenu(this, 'Panik', 'panik');
        menuOgesi(p.menu, 'Ekranı gizle: pencereleri küçült + sesi kapat + kilitle', () => panik.gizle(true), 'system-lock-screen-symbolic');
        menuOgesi(p.menu, 'Sadece pencereleri gizle + sesi kapat', () => panik.gizle(false), 'user-desktop-symbolic');
        this._geriAl = menuOgesi(p.menu, 'Paniği geri al: pencereleri ve sesi geri getir', () => panik.geriAl(), 'edit-undo-symbolic');
        menuOgesi(p.menu, 'Bilgisayar dondu: en çok bellek yiyen uygulamayı kapat', () => panik.enAgir(), 'utilities-system-monitor-symbolic');
        menuOgesi(p.menu, 'Tüm uygulamaları kapat (oturum açık kalır)', () => panik.hepsiniKapat(), 'process-stop-symbolic');
        menuOgesi(p.menu, 'Sesi aç / kapat', () => panik.sesAcKapa(), 'audio-volume-muted-symbolic');

        baslik(this, 'Ayarlar');
        this._oturum = new Gio.Settings({schema_id: 'org.gnome.desktop.session'});
        this._kafein = new PopupMenu.PopupSwitchMenuItem('Uyku modunu engelle', false);
        this._kafein.connect('toggled', (_i, acik) => this._oturum.set_uint('idle-delay', acik ? 0 : 300));
        this.addMenuItem(this._kafein);
    }

    goster() {
        this._kafein.setToggleState(this._oturum.get_uint('idle-delay') === 0);
        this._geriAl.visible = this._panik.aktif;
    }

    _zorlaDoldur() {
        const liste = this._zorla.menu;
        liste.removeAll();
        const tracker = Shell.WindowTracker.get_default();
        const gorulen = new Set();
        for (const actor of global.get_window_actors()) {
            const w = actor.meta_window;
            if (!w || w.is_skip_taskbar())
                continue;
            const app = tracker.get_window_app(w);
            let pid = w.get_pid();
            if ((!pid || pid <= 0) && app) {
                const pids = app.get_pids();
                pid = pids.length ? pids[0] : 0;
            }
            if (!pid || pid <= 0 || gorulen.has(pid))
                continue;
            gorulen.add(pid);
            const ad = app ? app.get_name() : (w.get_wm_class() || '?');
            const pbaslik = (w.get_title() || '').slice(0, 42);
            const it = new PopupMenu.PopupImageMenuItem(`${ad}  —  ${pbaslik}`, app?.get_icon() ?? ikon('application-x-executable-symbolic'));
            it.connect('activate', () => surecOldur(pid, ad));
            liste.addMenuItem(it);
        }
        if (gorulen.size === 0)
            bilgiSatiri(liste, soluk('Açık pencere yok'));
        liste.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(liste, 'Eclipse\'i zorla kapat', () => {
            bash("pkill -TERM -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'; sleep 2; pkill -KILL -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'");
            Main.notify('Zorla kapatılıyor', 'Eclipse');
        }, 'eclipse');
        menuOgesi(liste, 'Chrome\'u zorla kapat', () => {
            bash('pkill -TERM -x chrome; sleep 2; pkill -KILL -x chrome');
            Main.notify('Zorla kapatılıyor', 'Chrome');
        }, 'web-browser-symbolic');
        menuOgesi(liste, 'Tüm süreçler (Sistem İzleyici)', 'gnome-system-monitor -p', 'utilities-system-monitor-symbolic');
    }

    destroy() {
        this._oturum = null;
        super.destroy();
    }
}
