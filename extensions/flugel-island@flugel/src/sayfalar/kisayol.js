// FLUGEL Island — "Kısayol" sekmesi (FLUGEL v1 panelinin kısayollar menüsü, birebir).
import {Sayfa} from './sayfa.js';
import {H, altMenu, menuOgesi} from '../ortak.js';
import {ECLIPSE} from './hizli.js';

const ac = yol => `nautilus "${yol}"`;
const GRUPLAR = [
    ['Ekran', 'camera-photo-symbolic', [
        ['Ekran görüntüsü / kaydı', '__ekran__', 'camera-photo-symbolic'],
        ['Ekran kaydı (Kooha: MP4, GIF)', 'kooha', 'camera-video-symbolic'],
        ['Ekran görüntüleri klasörü', ac(`${H}/Pictures/Screenshots`), 'folder-pictures-symbolic'],
        ['Videolar klasörü', ac(`${H}/Videos`), 'folder-videos-symbolic'],
    ]],
    ['Klasörler', 'folder-symbolic', [
        ['Ev', ac(H), 'user-home-symbolic'],
        ['Belgeler', ac(`${H}/Documents`), 'folder-documents-symbolic'],
        ['İndirilenler', ac(`${H}/Downloads`), 'folder-download-symbolic'],
        ['Resimler', ac(`${H}/Pictures`), 'folder-pictures-symbolic'],
        ['Masaüstü', ac(`${H}/Desktop`), 'user-desktop-symbolic'],
        ['Eclipse çalışma alanı', ac(`${H}/Documents/eclipse-workspace`), 'eclipse'],
        ['Sunucu: ana disk (foto, medya)', ac('/mnt/flugelserver/sidemain'), 'network-server-symbolic'],
        ['Sunucu: indirmeler', ac('/mnt/flugelserver/side'), 'network-server-symbolic'],
        ['Sunucu: ev klasörü', ac('/mnt/flugelserver/home'), 'network-server-symbolic'],
    ]],
    ['Uygulamalar', 'view-app-grid-symbolic', [
        ['Terminal', 'kitty', 'utilities-terminal-symbolic'],
        ['Chrome', 'google-chrome', 'web-browser-symbolic'],
        ['Dosyalar', 'nautilus', 'folder-symbolic'],
        ['mpv (video oynatıcı)', 'mpv --player-operation-mode=pseudo-gui', 'media-playback-start-symbolic'],
        ['Steam', 'steam', 'input-gaming-symbolic'],
        ['Sanal makineler', 'virt-manager', 'computer-symbolic'],
        ['Eclipse (C/C++)', ECLIPSE, 'eclipse'],
        ['Hesap makinesi', 'gnome-calculator', 'accessories-calculator-symbolic'],
        ['Takvim', 'gnome-calendar', 'x-office-calendar-symbolic'],
        ['Saat / alarm / zamanlayıcı', 'gnome-clocks', 'alarm-symbolic'],
        ['Telegram', 'telegram-desktop', 'mail-send-symbolic'],
    ]],
    ['Okul', 'x-office-document-symbolic', [
        ['Word belgesi (LibreOffice)', 'libreoffice --writer', 'x-office-document-symbolic'],
        ['Tablo (LibreOffice)', 'libreoffice --calc', 'x-office-spreadsheet-symbolic'],
        ['Sunum (LibreOffice)', 'libreoffice --impress', 'x-office-presentation-symbolic'],
        ['OnlyOffice (Word/Excel uyumlu)', 'onlyoffice-desktopeditors', 'x-office-document-symbolic'],
        ['PDF düzenle / imzala (Okular)', 'okular', 'document-edit-symbolic'],
        ['PDF üzerine yaz (Xournal++)', 'xournalpp', 'document-edit-symbolic'],
        ['PDF birleştir / böl', 'pdfarranger', 'document-save-symbolic'],
        ['Hızlı not', `gnome-text-editor ${H}/Documents/Notlar.md`, 'document-edit-symbolic'],
    ]],
    ['Sunucu ve medya', 'network-server-symbolic', [
        ['Sunucu paneli', 'xdg-open http://192.168.0.15:3010', 'view-app-grid-symbolic'],
        ['FLUGEL Akış', 'xdg-open http://192.168.0.15:3012', 'view-list-symbolic'],
        ['Jellyfin', `${H}/.local/bin/sunucu-ac http 8096 /`, 'applications-multimedia-symbolic'],
        ['Immich (fotoğraflar)', `${H}/.local/bin/sunucu-ac http 2283 /`, 'folder-pictures-symbolic'],
        ['Nextcloud', `${H}/.local/bin/sunucu-ac https 8443 /`, 'folder-remote-symbolic'],
        ['Sonarr (diziler)', `${H}/.local/bin/sunucu-ac http 8989 /`, 'video-display-symbolic'],
        ['Radarr (filmler)', `${H}/.local/bin/sunucu-ac http 7878 /`, 'applications-multimedia-symbolic'],
        ['Transmission (torrent)', `${H}/.local/bin/sunucu-ac http 9091 /transmission/web/`, 'folder-download-symbolic'],
        ['Yapay zekâ sohbet', `${H}/.local/bin/sunucu-ac http 3030 /`, 'face-smile-symbolic'],
    ]],
    ['Araçlar', 'applications-utilities-symbolic', [
        ['Sistem izleyici', 'gnome-system-monitor', 'utilities-system-monitor-symbolic'],
        ['Disk kullanımı', 'baobab', 'drive-harddisk-symbolic'],
        ['Emoji ve semboller', 'gnome-characters', 'face-smile-symbolic'],
        ['Şifreler ve anahtarlar', 'seahorse', 'dialog-password-symbolic'],
        ['Ağ ayarları', 'gnome-control-center wifi', 'network-wireless-symbolic'],
        ['Ses ayarları', 'gnome-control-center sound', 'audio-speakers-symbolic'],
        ['Ekran ayarları (ikinci monitör)', 'gnome-control-center display', 'display-symbolic'],
    ]],
    ['Bakım ve güç', 'emblem-system-symbolic', [
        ['Sistemi güncelle', 'kitty --hold bash -ic guncelle', 'software-update-available-symbolic'],
        ['PC\'yi sunucuya yedekle', 'systemctl --user start pc-yedek.service', 'document-save-symbolic'],
        ['Timeshift (geçmişe dön)', 'timeshift-launcher', 'edit-undo-symbolic'],
        ['Ayarlar', 'gnome-control-center', 'preferences-system-symbolic'],
        ['Ekranı kilitle', 'loginctl lock-session', 'system-lock-screen-symbolic'],
        ['Kapat / yeniden başlat', 'gnome-session-quit --power-off', 'system-shutdown-symbolic'],
    ]],
];

export class KisayolSayfa extends Sayfa {
    constructor() {
        super();
        for (const [baslik, ik, ogeler] of GRUPLAR) {
            const alt = altMenu(this, baslik, ik);
            for (const [ad, komut, oi] of ogeler)
                menuOgesi(alt.menu, ad, komut, oi);
        }
    }
}
