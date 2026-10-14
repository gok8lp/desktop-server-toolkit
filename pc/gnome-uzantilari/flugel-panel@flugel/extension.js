// Flugel Panel — ust cubuk (sistem-bakim) · koyu tema, siyah-beyaz simgeler
//  sol  : Eclipse · Terminal · Chrome · Dosyalar · kafatasi (zorla kapat) · panik · BTC/ETH (anlik)
//  orta : sadece saat
//  sag  : basketbol · anime · PC + sunucu durumu · sanal makineler · ekran goruntusu · ekran kaydi · kisayollar · Re:Zero ekibi
// Veri: ~/.local/bin/ust-panel-veri (canli | kripto | pc | sunucu | basket | anime) -> JSON
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const H = GLib.get_home_dir();
const VERI = `${H}/.local/bin/ust-panel-veri`;
const SARI = '#E8C66B', KIRMIZI = '#F07B7B', SOLUK = '#9A9AA5';
let EXT = '';
let PILDE = false;   // pildeyken animasyon yok, yenilemeler seyrek

// ---------- yardimcilar ----------
const OZEL_IKONLAR = new Set(['anime', 'basket', 'manga', 'kurukafa', 'panik', 'eclipse',
    'coin-btc', 'coin-eth', 'coin-sol', 'coin-bnb', 'coin-xrp', 'coin-doge', 'coin-avax', 'coin-ada']);
function ikon(ad) {
    if (OZEL_IKONLAR.has(ad))
        return Gio.FileIcon.new(Gio.File.new_for_path(`${EXT}/ikon/${ad}-mono.svg`));
    return Gio.ThemedIcon.new(ad);
}
function stIkon(ad, boyut = 16) {
    return new St.Icon({gicon: ikon(ad), icon_size: boyut, style_class: 'system-status-icon', y_align: Clutter.ActorAlign.CENTER});
}

function veriAl(tur, geriCagri) {
    try {
        const p = Gio.Subprocess.new([VERI, tur], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        p.communicate_utf8_async(null, null, (proc, res) => {
            try {
                const [, out] = proc.communicate_utf8_finish(res);
                geriCagri(JSON.parse(out));
            } catch (e) {
                geriCagri({hata: String(e).slice(0, 60)});
            }
        });
    } catch (e) {
        geriCagri({hata: String(e).slice(0, 60)});
    }
}

function ekranGoruntusu() {
    try {
        Main.screenshotUI.open().catch(() => {});
    } catch (e) {
        Main.notify('Ekran goruntusu', 'Acilamadi');
    }
}

function calistir(komut) {
    if (komut === '__ekran__')
        return ekranGoruntusu();
    try {
        GLib.spawn_command_line_async(komut);
    } catch (e) {
        Main.notify('Flugel Panel', `Calistirilamadi: ${komut}`);
    }
}
function bash(betik) {
    try {
        Gio.Subprocess.new(['bash', '-c', betik], Gio.SubprocessFlags.NONE);
    } catch (e) {
        Main.notify('Flugel Panel', String(e));
    }
}

const kac = t => GLib.markup_escape_text(String(t ?? ''), -1);
function para(n, ondalik) {
    if (n === null || n === undefined)
        return '-';
    if (ondalik === undefined)
        ondalik = n >= 100 ? 0 : (n >= 1 ? 2 : 4);
    return n.toLocaleString('en-US', {minimumFractionDigits: ondalik, maximumFractionDigits: ondalik});
}
// Normalde renk yok (siyah-beyaz); sadece sorun varsa uyari rengi
function renkSicak(t) {
    t = parseInt(t);
    return isNaN(t) ? null : (t >= 85 ? KIRMIZI : (t >= 72 ? SARI : null));
}
function renkYuzde(y) {
    return y >= 90 ? KIRMIZI : (y >= 75 ? SARI : null);
}
function renkli(metin, renk) {
    return renk ? `<span foreground="${renk}">${metin}</span>` : metin;
}
const soluk = m => `<span foreground="${SOLUK}">${m}</span>`;
const degisim = d => (d === null || d === undefined) ? '' : `${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)}%`;

function bilgiSatiri(menu, metin, ikonAdi) {
    const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
    if (ikonAdi)
        item.add_child(stIkon(ikonAdi, 16));
    const l = new St.Label({y_align: Clutter.ActorAlign.CENTER});
    l.clutter_text.set_markup(metin);
    item.add_child(l);
    item.label = l;
    menu.addMenuItem(item);
    return item;
}
function menuOgesi(menu, ad, komut, ikonAdi) {
    const it = ikonAdi ? new PopupMenu.PopupImageMenuItem(ad, ikon(ikonAdi)) : new PopupMenu.PopupMenuItem(ad);
    it.connect('activate', () => (typeof komut === 'function' ? komut() : calistir(komut)));
    menu.addMenuItem(it);
    return it;
}
function altMenu(menu, baslik, ikonAdi) {
    const alt = new PopupMenu.PopupSubMenuMenuItem(baslik, !!ikonAdi);
    if (ikonAdi)
        alt.icon.gicon = ikon(ikonAdi);
    menu.addMenuItem(alt);
    return alt;
}


// ---------- uygulama sag tik menusu: "Masaustune ekle" ----------
function masaustuneEkle(app) {
    const kaynak = app?.app_info?.get_filename?.();
    if (!kaynak)
        return;
    const masaustu = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) || `${H}/Desktop`;
    GLib.mkdir_with_parents(masaustu, 0o755);
    const hedef = Gio.File.new_for_path(`${masaustu}/${GLib.path_get_basename(kaynak)}`);
    try {
        Gio.File.new_for_path(kaynak).copy(hedef, Gio.FileCopyFlags.OVERWRITE, null, null);
        hedef.set_attribute_uint32('unix::mode', 0o755, Gio.FileQueryInfoFlags.NONE, null);
        // DING (masaustu simgeleri) icin "calistirmaya izin ver" isareti
        hedef.set_attribute_string('metadata::trusted', 'true', Gio.FileQueryInfoFlags.NONE, null);
        Main.notify('Masaustune eklendi', app.get_name());
    } catch (e) {
        Main.notify('Masaustune eklenemedi', String(e).slice(0, 80));
    }
}

// ---------- uzerine gelince aciklama (Windows'taki gibi ipucu) ----------
function ipucuEkle(aktor, metin) {
    let etiket = null, zaman = 0;
    const gizle = () => {
        if (zaman)
            GLib.source_remove(zaman);
        zaman = 0;
        etiket?.destroy();
        etiket = null;
    };
    aktor.connect('notify::hover', () => {
        if (!aktor.hover)
            return gizle();
        if (zaman || etiket)
            return;
        zaman = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
            zaman = 0;
            const yazi = typeof metin === 'function' ? metin() : metin;
            if (!aktor.hover || aktor.menu?.isOpen || !yazi)
                return GLib.SOURCE_REMOVE;
            etiket = new St.Label({text: yazi, style: 'background-color: rgba(18,18,22,0.96); color: #eeeef2; ' +
                'border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; padding: 5px 10px; font-size: 9.5pt;'});
            Main.layoutManager.uiGroup.add_child(etiket);
            const [x, y] = aktor.get_transformed_position();
            const [w, h] = aktor.get_transformed_size();
            const m = Main.layoutManager.findMonitorForActor(aktor) ?? Main.layoutManager.primaryMonitor;
            const lx = Math.max(m.x + 4, Math.min(Math.round(x + w / 2 - etiket.width / 2), m.x + m.width - etiket.width - 4));
            etiket.set_position(lx, Math.round(y + h + 6));
            etiket.opacity = 0;
            etiket.ease({opacity: 255, duration: 140, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            return GLib.SOURCE_REMOVE;
        });
    });
    aktor.connect('button-press-event', () => {
        gizle();
        return Clutter.EVENT_PROPAGATE;
    });
    aktor.connect('destroy', gizle);
}

// ---------- arka plan uygulamalari tepsisi (Windows'taki "^" gibi) ----------
// AppIndicator simgeleri (Telegram, Steam, guncelleme vb.) bir okun arkasinda toplanir; tikla -> acilir.
const tepsiAnahtari = c => Object.keys(Main.panel.statusArea).find(k =>
    k.startsWith('appindicator-') && Main.panel.statusArea[k]?.container === c);
const tepsiAdi = c => {
    const i = c.get_first_child();
    return i?._indicator?.title || i?._indicator?.id || i?.accessible_name || 'Uygulama';
};
const TepsiDugmesi = GObject.registerClass(
class TepsiDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Arka plan uygulamalari', true);
        this._ok = new St.Icon({icon_name: 'pan-start-symbolic', style_class: 'system-status-icon'});
        this.add_child(this._ok);
        this.kutu = new St.BoxLayout({visible: false, y_align: Clutter.ActorAlign.CENTER});
        this.connect('button-press-event', () => {
            this.ac(!this.kutu.visible);
            return Clutter.EVENT_STOP;
        });
    }

    ac(acik) {
        if (this._kapaId)
            GLib.source_remove(this._kapaId);
        this._kapaId = 0;
        this._ok.icon_name = acik ? 'pan-end-symbolic' : 'pan-start-symbolic';
        if (!acik) {
            this.kutu.ease({opacity: 0, duration: 150, onComplete: () => (this.kutu.visible = false)});
            return;
        }
        this.kutu.opacity = 0;
        this.kutu.visible = true;
        this.kutu.ease({opacity: 255, duration: 180, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        // 25 sn sonra kendiliginden kapanir (simgelerden birinin menusu aciksa bekler)
        this._kapaId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 25, () => {
            const menuAcik = this.kutu.get_children().some(c => c.get_first_child()?.menu?.isOpen);
            if (menuAcik)
                return GLib.SOURCE_CONTINUE;
            this._kapaId = 0;
            this.ac(false);
            return GLib.SOURCE_REMOVE;
        });
    }

    sayi() {
        return this.kutu.get_n_children();
    }

    destroy() {
        if (this._kapaId)
            GLib.source_remove(this._kapaId);
        this._kapaId = 0;
        super.destroy();
    }
});

// ---------- tek tik dugme ----------
const IkonDugme = GObject.registerClass(
class IkonDugme extends PanelMenu.Button {
    _init(ikonAdi, isim, eylem) {
        super._init(0.5, isim, true);
        this.add_child(stIkon(ikonAdi));
        this._eylem = eylem;
    }

    vfunc_event(event) {
        const t = event.type();
        if (t === Clutter.EventType.BUTTON_RELEASE || t === Clutter.EventType.TOUCH_END) {
            this._eylem();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
});

// ---------- kafatasi: zorla kapat ----------
function surecOldur(pid, ad) {
    if (!pid || pid <= 1)
        return;
    // once kibarca (TERM), 2 sn sonra hala aciksa alt surecleriyle birlikte KILL
    bash(`kill -TERM ${pid} 2>/dev/null; pkill -TERM -P ${pid} 2>/dev/null; sleep 2; ` +
         `if kill -0 ${pid} 2>/dev/null; then pkill -KILL -P ${pid}; kill -KILL ${pid}; fi`);
    Main.notify('Zorla kapatiliyor', ad);
}

const ZorlaKapatDugmesi = GObject.registerClass(
class ZorlaKapatDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Zorla kapat');
        this.add_child(stIkon('kurukafa'));
        this._liste = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._liste);
        this.menu.connect('open-state-changed', (_m, acik) => {
            if (acik)
                this._doldur();
        });
    }

    _doldur() {
        this._liste.removeAll();
        bilgiSatiri(this._liste, '<b>Donan uygulamaya tikla — kapatilir</b>', 'process-stop-symbolic');
        const tracker = Shell.WindowTracker.get_default();
        const gorulen = new Map();
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
            gorulen.set(pid, true);
            const ad = app ? app.get_name() : (w.get_wm_class() || '?');
            const baslik = (w.get_title() || '').slice(0, 42);
            const it = new PopupMenu.PopupImageMenuItem(`${ad}  —  ${baslik}`, app?.get_icon() ?? ikon('application-x-executable-symbolic'));
            it.connect('activate', () => surecOldur(pid, ad));
            this._liste.addMenuItem(it);
        }
        if (gorulen.size === 0)
            bilgiSatiri(this._liste, soluk('Acik pencere yok'));
        this._liste.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this._liste, 'Eclipse\'i zorla kapat', () => {
            bash("pkill -TERM -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'; sleep 2; pkill -KILL -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'");
            Main.notify('Zorla kapatiliyor', 'Eclipse');
        }, 'eclipse');
        menuOgesi(this._liste, 'Chrome\'u zorla kapat', () => {
            bash('pkill -TERM -x chrome; sleep 2; pkill -KILL -x chrome');
            Main.notify('Zorla kapatiliyor', 'Chrome');
        }, 'web-browser-symbolic');
        menuOgesi(this._liste, 'Tum surecler (Sistem Izleyici)', 'gnome-system-monitor -p', 'utilities-system-monitor-symbolic');
    }
});

// ---------- panik ----------
const PanikDugmesi = GObject.registerClass(
class PanikDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Panik');
        this.add_child(stIkon('panik'));
        bilgiSatiri(this.menu, '<b>Panik dugmesi</b>', 'dialog-warning-symbolic');
        menuOgesi(this.menu, 'Ekrani gizle: pencereleri kucult + sesi kapat + kilitle', () => this._gizle(), 'system-lock-screen-symbolic');
        menuOgesi(this.menu, 'Sadece pencereleri gizle + sesi kapat', () => this._gizle(false), 'user-desktop-symbolic');
        menuOgesi(this.menu, 'Bilgisayar dondu: en cok bellek yiyen uygulamayi kapat', () => this._enAgir(), 'utilities-system-monitor-symbolic');
        menuOgesi(this.menu, 'Tum uygulamalari kapat (oturum acik kalir)', () => this._hepsiniKapat(), 'process-stop-symbolic');
        menuOgesi(this.menu, 'Sesi ac / kapat', () => bash('wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle'), 'audio-volume-muted-symbolic');
    }

    _gizle(kilitle = true) {
        for (const a of global.get_window_actors()) {
            const w = a.meta_window;
            if (w && !w.is_skip_taskbar() && w.can_minimize())
                w.minimize();
        }
        bash('wpctl set-mute @DEFAULT_AUDIO_SINK@ 1');
        if (kilitle)
            calistir('loginctl lock-session');
    }

    _enAgir() {
        // gnome-shell, Xwayland ve sistem servisleri haric en cok RAM kullanan kullanici uygulamasi
        bash(`p=$(ps -u "$USER" -o pid=,rss=,comm= --sort=-rss | awk '$3 !~ /^(gnome-shell|Xwayland|systemd|pipewire|wireplumber|gjs|claude|dbus)/ {print $1"|"$3; exit}'); ` +
             `pid=\${p%%|*}; ad=\${p#*|}; [ -n "$pid" ] && { kill -TERM $pid; sleep 2; kill -0 $pid 2>/dev/null && kill -KILL $pid; ` +
             `notify-send -a Panik "Kapatildi" "En cok bellek kullanan: $ad"; }`);
    }

    _hepsiniKapat() {
        const zaman = global.get_current_time();
        for (const a of global.get_window_actors()) {
            const w = a.meta_window;
            if (w && !w.is_skip_taskbar() && w.can_close())
                w.delete(zaman);
        }
        Main.notify('Panik', 'Tum uygulamalara kapanma istegi gonderildi');
    }
});

// ---------- kripto (anlik) ----------
const KOIN_IKON = {BTC: 'coin-btc', ETH: 'coin-eth', SOL: 'coin-sol', BNB: 'coin-bnb', XRP: 'coin-xrp', DOGE: 'coin-doge', AVAX: 'coin-avax', ADA: 'coin-ada'};
const KriptoDugmesi = GObject.registerClass(
class KriptoDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Kripto');
        const kutu = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER, style: 'spacing: 4px;'});
        kutu.add_child(stIkon('coin-btc', 15));
        this._btc = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._btc);
        kutu.add_child(new St.Label({text: ' ', y_align: Clutter.ActorAlign.CENTER}));
        kutu.add_child(stIkon('coin-eth', 15));
        this._eth = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._eth);
        this.add_child(kutu);
        this._kur = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._kur);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Kripto paralar'));
        this._liste = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._liste);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this.menu, 'Simdi yenile', () => this.guncelle(true), 'view-refresh-symbolic');
        menuOgesi(this.menu, 'CoinMarketCap', 'xdg-open https://coinmarketcap.com', 'send-to-symbolic');
        menuOgesi(this.menu, 'TradingView BTC grafigi', 'xdg-open https://www.tradingview.com/chart/?symbol=BTCUSDT', 'send-to-symbolic');
        this.menu.connect('open-state-changed', (_m, acik) => {
            if (acik)
                this._listeYenile();
        });
        this.guncelle();
    }

    guncelle(zorla) {
        if (zorla) {
            GLib.unlink(`${H}/.cache/sistem-bakim/canli.json`);
            GLib.unlink(`${H}/.cache/sistem-bakim/kripto.json`);
        }
        veriAl('canli', d => {
            this._canli = d;
            if (d.hata || !d.btc) {
                this._btc.text = '—';
                this._eth.text = '—';
                return;
            }
            this._btc.clutter_text.set_markup(`${para(d.btc.fiyat, 0)} ${soluk(degisim(d.btc.degisim))}`);
            this._eth.clutter_text.set_markup(d.eth ? `${para(d.eth.fiyat, 0)} ${soluk(degisim(d.eth.degisim))}` : '—');
            this._kurYaz();
        });
        if (zorla)
            this._listeYenile();
    }

    _kurYaz() {
        const d = this._canli || {};
        this._kur.removeAll();
        bilgiSatiri(this._kur, d.usdtry ? `<b>1 $ = ${d.usdtry.fiyat.toFixed(2)} ₺</b>  ${soluk(degisim(d.usdtry.degisim))}` : '1 $ = …');
        bilgiSatiri(this._kur, d.eurtry ? `<b>1 € = ${d.eurtry.fiyat.toFixed(2)} ₺</b>  ${soluk(degisim(d.eurtry.degisim))}` : '1 € = …');
        bilgiSatiri(this._kur, `<small>${soluk('anlik · ' + (d.zaman || ''))}</small>`);
    }

    _listeYenile() {
        this._kurYaz();
        veriAl('kripto', d => {
            this._liste.removeAll();
            if (!d.coinler || !d.coinler.length) {
                bilgiSatiri(this._liste, soluk('Fiyatlar alinamadi'));
                return;
            }
            for (const c of d.coinler) {
                bilgiSatiri(this._liste,
                    `<b>${c.sym}</b>  <tt>${para(c.usd).padStart(10)} $  ${para(c.try, c.try >= 100 ? 0 : 2).padStart(12)} ₺</tt>  ${soluk(degisim(c.degisim))}`,
                    KOIN_IKON[c.sym]);
            }
            bilgiSatiri(this._liste, `<small>${soluk('Kaynak: ' + (d.kaynak || '?') + ' · ' + (d.zaman || '') + (d.eski ? ' · eski veri' : ''))}</small>`);
        });
    }
});

// ---------- PC + sunucu durumu ----------
const SistemDugmesi = GObject.registerClass(
class SistemDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Sistem');
        const kutu = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER, style: 'spacing: 4px;'});
        kutu.add_child(stIkon('computer-symbolic', 15));
        this._pcL = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._pcL);
        kutu.add_child(new St.Label({text: ' ', y_align: Clutter.ActorAlign.CENTER}));
        this._svIkon = stIkon('network-server-symbolic', 15);
        kutu.add_child(this._svIkon);
        this._svL = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._svL);
        this.add_child(kutu);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Bu bilgisayar'));
        this._pc = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._pc);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Sunucu (flugelserver)'));
        this._sunucu = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._sunucu);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this.menu, 'Sunucu paneli', 'xdg-open http://192.168.0.15:3010', 'view-app-grid-symbolic');
        menuOgesi(this.menu, 'Sunucu durumu + yapay zeka analizi', `${H}/.local/bin/sunucu-durum-ac`, 'network-server-symbolic');
        menuOgesi(this.menu, 'Netdata (canli grafikler)', `${H}/.local/bin/sunucu-ac http 19999 /`, 'utilities-system-monitor-symbolic');
        menuOgesi(this.menu, 'Bu PC: Sistem Izleyici', 'gnome-system-monitor', 'computer-symbolic');
        menuOgesi(this.menu, 'Sunucuya terminalle baglan', 'kitty ssh flugelserver', 'utilities-terminal-symbolic');
        menuOgesi(this.menu, 'Yenile', () => this.guncelle(true), 'view-refresh-symbolic');
        this.guncelle();
    }

    _etiketYaz() {
        const p = this._p, s = this._s;
        if (p && !p.hata) {
            let m = `${renkli(p.cpu + '%', renkYuzde(p.cpu))} ${renkli((p.temp || '?') + '°', renkSicak(p.temp))}`;
            if (p.pil_durum === 'pilde' && parseInt(p.pil) <= 20)
                m += ` ${renkli('%' + p.pil, KIRMIZI)}`;
            this._pcL.clutter_text.set_markup(m);
        }
        if (s && !s.hata) {
            const sorun = s.durum !== 'IYI' ? ` ${renkli('●', KIRMIZI)}` : '';
            this._svL.clutter_text.set_markup(`${renkli(s.cpu + '%', renkYuzde(s.cpu))} ${renkli((s.temp || '?') + '°', renkSicak(s.temp))}${sorun}`);
            this._svIkon.opacity = 255;
        } else if (s) {
            this._svL.clutter_text.set_markup(soluk('cevrimdisi'));
            this._svIkon.opacity = 110;
        }
    }

    guncelle(zorla) {
        veriAl('pc', p => {
            this._p = p;
            this._pc.removeAll();
            if (p.hata) {
                bilgiSatiri(this._pc, `Okunamadi: ${kac(p.hata)}`);
            } else {
                bilgiSatiri(this._pc, `CPU <b>${renkli(p.cpu + '%', renkYuzde(p.cpu))}</b>   Sicaklik <b>${renkli((p.temp || '?') + '°C', renkSicak(p.temp))}</b>   GPU <b>${renkli((p.gpu || '?') + '°C', renkSicak(p.gpu))}</b>`, 'computer-symbolic');
                bilgiSatiri(this._pc, `RAM <b>${p.ram_kul} / ${p.ram_top} GB</b>   Disk <b>${p.disk}</b> dolu`, 'drive-harddisk-symbolic');
                const kalan = (p.pil_kalan || '').replace('hours', 'saat').replace('hour', 'saat').replace('minutes', 'dk');
                bilgiSatiri(this._pc, `Pil <b>%${p.pil}</b>  ${p.pil_durum}${kalan ? ' · ' + kalan : ''}`, 'battery-full-symbolic');
                bilgiSatiri(this._pc, `${kac(p.wifi || 'ag yok')}   Tailscale: ${p.tailscale === 'Running' ? 'acik' : renkli(p.tailscale || 'kapali', SARI)}   Acik: ${p.uptime}`, 'network-wireless-symbolic');
            }
            this._etiketYaz();
        });
        if (zorla)
            GLib.unlink(`${H}/.cache/sistem-bakim/sunucu.json`);
        veriAl('sunucu', s => {
            this._s = s;
            this._sunucu.removeAll();
            if (s.hata) {
                bilgiSatiri(this._sunucu, renkli('Sunucuya ulasilamiyor', SARI), 'network-server-symbolic');
                bilgiSatiri(this._sunucu, soluk('<small>Evin disindaysan Tailscale acik olmali. Elektrik kesintisi olabilir.</small>'));
            } else {
                const d = s.disk || {};
                const dk = (ad, y) => `${ad} ${renkli((y ?? '?') + '%', renkYuzde(y ?? 0))}`;
                bilgiSatiri(this._sunucu, `Durum <b>${s.durum === 'IYI' ? 'IYI' : renkli(s.durum, KIRMIZI)}</b>${s.sorunlar ? ' — ' + kac(s.sorunlar) : ''}${s.eski ? soluk(' (eski veri)') : ''}`, 'network-server-symbolic');
                bilgiSatiri(this._sunucu, `CPU <b>${renkli(s.cpu + '%', renkYuzde(s.cpu))}</b>   Sicaklik <b>${renkli((s.temp || '?') + '°C', renkSicak(s.temp))}</b>   Yuk ${s.yuk}`, 'utilities-system-monitor-symbolic');
                bilgiSatiri(this._sunucu, `RAM <b>${s.ram_kul} / ${s.ram_top} GB</b>   Swap ${s.swap} GB   GPU ${renkli((s.gpu_temp || '?') + '°C', renkSicak(s.gpu_temp))} ${s.gpu_w} W`, 'emblem-system-symbolic');
                bilgiSatiri(this._sunucu, `Disk: ${dk('SSD', d['/'])}   ${dk('Indirme', d['/mnt/side'])}   ${dk('Foto/Medya', d['/mnt/sidemain'])}`, 'drive-harddisk-symbolic');
                bilgiSatiri(this._sunucu, `Konteyner <b>${s.konteyner}</b>   VPN ${s.vpn === 'healthy' ? 'aktif' : renkli(s.vpn || '?', KIRMIZI)}   Sanal makine: ${s.vm}`, 'view-app-grid-symbolic');
                bilgiSatiri(this._sunucu, soluk(`<small>Son yedek: ${s.yedek} · Acik: ${s.uptime}</small>`));
            }
            this._etiketYaz();
        });
    }
});

// ---------- basketbol ----------
const AYLAR = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const kisaTarih = t => {
    const p = (t || '').split('-');
    return p.length === 3 ? `${parseInt(p[2])} ${AYLAR[parseInt(p[1]) - 1]}` : t;
};
const BasketDugmesi = GObject.registerClass(
class BasketDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Basketbol');
        const kutu = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER, style: 'spacing: 4px;'});
        kutu.add_child(stIkon('basket', 15));
        this._etiket = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._etiket);
        this.add_child(kutu);
        this._bolum = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._bolum);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this.menu, 'Simdi kontrol et', () => {
            calistir('ssh -o BatchMode=yes flugelserver python3 /opt/basket-bot/basket_bot.py');
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 40, () => {
                this.guncelle(true);
                return GLib.SOURCE_REMOVE;
            });
        }, 'view-refresh-symbolic');
        menuOgesi(this.menu, 'Fikstur sayfasi', 'xdg-open https://www.ankarabasket.org.tr/fiksturler', 'send-to-symbolic');
        this.guncelle();
    }

    guncelle(zorla) {
        if (zorla)
            GLib.unlink(`${H}/.cache/sistem-bakim/basket.json`);
        veriAl('basket', d => {
            this._bolum.removeAll();
            if (d.hata) {
                this._etiket.text = '—';
                bilgiSatiri(this._bolum, renkli('Veri alinamadi', SARI));
                return;
            }
            const g = d.gelecek || [];
            const bugun = GLib.DateTime.new_now_local().format('%Y-%m-%d');
            if (g.length) {
                const m = g[0];
                const yazi = m.tarih === bugun ? `BUGÜN ${m.saat}` : `${g.length}`;
                this._etiket.clutter_text.set_markup(m.tarih === bugun ? renkli(yazi, SARI) : yazi);
                bilgiSatiri(this._bolum, `<b>Yaklasan maclarin (${g.length})</b>`, 'basket');
                for (const x of g)
                    bilgiSatiri(this._bolum, `<b>${kisaTarih(x.tarih)} ${x.saat}</b>  ${kac(x.ev)} — ${kac(x.dep)}\n<small>${soluk(kac(x.salon) + ' · ' + kac(x.gorev) + (x.lig ? ' · ' + kac(x.lig) : ''))}</small>`);
            } else {
                this._etiket.text = '0';
                bilgiSatiri(this._bolum, 'Su an atanmis macin yok', 'basket');
            }
            bilgiSatiri(this._bolum, `<small>${soluk('Takip: ' + kac((d.isimler || []).join(', ')) + ' · ' + d.taranan + ' bulten · son kontrol ' + (d.guncelleme || '?') + (d.yedek ? ' · PC yedek verisi' : ''))}</small>`);
        });
    }
});

// ---------- sunucudaki sanal makineler (W11-GPU Moonlight ile, digerleri konsol) ----------
const VM_DURUM = {'running': ['●', 'Acik'], 'shut off': ['○', 'Kapali'], 'paused': ['◐', 'Duraklatildi'],
    'in shutdown': ['◐', 'Kapaniyor…']};
const SanalMakineDugmesi = GObject.registerClass(
class SanalMakineDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Sanal makineler');
        const kutu = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER, style: 'spacing: 3px;'});
        kutu.add_child(stIkon('computer-symbolic', 15));
        this._etiket = new St.Label({text: '○', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._etiket);
        this.add_child(kutu);
        bilgiSatiri(this.menu, '<b>Sunucudaki sanal makineler</b>', 'computer-symbolic');
        this._bolum = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._bolum);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this.menu, 'Moonlight', 'flatpak run com.moonlight_stream.Moonlight', 'video-display-symbolic');
        menuOgesi(this.menu, 'Sanal makine yoneticisi', 'virt-manager --connect qemu+ssh://flugelserver/system', 'preferences-system-symbolic');
        bilgiSatiri(this.menu, `<small>${soluk('Windows (GPU) acikken Jellyfin/Plex/Immich ML durur · W11 ikisi ayni disk')}</small>`);
        this.menu.connect('open-state-changed', (_m, acik) => {
            if (acik)
                this.guncelle();
        });
        this.guncelle();
    }

    _komut(...arg) {
        bash(`${H}/.local/bin/vm ${arg.join(' ')}`);
        this._sik();
    }

    // islem sonrasi 8 sn'de bir, 2 dk boyunca yenile
    _sik() {
        if (this._sikId)
            GLib.source_remove(this._sikId);
        let n = 0;
        this._sikId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, 8, () => {
            this.guncelle();
            if (++n < 15)
                return GLib.SOURCE_CONTINUE;
            this._sikId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    guncelle() {
        try {
            const p = Gio.Subprocess.new([`${H}/.local/bin/vm`, 'liste'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            p.communicate_utf8_async(null, null, (proc, res) => {
                let liste = null;
                try {
                    liste = JSON.parse(proc.communicate_utf8_finish(res)[1]);
                } catch (e) {
                    liste = null; // komut çıktısı okunamadı: liste boş gösterilir
                }
                this._yaz(liste);
            });
        } catch (e) {
            this._yaz(null);
        }
    }

    _yaz(liste) {
        this._bolum.removeAll();
        if (!liste) {
            this._etiket.text = '?';
            bilgiSatiri(this._bolum, renkli('Sunucuya ulasilamadi', SARI));
            return;
        }
        const acik = liste.filter(v => v.durum === 'running').length;
        this._etiket.text = acik ? `${acik}` : '○';
        for (const v of liste) {
            const [n, y] = VM_DURUM[v.durum] || ['?', v.durum];
            const alt = altMenu(this._bolum, `${n}  ${v.etiket}  ·  ${y}`);
            if (v.durum === 'running') {
                menuOgesi(alt.menu, 'Baglan', () => this._komut('baglan', v.ad), 'video-display-symbolic');
                menuOgesi(alt.menu, 'Kapat', () => this._komut('kapat', v.ad), 'system-shutdown-symbolic');
            } else {
                menuOgesi(alt.menu, 'Ac ve baglan', () => this._komut('baslat', v.ad), 'media-playback-start-symbolic');
            }
        }
    }

    destroy() {
        if (this._sikId)
            GLib.source_remove(this._sikId);
        this._sikId = 0;
        super.destroy();
    }
});

// ---------- anime / manga ----------
function geriSayim(ts) {
    const fark = ts - Math.floor(Date.now() / 1000);
    if (fark <= 0)
        return 'yayinlandi';
    const g = Math.floor(fark / 86400), sa = Math.floor((fark % 86400) / 3600), dk = Math.floor((fark % 3600) / 60);
    return g > 0 ? `${g}g ${sa}sa` : (sa > 0 ? `${sa}sa ${dk}dk` : `${dk}dk`);
}
const puan = (mal, al) => [mal ? `MAL <b>${mal}</b>` : '', al ? `AL ${al}` : ''].filter(Boolean).join(' · ');

const AnimeDugmesi = GObject.registerClass(
class AnimeDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Anime');
        const kutu = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER, style: 'spacing: 4px;'});
        kutu.add_child(stIkon('anime', 15));
        this._etiket = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        kutu.add_child(this._etiket);
        this.add_child(kutu);
        this._bolum = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._bolum);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this.menu, 'MyAnimeList profilim', 'xdg-open https://myanimelist.net/profile/gokalpgoksu', 'avatar-default-symbolic');
        menuOgesi(this.menu, 'Bu sezonun yayin takvimi', 'xdg-open https://anilist.co/airing', 'x-office-calendar-symbolic');
        menuOgesi(this.menu, 'Yenile', () => this.guncelle(true), 'view-refresh-symbolic');
        this.menu.connect('open-state-changed', (_m, acik) => {
            if (acik)
                this._ciz();
        });
        this.guncelle();
    }

    guncelle(zorla) {
        if (zorla)
            GLib.unlink(`${H}/.cache/sistem-bakim/anime.json`);
        veriAl('anime', d => {
            this._veri = d;
            this.etiketYaz();
        });
    }

    _yaklasan() {
        const d = this._veri;
        const simdi = Math.floor(Date.now() / 1000);
        return (d?.anime || []).filter(a => a.yayin && a.yayin > simdi).sort((x, y) => x.yayin - y.yayin);
    }

    etiketYaz() {
        if (!this._veri || this._veri.hata) {
            this._etiket.text = '—';
            return;
        }
        const y = this._yaklasan();
        const ilk = y.find(a => a.liste !== 'Planliyorum') || y[0];
        if (!ilk) {
            this._etiket.text = '';
            return;
        }
        this._etiket.text = geriSayim(ilk.yayin);
    }

    _ciz() {
        this._bolum.removeAll();
        const d = this._veri;
        if (!d || d.hata) {
            bilgiSatiri(this._bolum, renkli('Anime verisi alinamadi', SARI));
            return;
        }
        const y = this._yaklasan();
        const alt1 = altMenu(this._bolum, `Yaklasan bolumler (${y.length})`, 'anime');
        for (const a of y.slice(0, 15)) {
            const tarih = GLib.DateTime.new_from_unix_local(a.yayin).format('%d.%m %H:%M');
            const etiket = a.liste === 'Izliyorum' ? '● izliyorum' : (a.liste === 'Beklemede' ? '● beklemede' : '○ plan');
            const it = new PopupMenu.PopupMenuItem('');
            it.label.clutter_text.set_markup(`<b>${kac(a.ad)}</b> — ${a.sonraki_bolum}. bolum  ${soluk(etiket)}\n<small>${soluk(tarih + '  (' + geriSayim(a.yayin) + ' sonra)   ')}${puan(a.mal_puan, a.al_puan)}</small>`);
            it.connect('activate', () => calistir(`xdg-open ${a.url}`));
            alt1.menu.addMenuItem(it);
        }
        alt1.setSubmenuShown(true);
        const izle = (d.anime || []).filter(a => a.liste === 'Izliyorum');
        if (izle.length) {
            const alt2 = altMenu(this._bolum, `Izlediklerim (${izle.length})`, 'media-playback-start-symbolic');
            for (const a of izle) {
                const it = new PopupMenu.PopupMenuItem('');
                it.label.clutter_text.set_markup(`<b>${kac(a.ad)}</b>  ${a.izlenen}/${a.toplam || '?'} bolum · ${a.durum}\n<small>${puan(a.mal_puan, a.al_puan)}${a.benim_puan ? soluk(' · benim: ' + a.benim_puan) : ''}</small>`);
                it.connect('activate', () => calistir(`xdg-open ${a.url}`));
                alt2.menu.addMenuItem(it);
            }
        }
        const manga = [...(d.manga || [])].sort((x, y2) => (x.liste === 'Okuyorum' ? -1 : 1) - (y2.liste === 'Okuyorum' ? -1 : 1));
        const alt3 = altMenu(this._bolum, `Mangalarim (${manga.length})`, 'manga');
        for (const m of manga) {
            const it = new PopupMenu.PopupMenuItem('');
            it.label.clutter_text.set_markup(`<b>${kac(m.ad)}</b>  bolum ${m.okunan}${m.toplam ? '/' + m.toplam : ''} · ${m.durum} ${m.liste === 'Okuyorum' ? '● okuyorum' : ''}\n<small>${puan(m.mal_puan, m.al_puan)}</small>`);
            it.connect('activate', () => calistir(`xdg-open ${m.url}`));
            alt3.menu.addMenuItem(it);
        }
        const tr = d.trend || [];
        if (tr.length) {
            const alt4 = altMenu(this._bolum, 'Su an populer', 'starred-symbolic');
            for (const t of tr) {
                const it = new PopupMenu.PopupMenuItem('');
                it.label.clutter_text.set_markup(`<b>${kac(t.ad)}</b>${t.al_puan ? '  AL ' + t.al_puan : ''}\n<small>${soluk(t.yayin ? 'sonraki: ' + t.sonraki_bolum + '. bolum, ' + geriSayim(t.yayin) + ' sonra' : '')}</small>`);
                it.connect('activate', () => calistir(`xdg-open ${t.url}`));
                alt4.menu.addMenuItem(it);
            }
        }
        bilgiSatiri(this._bolum, `<small>${soluk('son kontrol ' + (d.guncelleme || '?') + (d.yedek ? ' · PC yedek verisi' : ''))}</small>`);
    }
});

// ---------- kisayollar ----------
const KisayolDugmesi = GObject.registerClass(
class KisayolDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Kisayollar');
        this.add_child(stIkon('view-app-grid-symbolic'));
        const ac = yol => `nautilus "${yol}"`;
        const gruplar = [
            ['Ekran', 'camera-photo-symbolic', [
                ['Ekran goruntusu / kaydi', '__ekran__', 'camera-photo-symbolic'],
                ['Ekran kaydi (Kooha: MP4, GIF)', 'kooha', 'camera-video-symbolic'],
                ['Ekran goruntuleri klasoru', ac(`${H}/Pictures/Screenshots`), 'folder-pictures-symbolic'],
                ['Videolar klasoru', ac(`${H}/Videos`), 'folder-videos-symbolic'],
            ]],
            ['Klasorler', 'folder-symbolic', [
                ['Ev', ac(H), 'user-home-symbolic'],
                ['Belgeler', ac(`${H}/Documents`), 'folder-documents-symbolic'],
                ['Indirilenler', ac(`${H}/Downloads`), 'folder-download-symbolic'],
                ['Resimler', ac(`${H}/Pictures`), 'folder-pictures-symbolic'],
                ['Masaustu', ac(`${H}/Desktop`), 'user-desktop-symbolic'],
                ['Eclipse calisma alani', ac(`${H}/Documents/eclipse-workspace`), 'eclipse'],
                ['Sunucu: ana disk (foto, medya)', ac('/mnt/flugelserver/sidemain'), 'network-server-symbolic'],
                ['Sunucu: indirmeler', ac('/mnt/flugelserver/side'), 'network-server-symbolic'],
                ['Sunucu: ev klasoru', ac('/mnt/flugelserver/home'), 'network-server-symbolic'],
            ]],
            ['Uygulamalar', 'view-app-grid-symbolic', [
                ['Terminal', 'kitty', 'utilities-terminal-symbolic'],
                ['Chrome', 'google-chrome', 'web-browser-symbolic'],
                ['Dosyalar', 'nautilus', 'folder-symbolic'],
                ['mpv (video oynatici)', 'mpv --player-operation-mode=pseudo-gui', 'media-playback-start-symbolic'],
                ['Steam', 'steam', 'input-gaming-symbolic'],
                ['Sanal makineler', 'virt-manager', 'computer-symbolic'],
                ['Eclipse (C/C++)', `/snap/bin/eclipse -data ${H}/Documents/eclipse-workspace`, 'eclipse'],
                ['Hesap makinesi', 'gnome-calculator', 'accessories-calculator-symbolic'],
                ['Takvim', 'gnome-calendar', 'x-office-calendar-symbolic'],
                ['Saat / alarm / zamanlayici', 'gnome-clocks', 'alarm-symbolic'],
                ['Telegram', 'telegram-desktop', 'mail-send-symbolic'],
            ]],
            ['Okul', 'x-office-document-symbolic', [
                ['Word belgesi (LibreOffice)', 'libreoffice --writer', 'x-office-document-symbolic'],
                ['Tablo (LibreOffice)', 'libreoffice --calc', 'x-office-spreadsheet-symbolic'],
                ['Sunum (LibreOffice)', 'libreoffice --impress', 'x-office-presentation-symbolic'],
                ['OnlyOffice (Word/Excel uyumlu)', 'onlyoffice-desktopeditors', 'x-office-document-symbolic'],
                ['PDF duzenle / imzala (Okular)', 'okular', 'document-edit-symbolic'],
                ['PDF uzerine yaz (Xournal++)', 'xournalpp', 'document-edit-symbolic'],
                ['PDF birlestir / bol', 'pdfarranger', 'document-save-symbolic'],
                ['Hizli not', `gnome-text-editor ${H}/Documents/Notlar.md`, 'document-edit-symbolic'],
            ]],
            ['Sunucu ve medya', 'network-server-symbolic', [
                ['Sunucu paneli', 'xdg-open http://192.168.0.15:3010', 'view-app-grid-symbolic'],
                ['Jellyfin', `${H}/.local/bin/sunucu-ac http 8096 /`, 'applications-multimedia-symbolic'],
                ['Immich (fotograflar)', `${H}/.local/bin/sunucu-ac http 2283 /`, 'folder-pictures-symbolic'],
                ['Nextcloud', `${H}/.local/bin/sunucu-ac https 8443 /`, 'folder-remote-symbolic'],
                ['Sonarr (diziler)', `${H}/.local/bin/sunucu-ac http 8989 /`, 'video-display-symbolic'],
                ['Radarr (filmler)', `${H}/.local/bin/sunucu-ac http 7878 /`, 'applications-multimedia-symbolic'],
                ['Transmission (torrent)', `${H}/.local/bin/sunucu-ac http 9091 /transmission/web/`, 'folder-download-symbolic'],
                ['Yapay zeka sohbet', `${H}/.local/bin/sunucu-ac http 3030 /`, 'face-smile-symbolic'],
            ]],
            ['Araclar', 'applications-utilities-symbolic', [
                ['Sistem izleyici', 'gnome-system-monitor', 'utilities-system-monitor-symbolic'],
                ['Disk kullanimi', 'baobab', 'drive-harddisk-symbolic'],
                ['Emoji ve semboller', 'gnome-characters', 'face-smile-symbolic'],
                ['Sifreler ve anahtarlar', 'seahorse', 'dialog-password-symbolic'],
                ['Ag ayarlari', 'gnome-control-center wifi', 'network-wireless-symbolic'],
                ['Ses ayarlari', 'gnome-control-center sound', 'audio-speakers-symbolic'],
                ['Ekran ayarlari (ikinci monitor)', 'gnome-control-center display', 'display-symbolic'],
            ]],
            ['Bakim ve guc', 'emblem-system-symbolic', [
                ['Sistemi guncelle', 'kitty --hold bash -ic guncelle', 'software-update-available-symbolic'],
                ['PC\'yi sunucuya yedekle', 'systemctl --user start pc-yedek.service', 'document-save-symbolic'],
                ['Timeshift (gecmise don)', 'timeshift-launcher', 'edit-undo-symbolic'],
                ['Ayarlar', 'gnome-control-center', 'preferences-system-symbolic'],
                ['Ekrani kilitle', 'loginctl lock-session', 'system-lock-screen-symbolic'],
                ['Kapat / yeniden baslat', 'gnome-session-quit --power-off', 'system-shutdown-symbolic'],
            ]],
        ];
        for (const [baslik, ik, ogeler] of gruplar) {
            const alt = altMenu(this.menu, baslik, ik);
            for (const [ad, komut, oi] of ogeler)
                menuOgesi(alt.menu, ad, komut, oi);
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const oturum = new Gio.Settings({schema_id: 'org.gnome.desktop.session'});
        const kafein = new PopupMenu.PopupSwitchMenuItem('Uyku modunu engelle', oturum.get_uint('idle-delay') === 0);
        kafein.connect('toggled', (_i, acik) => oturum.set_uint('idle-delay', acik ? 0 : 300));
        this.menu.addMenuItem(kafein);
        const arayuz = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        const tema = new PopupMenu.PopupSwitchMenuItem('Karanlik tema', arayuz.get_string('color-scheme') === 'prefer-dark');
        tema.connect('toggled', (_i, acik) => arayuz.set_string('color-scheme', acik ? 'prefer-dark' : 'default'));
        this.menu.addMenuItem(tema);
    }
});

// ---------- Re:Zero ekibi (hareketli) ----------
const EKIP = [
    ['emilia', 'Emilia', ['Bugun de elinden gelenin en iyisini yaptin!', 'Biraz mola ver, su ic. Puck da oyle diyor.', 'Birlikte her seyi asariz.']],
    ['subaru', 'Subaru', ['Pes etmek yok, bastan baslariz!', 'Bir planim var... sanirim.', 'Yorgunsan kisa bir mola, sonra tam gaz!']],
    ['beatrice', 'Beatrice', ['Betty sana biraz dinlenmeni soyluyor, kashira.', 'Kod yazarken acele etme, kashira.', 'Bu kadar calisma yeter, kashira.']],
    ['rem', 'Rem', ['Sana inaniyorum!', 'Bugunku gorevlerini tek tek bitirelim.', 'Kahvaltini atlama.']],
    ['ram', 'Ram', ['Bu kadar dagin bir masa kabul edilemez.', 'Hadi, kalk ve isini bitir.', 'Fena degil... bu seferlik.']],
    ['julius', 'Julius', ['Bir sovalye gibi disiplinli ol.', 'Zarafet ve azimle devam.', 'Dostluk her zorlugu kolaylastirir.']],
    ['anastasia', 'Anastasia', ['Zaman paradir, bosa harcama!', 'Iyi bir yatirim: dinlenmek.', 'Pazarlik her zaman mumkundur.']],
    ['meili', 'Meili', ['Biraz oyun oynamaya ne dersin?', 'Sakin ol, her sey yolunda.', 'Gunes batmadan isini bitir.']],
    ['shaula', 'Shaula', ['Ustam! Kuleyi ben korurum!', 'Bekliyordum seni, ustam!', 'Bugun de enerjik ol, ustam!']],
];
const EkipDugmesi = GObject.registerClass(
class EkipDugmesi extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Re:Zero ekibi');
        const kutu = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER});
        this._kim = new St.Icon({icon_size: 24, y_align: Clutter.ActorAlign.CENTER});
        this._puck = new St.Icon({gicon: Gio.FileIcon.new(Gio.File.new_for_path(`${EXT}/emilia/puck.svg`)), icon_size: 12,
            y_align: Clutter.ActorAlign.START});
        kutu.add_child(this._kim);
        kutu.add_child(this._puck);
        this.add_child(kutu);
        this._sira = 0;
        this._otomatik = true;
        this._kareler = EKIP.map(([id]) => [
            Gio.FileIcon.new(Gio.File.new_for_path(`${EXT}/ekip/${id}-acik.svg`)),
            Gio.FileIcon.new(Gio.File.new_for_path(`${EXT}/ekip/${id}-kapali.svg`)),
        ]);
        this._baslik = bilgiSatiri(this.menu, '');
        this._soz = bilgiSatiri(this.menu, '');
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const sec = altMenu(this.menu, 'Karakter sec', 'avatar-default-symbolic');
        EKIP.forEach(([, ad], i) => menuOgesi(sec.menu, ad, () => {
            this._otomatikAnahtar.setToggleState(false);
            this._otomatik = false;
            this._goster(i);
        }));
        this._otomatikAnahtar = new PopupMenu.PopupSwitchMenuItem('Otomatik degistir (9 sn)', true);
        this._otomatikAnahtar.connect('toggled', (_i, acik) => {
            this._otomatik = acik;
        });
        this.menu.addMenuItem(this._otomatikAnahtar);
        menuOgesi(this.menu, 'Re:Zero mangam (MAL)', 'xdg-open https://myanimelist.net/manga/24519', 'manga');
        this.menu.connect('open-state-changed', (_m, acik) => {
            if (acik)
                this._konus();
        });
        this._goster(0, true);
        this.pilModu(PILDE);
        this._goz = GLib.timeout_add(GLib.PRIORITY_LOW, 3700, () => {
            this._kim.gicon = this._kareler[this._sira][1];
            GLib.timeout_add(GLib.PRIORITY_LOW, 160, () => {
                if (this._kim)
                    this._kim.gicon = this._kareler[this._sira][0];
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_CONTINUE;
        });
        this._tik = 0;
        this._degis = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 9, () => {
            // pildeyken 9 yerine ~36 saniyede bir degisir
            if (this._otomatik && !this.menu.isOpen && (!PILDE || ++this._tik % 4 === 0))
                this._gecis((this._sira + 1) % EKIP.length);
            return GLib.SOURCE_CONTINUE;
        });
    }

    pilModu(pilde) {
        this._kim.remove_all_transitions();
        this._puck.remove_all_transitions();
        if (pilde) {
            // surekli salinim ekrani her karede yeniden cizdirir -> pilde kapali
            this._kim.translation_y = 0;
            this._puck.translation_y = 0;
            this._puck.translation_x = 0;
            return;
        }
        // salinim + Puck ucusu: Clutter'in kendi tekrar dongusu (ozyineleme yok)
        this._kim.translation_y = 1;
        this._kim.ease({translation_y: -1.5, duration: 1400, mode: Clutter.AnimationMode.EASE_IN_OUT_SINE, repeatCount: -1, autoReverse: true});
        this._puck.translation_y = 2;
        this._puck.ease({translation_y: -3, translation_x: 1.5, duration: 1100, mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD, repeatCount: -1, autoReverse: true});
    }

    _goster(i, ilk) {
        this._sira = i;
        this._kim.gicon = this._kareler[i][0];
        this._puck.visible = EKIP[i][0] === 'emilia';
        if (!ilk && this.menu.isOpen)
            this._konus();
    }

    _gecis(i) {
        if (PILDE) {
            this._goster(i);
            return;
        }
        // yumusak gecis: solup yeni karakterle geri gelir
        this._kim.ease({opacity: 0, duration: 350, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._goster(i);
                this._kim.ease({opacity: 255, duration: 350, mode: Clutter.AnimationMode.EASE_IN_QUAD});
            }});
    }

    _konus() {
        const [, ad, sozler] = EKIP[this._sira];
        this._baslik.label.clutter_text.set_markup(`<b>${ad}</b>`);
        this._soz.label.clutter_text.set_markup(sozler[Math.floor(Math.random() * sozler.length)]);
    }

    destroy() {
        for (const z of [this._goz, this._degis]) {
            if (z)
                GLib.source_remove(z);
        }
        this._goz = this._degis = null;
        this._kim?.remove_all_transitions();
        this._puck?.remove_all_transitions();
        super.destroy();
    }
});


// ---------- Hizli Ayarlar: Pil Tasarrufu anahtari (Guc Modu'nun yaninda) ----------
const TasarrufAnahtari = GObject.registerClass(
class TasarrufAnahtari extends QuickToggle {
    _init(degisti) {
        super._init({title: 'Pil Tasarrufu', subtitle: 'Parlaklik %40, animasyonsuz',
            iconName: 'power-profile-power-saver-symbolic', toggleMode: true});
        this._degisti = degisti;
        // sadece kullanici tiklayinca calisir; programla durum guncellemesi dongu yaratmaz
        this.connect('clicked', () => {
            const acik = this.checked;
            calistir(`${H}/.local/bin/pil-modu ${acik ? 'tasarruf' : 'normal'}`);
            this._degisti(acik);
        });
    }
});

const TasarrufGostergesi = GObject.registerClass(
class TasarrufGostergesi extends SystemIndicator {
    _init(degisti) {
        super._init();
        this._simge = this._addIndicator();
        this._simge.iconName = 'power-profile-power-saver-symbolic';
        this.anahtar = new TasarrufAnahtari(acik => {
            this._simge.visible = acik;
            degisti(acik);
        });
        this.quickSettingsItems.push(this.anahtar);
        this.durumYaz(GLib.file_test(`${H}/.cache/sistem-bakim/pilde`, GLib.FileTest.EXISTS));
    }

    durumYaz(acik) {
        this.anahtar.checked = acik;
        this._simge.visible = acik;
    }

    destroy() {
        this.quickSettingsItems.forEach(i => i.destroy());
        super.destroy();
    }
});

export default class FlugelPanel extends Extension {
    enable() {
        EXT = this.path;
        this._enjeksiyon = new InjectionManager();
        this._enjeksiyon.overrideMethod(AppMenu.prototype, 'setApp', orijinal => function (app) {
            orijinal.call(this, app);
            if (!this._flugelMasaustu)
                this._flugelMasaustu = this.addAction('Masaüstüne ekle', () => masaustuneEkle(this._app));
            this._flugelMasaustu.visible = !!this._app?.app_info?.get_filename?.();
        });
        this._dugmeler = [];
        const IPUCU = {
            eclipse: 'Eclipse — C/C++ gelistirme', terminal: 'Terminal (kitty)', chrome: 'Google Chrome',
            dosyalar: 'Dosyalar', zorla: 'Zorla kapat — donan uygulamayi sec', panik: 'Panik — gizle, sessize al, kilitle',
            kripto: 'Kripto ve doviz — anlik fiyatlar', basket: 'Hakemlik maclarin (ankarabasket)',
            anime: 'Anime / manga takibi — siradaki bolum', sistem: 'Bu PC ve sunucu durumu',
            vm: 'Sunucudaki sanal makineler', foto: 'Ekran goruntusu al', video: 'Ekran kaydi (Kooha)',
            kisayol: 'Kisayollar', ekip: 'Re:Zero ekibi',
        };
        const ekle = (ad, d, sira, kutu) => {
            Main.panel.addToStatusArea(`flugel-${ad}`, d, sira, kutu);
            this._dugmeler.push(d);
            ipucuEkle(d, IPUCU[ad] ?? d.accessible_name);
            return d;
        };
        // sol
        ekle('eclipse', new IkonDugme('eclipse', 'Eclipse', () => calistir(`/snap/bin/eclipse -data ${H}/Documents/eclipse-workspace`)), 1, 'left');
        ekle('terminal', new IkonDugme('utilities-terminal-symbolic', 'Terminal', () => calistir('kitty')), 2, 'left');
        ekle('chrome', new IkonDugme('web-browser-symbolic', 'Chrome', () => calistir('google-chrome')), 3, 'left');
        ekle('dosyalar', new IkonDugme('folder-symbolic', 'Dosyalar', () => calistir('nautilus')), 4, 'left');
        ekle('zorla', new ZorlaKapatDugmesi(), 5, 'left');
        ekle('panik', new PanikDugmesi(), 6, 'left');
        this._kripto = ekle('kripto', new KriptoDugmesi(), 7, 'left');
        try {
            this._upower = Gio.DBusProxy.new_for_bus_sync(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
                'org.freedesktop.UPower', '/org/freedesktop/UPower', 'org.freedesktop.UPower', null);
            const oku = () => {
                PILDE = !!this._upower.get_cached_property('OnBattery')?.unpack();
                this._ekip?.pilModu(PILDE);
                this._tasarruf?.durumYaz(PILDE);
            };
            oku();
            this._upowerSinyal = this._upower.connect('g-properties-changed', oku);
        } catch (e) {
            PILDE = false;
        }
        // sag (orta kutu sadece saate kalir)
        this._basket = ekle('basket', new BasketDugmesi(), 0, 'right');
        this._anime = ekle('anime', new AnimeDugmesi(), 1, 'right');
        this._sistem = ekle('sistem', new SistemDugmesi(), 2, 'right');
        this._vm = ekle('vm', new SanalMakineDugmesi(), 3, 'right');
        ekle('foto', new IkonDugme('camera-photo-symbolic', 'Ekran goruntusu', ekranGoruntusu), 3, 'right');
        ekle('video', new IkonDugme('camera-video-symbolic', 'Ekran kaydi', () => calistir('kooha')), 4, 'right');
        ekle('kisayol', new KisayolDugmesi(), 5, 'right');
        this._ekip = ekle('ekip', new EkipDugmesi(), 6, 'right');
        this._tasarruf = new TasarrufGostergesi(acik => {
            PILDE = acik;
            this._ekip?.pilModu(acik);
        });
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._tasarruf);
        this._tasarruf.durumYaz(PILDE || GLib.file_test(`${H}/.cache/sistem-bakim/pilde`, GLib.FileTest.EXISTS));

        // pilde: kripto 30 sn -> 2 dk, sistem 15 sn -> 1 dk
        const z = (sn, f, pildeKat = 1) => {
            let n = 0;
            return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, sn, () => {
                if (!PILDE || ++n % pildeKat === 0)
                    f();
                return GLib.SOURCE_CONTINUE;
            });
        };
        // resim-icinde-resim (Chrome/YouTube sekme degisince): hep ustte + tum calisma alanlarinda
        const PIP = /picture[- ]in[- ]picture|pencere i[cç]inde pencere|resim i[cç]inde resim/i;
        const pip = w => {
            if (w && PIP.test(w.get_title() ?? '') && !w.is_above()) {
                w.make_above();
                w.stick();
            }
        };
        this._pipBaslik = new Map();
        this._pipId = global.display.connect('window-created', (_d, w) => {
            pip(w);
            this._pipBaslik.set(w, w.connect('notify::title', () => pip(w)));
            w.connect('unmanaged', () => this._pipBaslik?.delete(w));
        });

        // tepsi: ok saga en basa, acilan kutu hemen yaninda; appindicator simgelerini topla
        this._tepsi = new TepsiDugmesi();
        Main.panel.addToStatusArea('flugel-tepsi', this._tepsi, 0, 'right');
        const sag = Main.panel._rightBox;
        sag.insert_child_above(this._tepsi.kutu, this._tepsi.container);
        const tepsiyeAl = c => {
            if (!c || c === this._tepsi?.container || c.get_parent() === this._tepsi?.kutu || !tepsiAnahtari(c))
                return;
            c.get_parent()?.remove_child(c);
            this._tepsi.kutu.add_child(c);
            if (!c._flugelIpucu) {
                c._flugelIpucu = true;
                ipucuEkle(c.get_first_child() ?? c, () => tepsiAdi(c));
            }
            this._tepsi.visible = true;
        };
        this._tepsiSinyalleri = [Main.panel._leftBox, Main.panel._centerBox, sag].map(kutu =>
            [kutu, kutu.connect('child-added', (_k, c) => GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                tepsiyeAl(c);
                return GLib.SOURCE_REMOVE;
            }))]);
        for (const kutu of [Main.panel._leftBox, Main.panel._centerBox, sag])
            kutu.get_children().forEach(tepsiyeAl);
        this._tepsi.kutu.connect('child-removed', () => (this._tepsi.visible = this._tepsi.sayi() > 0));
        this._tepsi.visible = this._tepsi.sayi() > 0;
        ipucuEkle(this._tepsi, () => `Arka planda calisan uygulamalar (${this._tepsi.sayi()})`);

        this._zamanlayicilar = [
            z(30, () => this._kripto.guncelle(), 4),
            z(15, () => this._sistem.guncelle(), 4),
            z(300, () => this._basket.guncelle()),
            z(60, () => this._vm.guncelle(), 2),
            z(60, () => this._anime.etiketYaz()),
            z(900, () => this._anime.guncelle()),
        ];
    }

    disable() {
        if (this._pipId)
            global.display.disconnect(this._pipId);
        for (const [w, id] of this._pipBaslik || [])
            w.disconnect(id);
        this._pipId = 0;
        this._pipBaslik = null;
        for (const [kutu, id] of this._tepsiSinyalleri || [])
            kutu.disconnect(id);
        this._tepsiSinyalleri = null;
        if (this._tepsi) {
            for (const c of this._tepsi.kutu.get_children()) {
                this._tepsi.kutu.remove_child(c);
                Main.panel._rightBox.insert_child_at_index(c, 0);
            }
            this._tepsi.kutu.destroy();
            this._tepsi.destroy();
            this._tepsi = null;
        }
        this._enjeksiyon?.clear();
        this._enjeksiyon = null;
        if (this._upower && this._upowerSinyal)
            this._upower.disconnect(this._upowerSinyal);
        this._tasarruf?.destroy();
        this._upower = this._upowerSinyal = this._ekip = this._tasarruf = null;
        for (const id of this._zamanlayicilar || [])
            GLib.source_remove(id);
        this._zamanlayicilar = [];
        for (const d of this._dugmeler || [])
            d.destroy();
        this._dugmeler = [];
        this._kripto = this._basket = this._anime = this._sistem = this._vm = null;
    }
}
