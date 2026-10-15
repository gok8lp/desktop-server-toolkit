// FLUGEL Island — GNOME Shell 50 eklentisi.
// Üst çubuğun ortasında, MacBook'taki Dynamic Island gibi çalışan ada: canlı etkinlikler + FLUGEL panelinin
// bütün araçları. Mimari hacksynth/gnome-dynamic-island'dan, yay animasyonu ve gizlilik izleme
// HIMURAw/gnome-dynamic-island'dan alınmıştır (bkz. CREDITS.md). Lisans: GPL-3.0-or-later.
//
// Katmanlar:
//   ActivityManager (saf model)  ←  sağlayıcılar (providers/*: medya, gizlilik, sunucu, maç…)
//          ↓ görünüm modeli
//   IslandGorunumu (kapsül/balon/kart, yay animasyonu)  ←  Kart (sekmeler: sayfalar/*)
//   VeriMerkezi (ust-panel-veri, tek zamanlayıcı/kaynak)  →  sayfalar + sağlayıcılar
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ActivityManager} from './src/activity-manager.js';
import {eklentiYolu, ikonOnbellegiTemizle} from './src/ortak.js';
import {bilesenleriTemizle} from './src/bilesenler.js';
import {VeriMerkezi} from './src/veri-merkezi.js';
import {GucDurumu, TasarrufGostergesi} from './src/guc.js';
import {PanikDenetci} from './src/panik.js';
import {EkipSurprizi} from './src/ekip.js';
import {PencereYardimcisi} from './src/pencere.js';
import {PipYoneticisi} from './src/pip.js';
import {UykuEngeli} from './src/uyku.js';
import {DockBuyume} from './src/dock.js';
import {Kart} from './src/kart.js';
import {IslandGorunumu} from './src/island-gorunumu.js';

import {HizliSayfa} from './src/sayfalar/hizli.js';
import {KisayolSayfa} from './src/sayfalar/kisayol.js';
import {SistemSayfa} from './src/sayfalar/sistem.js';
import {VmSayfa} from './src/sayfalar/vm.js';
import {KriptoSayfa} from './src/sayfalar/kripto.js';
import {BasketSayfa} from './src/sayfalar/basket.js';
import {AnimeSayfa} from './src/sayfalar/anime.js';
import {BildirimlerSayfa} from './src/sayfalar/bildirimler.js';
import {AkisSayfa} from './src/sayfalar/akis.js';
import {OyunSayfa} from './src/sayfalar/oyun.js';
import {Tepsi} from './src/tepsi.js';
import {UstCubuk} from './src/ust-cubuk.js';

import {PrivacyProvider} from './src/providers/privacy.js';
import {PanikProvider} from './src/providers/panik.js';
import {SunucuProvider, GpuVmProvider, AkisProvider} from './src/providers/sunucu.js';
import {MediaProvider} from './src/providers/media.js';
import {BasketProvider} from './src/providers/basket.js';
import {AnimeProvider} from './src/providers/anime.js';
import {KriptoProvider} from './src/providers/kripto.js';
import {OsdProvider} from './src/providers/osd.js';
import {PowerProvider} from './src/providers/power.js';
import {CihazProvider} from './src/providers/cihaz.js';
import {NotificationProvider} from './src/providers/notification.js';
import {BildirimProvider} from './src/providers/bildirim.js';
import {OtomatikGuncelleme} from './src/guncelleme.js';
import {KeyboardProvider} from './src/providers/keyboard.js';
import {IndirmeProvider} from './src/providers/indirme.js';
import {OdakProvider} from './src/providers/odak.js';
import {ZamanlayiciProvider, pano} from './src/araclar.js';
import {_, dilKur} from './src/dil.js';

// Ayarlardaki kimlik → sağlayıcı (her açılışta yeni örnek; eski örnekten hiçbir şey taşınmaz)
const SAGLAYICILAR = {
    'privacy': () => new PrivacyProvider(),
    'panik': o => new PanikProvider(o.panik),
    'sunucu': o => new SunucuProvider(o),
    'gpu-vm': o => new GpuVmProvider(o),
    'media': () => new MediaProvider(),
    'basket': o => new BasketProvider(o),
    'anime': o => new AnimeProvider(o),
    'kripto': o => new KriptoProvider(o),
    'osd': o => new OsdProvider(o),
    'power': () => new PowerProvider(),
    'cihaz': () => new CihazProvider(),
    'notification': () => new NotificationProvider(),
    'bildirim': o => new BildirimProvider(o),
    'akis': o => new AkisProvider(o),
    'keyboard': () => new KeyboardProvider(),
    'zamanlayici': o => new ZamanlayiciProvider(o),
    'indirme': () => new IndirmeProvider(),
    'odak': () => new OdakProvider(),
};

export default class FlugelIsland extends Extension {
    enable() {
        // yarıda kalan bir açılış (beklenmeyen hata) zamanlayıcı ya da aktör bırakmasın
        try {
            this._ac();
        } catch (e) {
            this.disable();
            throw e;
        }
    }

    _ac() {
        eklentiYolu(this.path);
        if (Main.extensionManager.lookup('flugel-panel@flugel')?.state === 1)
            console.warn('FLUGEL Island: flugel-panel de açık; ikisi birlikte kullanılmamalı (kur-island betiği eskisini kapatır)');

        this._ayar = this.getSettings();
        this._ayarGoc();
        // arayüz dili (sistem / Türkçe / English) — ayarlar penceresi değiştirince Island'ı yeniden başlatır
        dilKur(this.path, this._ayar.get_string('dil'));
        this._yonetici = new ActivityManager();
        this._guc = new GucDurumu();
        this._veri = new VeriMerkezi(this._ayar);
        this._panik = new PanikDenetci();
        this._ekip = new EkipSurprizi(this._ayar, this._panik);
        this._gucAbone = this._guc.abone(g => {
            this._veri.seyrekModu(g.seyrek);
        });
        this._tasarruf = new TasarrufGostergesi(this._guc);
        this._pencere = new PencereYardimcisi();
        this._pencere.enable();
        this._pip = new PipYoneticisi(this._ayar);
        this._pip.enable();
        this._dock = new DockBuyume(this._ayar, this._guc);
        this._dock.enable();
        this._guncelleme = new OtomatikGuncelleme(this._ayar);

        this._uyku = new UykuEngeli(this._yonetici, this._ayar);
        pano.baslat();
        const o = {veri: this._veri, panik: this._panik, uyku: this._uyku, guc: this._guc, ekip: this._ekip, ayarlar: this._ayar,
            ustCubuk: {
                hizliAyarlar: () => this._ustCubuk?.hizliAyarlar(),
                takvim: () => this._ustCubuk?.takvim(),
                etkinlikler: () => this._ustCubuk?.etkinlikler(),
            }};
        const sayfalar = [
            {id: 'hizli', ad: _('Hızlı'), aciklama: _('Uygulamalar, araçlar, uyku engelleme'), ikon: 'view-app-grid-symbolic', sayfa: new HizliSayfa(o)},
            {id: 'kisayol', ad: _('Kısayollar'), aciklama: _('Klasörler, uygulamalar, klavye kısayolları'), ikon: 'folder-symbolic', sayfa: new KisayolSayfa(o)},
            {id: 'sistem', ad: _('Sistem'), aciklama: _('Bu PC, pil ve sunucu'), ikon: 'computer-symbolic', sayfa: new SistemSayfa(o)},
            {id: 'vm', ad: _('Sanal makineler'), aciklama: _('Sunucudaki Windows ve Ubuntu'), ikon: 'video-display-symbolic', sayfa: new VmSayfa(o)},
            {id: 'kripto', ad: _('Kripto ve döviz'), aciklama: _('Fiyatlar ve grafikler'), ikon: 'coin-btc', sayfa: new KriptoSayfa(o)},
            {id: 'basket', ad: _('Maçlar'), aciklama: _('Hakemlik görevlerim ve maçlar'), ikon: 'basket', sayfa: new BasketSayfa(o)},
            {id: 'anime', ad: _('Anime ve manga'), aciklama: _('Takip ettiklerim'), ikon: 'anime', sayfa: new AnimeSayfa(o)},
            {id: 'oyun', ad: _('Oyunlar'), aciklama: _('PS Plus, ücretsiz ve indirimdeki oyunlar, fiyat arama'), ikon: 'input-gaming-symbolic', sayfa: new OyunSayfa(o)},
            {id: 'akis', ad: _('Akış'), aciklama: _('FLUGEL Akış: haberler, oyun, anime, takip'), ikon: 'view-list-symbolic', sayfa: new AkisSayfa(o)},
            {id: 'bildirim', ad: _('Bildirimler'), aciklama: _('Sunucudan gelen son 24 saat; kategori susturma'), ikon: 'preferences-system-notifications-symbolic', sayfa: new BildirimlerSayfa(o)},
        ];
        this._kart = new Kart({ayarlar: this._ayar, veri: this._veri, sayfalar, ayarlariAc: () => this.openPreferences(),
            tepsi: new Tepsi(), ustCubuk: o.ustCubuk});
        this._ada = new IslandGorunumu({ayarlar: this._ayar, yonetici: this._yonetici, kart: this._kart, ekip: this._ekip});
        this._ustCubuk = new UstCubuk(this._ayar, this._ada.capa);
        this._ustCubuk.enable();

        // Saat artık adada: GNOME'un saati görünmez olur ama yerinde kalır; takvim/bildirim menüsü
        // (sağ tık ya da Super+V) yine ondan açılır.
        this._tarihMenu = Main.panel.statusArea.dateMenu;
        this._tarihMenu.opacity = 0;

        this._ortam = {
            ...o,
            sekmeAc: id => {
                this._kart.sekmeSec(id);
                this._yonetici.setPinned(true);
            },
            adaGorunur: monitor => this._ada.gorunurMu(monitor),
            adaKok: () => this._ada?._kok,
        };
        this._saglayicilar = [];
        this._saglayicilariKur();
        this._ayarIdleri = ['changed::etkin-saglayicilar', 'changed::oncelik-sirasi'].map(s =>
            this._ayar.connect(s, () => this._saglayicilariKur()));

        // kısa süreli etkinlikler: sabit tik yok; sadece en yakın bitiş anında uyanılır
        this._sureAbone = this._yonetici.subscribe(() => this._sureyiPlanla());
        this._veri.baslat();
    }

    // yeni sürümde eklenen canlı etkinlik kaynakları, kullanıcının kayıtlı listelerine de eklenir (bir kez)
    _ayarGoc() {
        const a = this._ayar;
        if (a.get_int('ayar-surumu') >= 3)
            return;
        const yeni = ['zamanlayici', 'indirme', 'odak'];
        for (const k of ['etkin-saglayicilar', 'oncelik-sirasi']) {
            const l = a.get_strv(k);
            const eksik = yeni.filter(x => !l.includes(x));
            if (eksik.length) {
                const i = Math.max(0, l.indexOf('media') + 1);
                a.set_strv(k, [...l.slice(0, i), ...eksik, ...l.slice(i)]);
            }
        }
        a.set_int('ayar-surumu', 3);
    }

    _saglayicilariKur() {
        this._saglayicilariKapat();
        const etkin = new Set(this._ayar.get_strv('etkin-saglayicilar'));
        for (const [id, yap] of Object.entries(SAGLAYICILAR)) {
            if (!etkin.has(id))
                continue;
            try {
                const s = yap(this._ortam);
                const sonuc = s.enable(this._yonetici, this._ayar);
                // bazı sağlayıcılar (güç) eşzamansız başlar; hatası kabuğu düşürmesin
                sonuc?.catch?.(e => console.error(`FLUGEL Island: ${id} başlatılamadı`, e));
                this._saglayicilar.push(s);
            } catch (e) {
                console.error(`FLUGEL Island: ${id} başlatılamadı`, e);
            }
        }
    }

    _saglayicilariKapat() {
        for (const s of (this._saglayicilar ?? []).reverse()) {
            try {
                s.disable();
            } catch (e) {
                console.error(`FLUGEL Island: ${s.id} kapatılamadı`, e);
            }
        }
        this._saglayicilar = [];
    }

    _sureyiPlanla() {
        if (this._sureId)
            GLib.source_remove(this._sureId);
        this._sureId = 0;
        const us = this._yonetici?.nextExpiry() ?? -1;
        if (us < 0)
            return;
        this._sureId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.ceil(us / 1000) + 5, () => {
            this._sureId = 0;
            this._yonetici.tick();
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        this._sureAbone?.();
        if (this._sureId)
            GLib.source_remove(this._sureId);
        this._sureId = 0;
        this._ayarIdleri?.forEach(id => this._ayar.disconnect(id));
        this._ayarIdleri = null;
        this._saglayicilariKapat();
        this._veri?.destroy();
        this._ustCubuk?.disable();
        this._ustCubuk = null;
        this._ada?.destroy();
        this._kart?.destroy();
        if (this._tarihMenu)
            this._tarihMenu.opacity = 255;
        this._tarihMenu = null;
        pano.durdur();
        this._uyku?.destroy();
        this._uyku = null;
        this._guncelleme?.destroy();
        this._guncelleme = null;
        this._dock?.disable();
        this._dock = null;
        this._pip?.disable();
        this._pencere?.disable();
        this._tasarruf?.destroy();
        this._gucAbone?.();
        this._guc?.destroy();
        this._ekip?.destroy();
        this._panik?.destroy();
        this._yonetici?.destroy();
        bilesenleriTemizle();
        ikonOnbellegiTemizle();
        this._ada = this._kart = this._veri = this._pencere = this._pip = this._tasarruf = this._guc = null;
        this._ekip = this._panik = this._yonetici = this._ortam = this._ayar = null;
    }
}
