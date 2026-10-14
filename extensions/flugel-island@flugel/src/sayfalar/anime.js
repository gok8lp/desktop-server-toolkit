// FLUGEL Island — "Anime" sekmesi: yaklaşan bölümler, izlediklerim, mangalarım, popüler (FLUGEL v1 panelinden).
// Sadece MyAnimeList / AniList bağlantıları; lisanssız yayın sitesi yok.
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import GLib from 'gi://GLib';
import {Sayfa} from './sayfa.js';
import {SARI, bilgiSatiri, menuOgesi, altMenu, calistir, kac, renkli, soluk, geriSayim} from '../ortak.js';

const puan = (mal, al) => [mal ? `MAL <b>${mal}</b>` : '', al ? `AL ${al}` : ''].filter(Boolean).join(' · ');
const guvenliAc = url => {
    // sadece http(s) bağlantıları açılır
    if (/^https?:\/\//.test(url ?? ''))
        calistir(`xdg-open ${GLib.shell_quote(url)}`);
};

export function yaklasanlar(d) {
    const simdi = Math.floor(Date.now() / 1000);
    return (d?.anime || []).filter(a => a.yayin && a.yayin > simdi).sort((x, y) => x.yayin - y.yayin);
}

export class AnimeSayfa extends Sayfa {
    constructor({veri}) {
        super();
        this._veri = veri;
        this._bolum = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._bolum);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this, 'MyAnimeList profilim', 'xdg-open https://myanimelist.net/profile/gokalpgoksu', 'avatar-default-symbolic');
        menuOgesi(this, 'Bu sezonun yayın takvimi', 'xdg-open https://anilist.co/airing', 'x-office-calendar-symbolic');
        menuOgesi(this, 'Yenile', () => veri.yenile('anime', true), 'view-refresh-symbolic');
        this._aboneler = [veri.abone('anime', d => {
            const y = yaklasanlar(d);
            const ilk = y.find(a => a.liste !== 'Planliyorum') || y[0];
            // rozet kısa: sadece 24 saatten az kaldıysa saat (ya da dakika)
            const kalan = ilk ? ilk.yayin - Math.floor(Date.now() / 1000) : Infinity;
            this.rozetDegisti?.(kalan < 3600 ? `${Math.max(1, Math.floor(kalan / 60))}dk` : (kalan < 86400 ? `${Math.floor(kalan / 3600)}sa` : ''));
            this.gorunurse(() => this._yaz());
        })];
    }

    goster() {
        this._yaz();
    }

    _yaz() {
        this._bolum.removeAll();
        const d = this._veri.son('anime');
        if (!d) {
            bilgiSatiri(this._bolum, soluk('Yükleniyor…'), 'anime');
            return;
        }
        if (d.hata) {
            bilgiSatiri(this._bolum, renkli('Anime verisi alınamadı', SARI), 'anime');
            return;
        }
        const y = yaklasanlar(d);
        const alt1 = altMenu(this._bolum, `Yaklaşan bölümler (${y.length})`, 'anime');
        for (const a of y.slice(0, 15)) {
            const tarih = GLib.DateTime.new_from_unix_local(a.yayin).format('%d.%m %H:%M');
            const etiket = a.liste === 'Izliyorum' ? '● izliyorum' : (a.liste === 'Beklemede' ? '● beklemede' : '○ plan');
            const it = new PopupMenu.PopupMenuItem('');
            it.label.clutter_text.set_markup(`<b>${kac(a.ad)}</b> — ${a.sonraki_bolum}. bölüm  ${soluk(etiket)}\n<small>${soluk(`${tarih}  (${geriSayim(a.yayin)} sonra)   `)}${puan(a.mal_puan, a.al_puan)}</small>`);
            it.connect('activate', () => guvenliAc(a.url));
            alt1.menu.addMenuItem(it);
        }
        alt1.setSubmenuShown(true);
        const izle = (d.anime || []).filter(a => a.liste === 'Izliyorum');
        if (izle.length) {
            const alt2 = altMenu(this._bolum, `İzlediklerim (${izle.length})`, 'media-playback-start-symbolic');
            for (const a of izle) {
                const it = new PopupMenu.PopupMenuItem('');
                it.label.clutter_text.set_markup(`<b>${kac(a.ad)}</b>  ${a.izlenen}/${a.toplam || '?'} bölüm · ${kac(a.durum)}\n<small>${puan(a.mal_puan, a.al_puan)}${a.benim_puan ? soluk(` · benim: ${a.benim_puan}`) : ''}</small>`);
                it.connect('activate', () => guvenliAc(a.url));
                alt2.menu.addMenuItem(it);
            }
        }
        const okuyorumOnce = (x, z) => (x.liste === 'Okuyorum' ? -1 : 1) - (z.liste === 'Okuyorum' ? -1 : 1);
        const manga = [...(d.manga || [])].sort(okuyorumOnce);
        const alt3 = altMenu(this._bolum, `Mangalarım (${manga.length})`, 'manga');
        for (const m of manga) {
            const it = new PopupMenu.PopupMenuItem('');
            it.label.clutter_text.set_markup(`<b>${kac(m.ad)}</b>  bölüm ${m.okunan}${m.toplam ? `/${m.toplam}` : ''} · ${kac(m.durum)} ${m.liste === 'Okuyorum' ? '● okuyorum' : ''}\n<small>${puan(m.mal_puan, m.al_puan)}</small>`);
            it.connect('activate', () => guvenliAc(m.url));
            alt3.menu.addMenuItem(it);
        }
        const tr = d.trend || [];
        if (tr.length) {
            const alt4 = altMenu(this._bolum, 'Şu an popüler', 'starred-symbolic');
            for (const t of tr) {
                const it = new PopupMenu.PopupMenuItem('');
                it.label.clutter_text.set_markup(`<b>${kac(t.ad)}</b>${t.al_puan ? `  AL ${t.al_puan}` : ''}\n<small>${soluk(t.yayin ? `sonraki: ${t.sonraki_bolum}. bölüm, ${geriSayim(t.yayin)} sonra` : '')}</small>`);
                it.connect('activate', () => guvenliAc(t.url));
                alt4.menu.addMenuItem(it);
            }
        }
        bilgiSatiri(this._bolum, `<small>${soluk(`son kontrol ${d.guncelleme || '?'}${d.yedek ? ' · PC yedek verisi' : ''}`)}</small>`);
    }

    destroy() {
        this._aboneler.forEach(f => f());
        super.destroy();
    }
}
