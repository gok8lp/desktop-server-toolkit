// FLUGEL Island — "Kısayollar" sekmesi: Windows'taki gibi simge ızgarası. Üstte sabitlenmiş uygulamalar,
// sonra gruplar (klasörler, uygulamalar, okul, sunucu, araçlar, bakım), en altta klavye kısayolları
// (simge + tuş rozeti; tıklayınca aynı işi yapar). Ayrıntılar sadece üzerine gelince balonda.
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Sayfa} from './sayfa.js';
import {H, calistir, ekranGoruntusu} from '../ortak.js';
import {Karo, Izgara, bolum} from '../bilesenler.js';
import {sabitKarolar, ECLIPSE} from '../uygulamalar.js';
import {_, f} from '../dil.js';

const ac = yol => `nautilus "${yol}"`;
const sa = (port, yol = '/', p = 'http') => `${H}/.local/bin/sunucu-ac ${p} ${port} ${yol}`;
// [kısa etiket, açıklama, komut, simge]
const GRUPLAR = () => [
    [_('Klasörler'), [
        [_('Ev'), _('Ev klasörü'), ac(H), 'user-home-symbolic'],
        [_('Belgeler'), _('Belgeler'), ac(`${H}/Documents`), 'folder-documents-symbolic'],
        [_('İndirilen'), _('İndirilenler'), ac(`${H}/Downloads`), 'folder-download-symbolic'],
        [_('Resimler'), _('Resimler'), ac(`${H}/Pictures`), 'folder-pictures-symbolic'],
        [_('Görüntüler'), _('Ekran görüntüleri klasörü'), ac(`${H}/Pictures/Screenshots`), 'camera-photo-symbolic'],
        [_('Videolar'), _('Videolar (ekran kayıtları)'), ac(`${H}/Videos`), 'folder-videos-symbolic'],
        [_('Masaüstü'), _('Masaüstü'), ac(`${H}/Desktop`), 'user-desktop-symbolic'],
        [_('Eclipse ç.a.'), _('Eclipse çalışma alanı'), ac(`${H}/Documents/eclipse-workspace`), 'eclipse'],
        ['Foto/medya', _('Sunucu: ana disk (fotoğraf, medya)'), ac('/mnt/flugelserver/sidemain'), 'network-server-symbolic'],
        [_('İndirmeler'), _('Sunucu: indirmeler'), ac('/mnt/flugelserver/side'), 'network-server-symbolic'],
        [_('Sunucu ev'), _('Sunucu: ev klasörü'), ac('/mnt/flugelserver/home'), 'network-server-symbolic'],
    ]],
    [_('Uygulamalar'), [
        ['mpv', 'mpv video oynatıcı', 'mpv --player-operation-mode=pseudo-gui', 'media-playback-start-symbolic'],
        ['Steam', 'Steam', 'steam', 'input-gaming-symbolic'],
        [_('VM yönet.'), _('Sanal makine yöneticisi'), 'virt-manager', 'computer-symbolic'],
        ['Eclipse', 'Eclipse (C/C++)', ECLIPSE, 'eclipse'],
        [_('Hesap'), _('Hesap makinesi'), 'gnome-calculator', 'accessories-calculator-symbolic'],
        [_('Takvim'), _('Takvim'), 'gnome-calendar', 'x-office-calendar-symbolic'],
        [_('Saat'), _('Saat, alarm, zamanlayıcı'), 'gnome-clocks', 'alarm-symbolic'],
        ['Telegram', 'Telegram', 'telegram-desktop', 'mail-send-symbolic'],
    ]],
    [_('Okul'), [
        ['Word', _('Belge (LibreOffice Writer)'), 'libreoffice --writer', 'x-office-document-symbolic'],
        [_('Tablo'), _('Tablo (LibreOffice Calc)'), 'libreoffice --calc', 'x-office-spreadsheet-symbolic'],
        [_('Sunum'), _('Sunum (LibreOffice Impress)'), 'libreoffice --impress', 'x-office-presentation-symbolic'],
        ['OnlyOffice', 'OnlyOffice (Word/Excel uyumlu)', 'onlyoffice-desktopeditors', 'x-office-document-symbolic'],
        [_('PDF imza'), 'PDF düzenle / imzala (Okular)', 'okular', 'document-edit-symbolic'],
        [_('PDF yaz'), _('PDF üzerine yaz (Xournal++)'), 'xournalpp', 'document-edit-symbolic'],
        [_('PDF böl'), 'PDF birleştir / böl', 'pdfarranger', 'document-save-symbolic'],
        [_('Not'), _('Hızlı not (Notlar.md)'), `gnome-text-editor ${H}/Documents/Notlar.md`, 'document-edit-symbolic'],
    ]],
    [_('Sunucu ve medya'), [
        ['Panel', _('Sunucu paneli'), 'xdg-open http://192.168.0.15:3010', 'view-app-grid-symbolic'],
        [_('Akış'), _('FLUGEL Akış'), 'xdg-open http://192.168.0.15:3012', 'view-list-symbolic'],
        ['Jellyfin', 'Jellyfin', sa(8096), 'applications-multimedia-symbolic'],
        ['Immich', _('Immich (fotoğraflar)'), sa(2283), 'folder-pictures-symbolic'],
        ['Nextcloud', 'Nextcloud', sa(8443, '/', 'https'), 'folder-remote-symbolic'],
        ['Sonarr', _('Sonarr (diziler)'), sa(8989), 'video-display-symbolic'],
        ['Radarr', _('Radarr (filmler)'), sa(7878), 'applications-multimedia-symbolic'],
        [_('Torrent'), _('Transmission'), sa(9091, '/transmission/web/'), 'folder-download-symbolic'],
        [_('Yapay zekâ'), _('Yapay zekâ sohbet'), sa(3030), 'face-smile-symbolic'],
    ]],
    [_('Araçlar'), [
        [_('İzleyici'), _('Sistem izleyici'), 'gnome-system-monitor', 'utilities-system-monitor-symbolic'],
        [_('Disk'), _('Disk kullanımı'), 'baobab', 'drive-harddisk-symbolic'],
        ['Emoji', _('Emoji ve semboller'), 'gnome-characters', 'face-smile-symbolic'],
        [_('Şifreler'), _('Şifreler ve anahtarlar'), 'seahorse', 'dialog-password-symbolic'],
        [_('Ağ'), _('Ağ ayarları'), 'gnome-control-center wifi', 'network-wireless-symbolic'],
        [_('Ses'), _('Ses ayarları'), 'gnome-control-center sound', 'audio-speakers-symbolic'],
        [_('Ekranlar'), _('Ekran ayarları (ikinci monitör)'), 'gnome-control-center display', 'video-display-symbolic'],
    ]],
    [_('Bakım ve güç'), [
        [_('Güncelle'), _('Sistemi güncelle'), 'kitty --hold bash -ic guncelle', 'software-update-available-symbolic'],
        [_('Yedekle'), _('PC\'yi sunucuya yedekle'), 'systemctl --user start pc-yedek.service', 'document-save-symbolic'],
        ['Timeshift', _('Timeshift (geçmişe dön)'), 'timeshift-launcher', 'edit-undo-symbolic'],
        [_('Ayarlar'), _('GNOME ayarları'), 'gnome-control-center', 'preferences-system-symbolic'],
        [_('Kilitle'), _('Ekranı kilitle'), 'loginctl lock-session', 'system-lock-screen-symbolic'],
        [_('Kapat'), 'Kapat / yeniden başlat', 'gnome-session-quit --power-off', 'system-shutdown-symbolic'],
    ]],
];

const odak = () => global.display.focus_window;
// [tuş, ne yapar, simge, işlem]
const KLAVYE = o => [
    ['Super', _('Etkinlikler: pencereler ve arama'), 'focus-windows-symbolic', () => Main.overview.toggle()],
    ['Super+A', _('Tüm uygulamalar'), 'view-app-grid-symbolic', () => Main.overview.showApps()],
    ['Super+S', _('Hızlı ayarlar (ses, ağ, pil)'), 'view-grid-symbolic', () => o.ustCubuk?.hizliAyarlar()],
    ['Super+V', _('Bildirimler ve takvim'), 'x-office-calendar-symbolic', () => o.ustCubuk?.takvim()],
    ['Super+Z', 'Terminal (kitty)', 'utilities-terminal-symbolic', () => calistir('kitty')],
    ['Super+X', _('Etkin pencereyi kapat (Alt+F4 da)'), 'window-close-symbolic', () => odak()?.delete(global.get_current_time())],
    ['Super+H', _('Etkin pencereyi küçült'), 'window-minimize-symbolic', () => odak()?.minimize()],
    ['Super+↑', _('Etkin pencereyi büyüt'), 'window-maximize-symbolic', () => odak()?.maximize?.(3)],
    ['Shift+Super+S', _('Ekran görüntüsü (Print da)'), 'camera-photo-symbolic', ekranGoruntusu],
    ['Super+L', _('Ekranı kilitle'), 'system-lock-screen-symbolic', () => calistir('loginctl lock-session')],
    ['Ctrl+Alt+T', 'Terminal', 'utilities-terminal-symbolic', () => calistir('kitty')],
    [_('😊 tuşu'), _('Emoji seçici (K380s gülen yüz tuşu)'), 'face-smile-symbolic', () => calistir('flatpak run it.mijorus.smile')],
];

export class KisayolSayfa extends Sayfa {
    constructor(o) {
        super();
        this._o = o;
        const genislik = Math.round(o.ayarlar.get_int('kart-genislik') - 48);
        const kapat = () => this.close();
        this._sabitIzgara = new Izgara({genislik, karoGenisligi: 84});
        this.actor.add_child(bolum(_('Sabitlenmiş'), this._sabitIzgara));
        this._sabitYaz();
        this._ayarId = o.ayarlar.connect('changed::sabit-uygulamalar', () => this._sabitYaz());

        for (const [baslik, ogeler] of GRUPLAR()) {
            const iz = new Izgara({genislik, karoGenisligi: 84});
            for (const [kisa, aciklama, komut, ik] of ogeler) {
                iz.ekle(new Karo({ikon: ik, etiket: kisa, ipucu: {baslik: aciklama, ayrinti: komut.replace(H, '~')},
                    eylem: () => {
                        kapat();
                        calistir(komut);
                    }}));
            }
            this.actor.add_child(bolum(baslik, iz));
        }

        const klavye = new Izgara({genislik, karoGenisligi: 108});
        for (const [tus, ne, ik, fn] of KLAVYE(o)) {
            klavye.ekle(new Karo({ikon: ik, etiket: tus, stil: 'flugel-karo-tus', ipucu: {baslik: ne, ayrinti: f(_('Kısayol: %s · tıklayınca şimdi yapar'), tus)},
                eylem: () => {
                    kapat();
                    fn();
                }}));
        }
        this.actor.add_child(bolum(_('Klavye kısayolları'), klavye));
    }

    _sabitYaz() {
        this._sabitIzgara.temizle();
        for (const k of sabitKarolar(this._o.ayarlar, {sonra: () => this.close()}))
            this._sabitIzgara.ekle(k);
    }

    destroy() {
        this._o.ayarlar.disconnect(this._ayarId);
        super.destroy();
    }
}
