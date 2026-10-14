// FLUGEL Island — "Anime ve manga" sekmesi: görsel ağırlıklı. Anime · Manga alt sekmeleri; varsayılan
// olarak sadece takip ettiklerimin kapakları (altında yazı yok). Rozet: yeni bölüm çıktıysa nokta, 1 saatten
// az kaldıysa geri sayım. Kapağın üzerine gelince büyüyen önizleme: büyük kapak, ad, son bölümün IMDb puanı
// (varsa), AniList ve MAL puanı, sonraki bölüme kalan süre, yasal izleme bağlantısı. Izgaranın sonundaki "+"
// ile takip dışı anime/manga eklenir (bu sezon + MAL listemdeki diğerleri, arama kutulu); sağ tıkla kaldırılır.
// Kapaklar diskten okunur (ust-panel-veri anime önbelleğe alır). Lisanssız yayın sitesi yok.
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Sayfa} from './sayfa.js';
import {calistir, geriSayim, kac, soluk} from '../ortak.js';
import {Izgara, ResimKaro, Karo, bolum, dugme} from '../bilesenler.js';

const SITE_IKON = {'Crunchyroll': 'renkli:crunchyroll', 'HIDIVE': 'renkli:hidive', 'Netflix': 'renkli:netflix'};
const TAKIP = new Set(['Izliyorum', 'Beklemede', 'Planliyorum', 'Okuyorum']);
const ac = url => {
    if (/^https?:\/\//.test(url ?? ''))
        calistir(`xdg-open ${GLib.shell_quote(url)}`);
};

export function yaklasanlar(d) {
    const simdi = Math.floor(Date.now() / 1000);
    return (d?.anime || []).filter(a => a.yayin && a.yayin > simdi).sort((x, y) => x.yayin - y.yayin);
}

function rozet(a) {
    const simdi = Math.floor(Date.now() / 1000);
    if (!a.yayin)
        return '';
    const kalan = a.yayin - simdi;
    if (kalan > 0 && kalan < 3600)
        return `${Math.max(1, Math.floor(kalan / 60))}dk`;
    // haftalık yayında bir önceki bölüm son 24 saatte çıktıysa: yeni
    const onceki = a.yayin - 7 * 86400;
    return onceki <= simdi && simdi - onceki < 86400 ? '●' : '';
}

export class AnimeSayfa extends Sayfa {
    constructor({veri, ayarlar}) {
        super();
        this._veri = veri;
        this._ayar = ayarlar;
        this._tur = 'anime';
        this._genislik = ayarlar.get_int('kart-genislik') - 48;

        const cipler = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        this._cip = {};
        for (const [k, ad] of [['anime', 'Anime'], ['manga', 'Manga']]) {
            const b = new St.Button({label: ad, style_class: 'flugel-cip', can_focus: true});
            b.connect('clicked', () => {
                this._tur = k;
                this._secimKapat();
                this._cizilen?.clear();
                this._yaz();
            });
            this._cip[k] = b;
            cipler.add_child(b);
        }
        this.actor.add_child(cipler);
        this._izgara = new Izgara({genislik: this._genislik, karoGenisligi: 108, bosluk: 10});
        this.actor.add_child(bolum('', this._izgara));

        // takip dışı seçim paneli
        this._secim = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel', visible: false});
        this._arama = new St.Entry({style_class: 'flugel-arama', hint_text: 'Ara…', can_focus: true, x_expand: true});
        this._arama.clutter_text.connect('text-changed', () => this._secimYaz());
        const aramaSatiri = new St.BoxLayout({style: 'spacing: 6px;'});
        aramaSatiri.add_child(this._arama);
        aramaSatiri.add_child(dugme('window-close-symbolic', 'Kapat', () => this._secimKapat(), {stil: 'flugel-dugme flugel-dugme-kucuk'}));
        this._secim.add_child(aramaSatiri);
        this._secimIzgara = new Izgara({genislik: this._genislik - 16, karoGenisligi: 96, bosluk: 8});
        this._secim.add_child(this._secimIzgara.actor);
        this.actor.add_child(this._secim);

        const alt = new Izgara({sutun: 3});
        alt.ekle(new Karo({ikon: 'avatar-default-symbolic', etiket: 'MAL profilim', ipucu: 'MyAnimeList profilim',
            eylem: () => this._git('https://myanimelist.net/profile/gokalpgoksu')}));
        alt.ekle(new Karo({ikon: 'x-office-calendar-symbolic', etiket: 'Yayın takvimi', ipucu: 'Bu sezonun yayın takvimi (AniList)',
            eylem: () => this._git('https://anilist.co/airing')}));
        alt.ekle(new Karo({ikon: 'view-refresh-symbolic', etiket: 'Yenile', ipucu: 'Listeyi şimdi yenile',
            eylem: () => this._veri.yenile('anime', true)}));
        this.actor.add_child(bolum('', alt));

        this._aboneler = [veri.abone('anime', d => {
            const y = yaklasanlar(d).filter(a => a.liste !== 'Planliyorum');
            const kalan = y[0] ? y[0].yayin - Math.floor(Date.now() / 1000) : Infinity;
            this.rozetDegisti?.(kalan < 3600 ? `${Math.max(1, Math.floor(kalan / 60))}dk` : (kalan < 86400 ? `${Math.floor(kalan / 3600)}sa` : ''));
            this.gorunurse(() => this._yaz());
        })];
        this._ayarId = ayarlar.connect('changed', (_s, k) => {
            if (k === 'anime-secili' || k === 'manga-secili') {
                this._cizilen?.clear();
                this.gorunurse(() => this._yaz());
            }
        });
    }

    _git(url) {
        this.close();
        ac(url);
    }

    goster() {
        this._yaz();
    }

    gizle() {
        this._secimKapat();
    }

    kapandi() {
        super.kapandi();
        this._secimKapat();
    }

    _kayitlar(d) {
        const anahtar = this._tur === 'anime' ? 'anime-secili' : 'manga-secili';
        const secili = new Set(this._ayar.get_strv(anahtar).map(Number));
        const takip = (this._tur === 'anime' ? d.anime : d.manga) ?? [];
        const havuz = this._tur === 'anime' ? [...(d.sezon ?? []), ...(d.diger ?? [])] : (d.manga_diger ?? []);
        const takipId = new Set(takip.map(x => x.id));
        const ekler = [];
        for (const x of havuz) {
            if (secili.has(x.id) && !takipId.has(x.id) && !ekler.some(e => e.id === x.id))
                ekler.push({...x, _secilen: true});
        }
        return [...takip.filter(x => TAKIP.has(x.liste)), ...ekler];
    }

    _yaz() {
        const d = this._veri.son('anime');
        if (!this.degisti('anime', [d?.guncelleme, d?.hata, this._tur, this._ayar.get_strv(`${this._tur}-secili`)]))
            return;
        for (const [k, b] of Object.entries(this._cip)) {
            if (k === this._tur)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        this._izgara.temizle();
        if (!d || d.hata) {
            this._izgara.ekle(new Karo({ikon: 'image-missing-symbolic', etiket: d ? 'Alınamadı' : 'Yükleniyor…'}));
            return;
        }
        for (const a of this._kayitlar(d))
            this._izgara.ekle(this._kapak(a));
        this._izgara.ekle(new Karo({ikon: 'list-add-symbolic', etiket: 'Ekle', boyut: 28, stil: 'flugel-ekle-karo flugel-ekle-kapak',
            ipucu: {baslik: `Takip dışı ${this._tur} ekle`, ayrinti: 'Bu sezon ve MAL listemdeki diğerleri; eklenenler sağ tıkla kaldırılır'},
            eylem: () => this._secimAc()}));
    }

    _kapak(a) {
        return new ResimKaro({
            resim: a.kapak_kucuk, boyut: 108, baslik: a.ad, puan: a.mal_puan ?? (a.al_puan ? (a.al_puan / 10).toFixed(1) : null),
            rozet: this._tur === 'anime' ? rozet(a) : '',
            eylem: () => this._git(a.url),
            sagTik: a._secilen ? () => this._secimdenCikar(a.id) : null,
            onizleme: () => this._onizleme(a),
        });
    }

    _onizleme(a) {
        const satirlar = [];
        if (this._tur === 'anime') {
            if (a.son_bolum)
                satirlar.push(`Son bölüm: <b>${a.son_bolum}</b>${a.imdb_puan ? `  ·  IMDb <b>${a.imdb_puan}</b>` : soluk('  ·  IMDb puanı yok')}`);
            if (a.yayin)
                satirlar.push(`Sonraki: <b>${a.sonraki_bolum}. bölüm</b> · ${geriSayim(a.yayin)} sonra`);
            if (a.izlenen !== undefined)
                satirlar.push(soluk(`İzlediğin ${a.izlenen}/${a.toplam || '?'} · ${kac(a.liste ?? 'eklediğin')}`));
        } else {
            satirlar.push(`Bölüm ${a.okunan ?? '?'}${a.toplam ? `/${a.toplam}` : ''} · ${kac(a.durum ?? '')}`);
        }
        satirlar.push([a.al_puan ? `AniList <b>${a.al_puan}</b>` : '', a.mal_puan ? `MAL <b>${a.mal_puan}</b>` : ''].filter(Boolean).join('  ·  '));
        // kısa açıklama: Türkçe (sunucudaki yerel çeviri), yoksa AniList'in kısa İngilizce metni
        const aciklama = a.aciklama || a.aciklama_en;
        if (aciklama)
            satirlar.unshift(`<i>${kac(aciklama)}</i>`);
        const dugmeler = [];
        if (a.izle?.url)
            dugmeler.push({ikon: SITE_IKON[a.izle.site] ?? 'media-playback-start-symbolic', etiket: a.izle.site, fn: () => ac(a.izle.url)});
        dugmeler.push({ikon: 'renkli:mal', etiket: 'MyAnimeList', fn: () => ac(a.url)});
        return {resim: a.kapak_buyuk_yol ?? a.kapak_kucuk, baslik: a.ad, satirlar: satirlar.filter(Boolean), dugmeler};
    }

    // ---------- takip dışı seçim ----------
    _secimAc() {
        this._secim.show();
        this._arama.text = '';
        this._secimYaz();
        // arama kutusuna yazılabilsin diye klavye bu süre için Island'a alınır (kapanınca bırakılır)
        if (!this._grab) {
            let kok = this.actor;
            while (kok && kok.name !== 'flugelIsland')
                kok = kok.get_parent();
            if (kok) {
                this._grab = Main.pushModal(kok, {actionMode: Shell.ActionMode.POPUP});
                this._arama.grab_key_focus();
            }
        }
    }

    _secimKapat() {
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this._secim.hide();
        this._secimIzgara.temizle();
    }

    _secimYaz() {
        const d = this._veri.son('anime');
        this._secimIzgara.temizle();
        if (!d)
            return;
        const anahtar = this._tur === 'anime' ? 'anime-secili' : 'manga-secili';
        const secili = new Set(this._ayar.get_strv(anahtar).map(Number));
        const takip = new Set(((this._tur === 'anime' ? d.anime : d.manga) ?? []).map(x => x.id));
        const ara = this._arama.text.trim().toLocaleLowerCase('tr');
        const havuz = this._tur === 'anime' ? [...(d.sezon ?? []), ...(d.diger ?? [])] : (d.manga_diger ?? []);
        const gorulen = new Set();
        for (const x of havuz) {
            if (gorulen.has(x.id) || takip.has(x.id) || (ara && !(x.ad ?? '').toLocaleLowerCase('tr').includes(ara)))
                continue;
            gorulen.add(x.id);
            this._secimIzgara.ekle(new ResimKaro({resim: x.kapak_kucuk, boyut: 96, baslik: x.ad,
                puan: x.al_puan ? (x.al_puan / 10).toFixed(1) : null, rozet: secili.has(x.id) ? '✓' : '',
                eylem: () => this._secimeEkle(x.id),
                onizleme: () => ({resim: x.kapak_kucuk, baslik: x.ad, satirlar: [x.al_puan ? `AniList <b>${x.al_puan}</b>` : '',
                    secili.has(x.id) ? 'Eklendi (sağ tıkla kaldır)' : 'Tıkla: ekle'].filter(Boolean)}),
                sagTik: secili.has(x.id) ? () => this._secimdenCikar(x.id) : null}));
            if (this._secimIzgara.sayi >= 60)
                break;
        }
    }

    _secimeEkle(id) {
        const anahtar = this._tur === 'anime' ? 'anime-secili' : 'manga-secili';
        const liste = this._ayar.get_strv(anahtar);
        if (!liste.includes(String(id)))
            this._ayar.set_strv(anahtar, [...liste, String(id)]);
        this._secimYaz();
    }

    _secimdenCikar(id) {
        const anahtar = this._tur === 'anime' ? 'anime-secili' : 'manga-secili';
        this._ayar.set_strv(anahtar, this._ayar.get_strv(anahtar).filter(x => x !== String(id)));
        if (this._secim.visible)
            this._secimYaz();
    }

    destroy() {
        this._secimKapat();
        this._aboneler.forEach(f => f());
        this._ayar.disconnect(this._ayarId);
        super.destroy();
    }
}
