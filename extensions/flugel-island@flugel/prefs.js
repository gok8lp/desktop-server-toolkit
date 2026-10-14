// FLUGEL Island — ayarlar penceresi (Adwaita).
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SAGLAYICI_ADLARI = {
    'privacy': ['Ekran kaydı, mikrofon, kamera', 'Kayıt/paylaşım sürerken ya da mikrofon/kamera kullanımdayken'],
    'panik': ['Panik modu', 'Panikle gizlenen pencereler varken; tek tıkla geri al'],
    'sunucu': ['Sunucu uyarısı', 'flugelserver\'da sorun olunca (aynı sorun kapatılınca tekrar gelmez)'],
    'gpu-vm': ['Windows (GPU) açık', 'GPU sanal makinedeyken yerel yapay zekâ durur'],
    'media': ['Çalan medya', 'Kapak, başlık, önceki / oynat-duraklat / sonraki'],
    'basket': ['Hakemlik maçı', 'Bugün görevin varsa; maç yaklaşınca geri sayım'],
    'anime': ['Anime bölümü', 'İzlediğin dizinin bölümü yaklaşınca / çıkınca'],
    'kripto': ['Kripto büyük değişim', 'BTC/ETH 24 saatte eşikten fazla değişince'],
    'osd': ['Ses ve parlaklık', 'Ses, ekran parlaklığı, klavye ışığı değişince'],
    'power': ['Şarj ve pil', 'Şarj takılınca/çıkınca, pil azalınca; boşta mini pil göstergesi'],
    'cihaz': ['Klavye ve fare', 'K380s / G305 bağlanınca pil yüzdesi, pili azalınca uyarı'],
    'notification': ['Bildirim afişi', 'Gelen bildirimleri adada da göster (isteğe bağlı)'],
    'akis': ['FLUGEL Akış takip kelimesi', 'Takip ettiğin bir kelime haberlerde geçince'],
    'keyboard': ['Caps Lock / klavye düzeni', 'Değişince kısa süre göster (isteğe bağlı)'],
};

function sayiSatiri(ayar, anahtar, baslik, alt, min, max, adim, ondalik = 0) {
    const row = new Adw.SpinRow({
        title: baslik, subtitle: alt ?? '', digits: ondalik,
        adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: adim, page_increment: adim * 10}),
    });
    ayar.bind(anahtar, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function anahtarSatiri(ayar, anahtar, baslik, alt) {
    const row = new Adw.SwitchRow({title: baslik, subtitle: alt ?? ''});
    ayar.bind(anahtar, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

export default class FlugelIslandAyarlari extends ExtensionPreferences {
    fillPreferencesWindow(pencere) {
        const ayar = this.getSettings();
        pencere.set_default_size(720, 820);
        pencere.add(this._genel(ayar, pencere));
        this._idler = [];
        pencere.add(this._etkinlikler(ayar));
        pencere.connect('close-request', () => {
            this._idler.forEach(id => ayar.disconnect(id));
            this._idler = [];
            return false;
        });
        pencere.add(this._yenileme(ayar));
    }

    _genel(ayar, pencere) {
        const sayfa = new Adw.PreferencesPage({title: 'Genel', icon_name: 'preferences-system-symbolic'});

        const davranis = new Adw.PreferencesGroup({title: 'Davranış'});
        const tetik = new Adw.ComboRow({title: 'Kartı açma', subtitle: 'Kapsüle tıklamak her zaman kartı açık tutar',
            model: Gtk.StringList.new(['Üzerine gelince', 'Sadece tıklayınca'])});
        tetik.selected = ayar.get_string('tetik') === 'click' ? 1 : 0;
        tetik.connect('notify::selected', () => ayar.set_string('tetik', tetik.selected === 1 ? 'click' : 'hover'));
        davranis.add(tetik);
        davranis.add(sayiSatiri(ayar, 'hover-gecikme', 'Üzerine gelince açılma gecikmesi', 'milisaniye', 0, 2000, 20));
        davranis.add(sayiSatiri(ayar, 'monitor', 'Ekran', '-1 = birincil ekran; 0, 1… = ekran sırası', -1, 7, 1));
        sayfa.add(davranis);

        const gorunum = new Adw.PreferencesGroup({title: 'Görünüm',
            description: 'Sistemde "Animasyonları azalt" açıksa ada animasyonsuz değişir'});
        gorunum.add(sayiSatiri(ayar, 'genislik-carpani', 'Kapsül genişliği', 'çarpan', 0.6, 2.0, 0.05, 2));
        gorunum.add(sayiSatiri(ayar, 'kart-genislik', 'Kart genişliği', 'mantıksal piksel', 460, 900, 10));
        gorunum.add(sayiSatiri(ayar, 'saydamlik', 'Opaklık', '% (100 = tam siyah)', 40, 100, 1));
        gorunum.add(sayiSatiri(ayar, 'animasyon-hizi', 'Animasyon hızı', 'çarpan (1 = iOS gibi)', 0.5, 2.0, 0.05, 2));
        gorunum.add(anahtarSatiri(ayar, 'ekip-kapsulde', 'Kapsülde Re:Zero karakteri'));
        gorunum.add(anahtarSatiri(ayar, 'ekip-otomatik', 'Karakteri otomatik değiştir', 'pildeyken 4 kat seyrek, salınım yok'));
        sayfa.add(gorunum);

        const eski = new Adw.PreferencesGroup({title: 'Eski panel',
            description: 'FLUGEL v1 paneli silinmedi. Geri dönersen Island kapanır, eski üst çubuk düğmeleri gelir. ' +
                'Tekrar Island\'a geçmek için Eklentiler uygulamasından ikisini yer değiştir.'});
        const don = new Adw.ButtonRow({title: 'Eski panele dön', start_icon_name: 'edit-undo-symbolic'});
        don.add_css_class('destructive-action');
        don.connect('activated', () => {
            const soru = new Adw.AlertDialog({heading: 'Eski panele dönülsün mü?',
                body: 'FLUGEL Island kapatılır, FLUGEL v1 paneli açılır. Ayarların silinmez.'});
            soru.add_response('vazgec', 'Vazgeç');
            soru.add_response('don', 'Eski panele dön');
            soru.set_response_appearance('don', Adw.ResponseAppearance.DESTRUCTIVE);
            soru.connect('response', (_d, yanit) => {
                if (yanit !== 'don')
                    return;
                const kabuk = new Gio.Settings({schema_id: 'org.gnome.shell'});
                const etkin = kabuk.get_strv('enabled-extensions').filter(u => u !== this.uuid);
                if (!etkin.includes('flugel-panel@flugel'))
                    etkin.push('flugel-panel@flugel');
                kabuk.set_strv('enabled-extensions', etkin);
                pencere.close();
            });
            soru.present(pencere);
        });
        eski.add(don);
        sayfa.add(eski);
        return sayfa;
    }

    _etkinlikler(ayar) {
        const sayfa = new Adw.PreferencesPage({title: 'Canlı etkinlikler', icon_name: 'view-list-symbolic'});
        const liste = new Adw.PreferencesGroup({title: 'Kaynaklar ve öncelik',
            description: 'Üstteki daha önemli: aynı anda iki etkinlik varsa üstteki kapsülde, ikincisi yandaki balonda görünür'});
        sayfa.add(liste);
        let satirlar = [];
        const kur = () => {
            satirlar.forEach(r => liste.remove(r));
            satirlar = [];
            const sira = ayar.get_strv('oncelik-sirasi');
            for (const id of Object.keys(SAGLAYICI_ADLARI)) {
                if (!sira.includes(id))
                    sira.push(id);
            }
            const etkin = new Set(ayar.get_strv('etkin-saglayicilar'));
            sira.forEach((id, i) => {
                const [baslik, alt] = SAGLAYICI_ADLARI[id] ?? [id, ''];
                const row = new Adw.ActionRow({title: `${i + 1}. ${baslik}`, subtitle: alt});
                const yukari = new Gtk.Button({icon_name: 'go-up-symbolic', valign: Gtk.Align.CENTER, sensitive: i > 0,
                    tooltip_text: 'Önceliği artır'});
                const asagi = new Gtk.Button({icon_name: 'go-down-symbolic', valign: Gtk.Align.CENTER, sensitive: i < sira.length - 1,
                    tooltip_text: 'Önceliği azalt'});
                for (const b of [yukari, asagi])
                    b.add_css_class('flat');
                const tasi = yon => {
                    const yeni = [...sira];
                    [yeni[i], yeni[i + yon]] = [yeni[i + yon], yeni[i]];
                    ayar.set_strv('oncelik-sirasi', yeni);
                };
                yukari.connect('clicked', () => tasi(-1));
                asagi.connect('clicked', () => tasi(1));
                const sw = new Gtk.Switch({active: etkin.has(id), valign: Gtk.Align.CENTER});
                sw.connect('notify::active', () => {
                    const e = new Set(ayar.get_strv('etkin-saglayicilar'));
                    if (sw.active)
                        e.add(id);
                    else
                        e.delete(id);
                    ayar.set_strv('etkin-saglayicilar', [...e]);
                });
                row.add_suffix(yukari);
                row.add_suffix(asagi);
                row.add_suffix(sw);
                liste.add(row);
                satirlar.push(row);
            });
        };
        kur();
        this._idler.push(ayar.connect('changed::oncelik-sirasi', kur));

        const esik = new Adw.PreferencesGroup({title: 'Eşikler ve süreler'});
        esik.add(anahtarSatiri(ayar, 'osd-yerine', 'Ses/parlaklıkta GNOME göstergesi yerine Island',
            'Tam ekran oyunda Island gizliyken GNOME\'un göstergesi yine çıkar'));
        esik.add(sayiSatiri(ayar, 'transient-duration-ms', 'Kısa bildirimlerin süresi', 'milisaniye', 500, 10000, 100));
        esik.add(sayiSatiri(ayar, 'kripto-esik', 'Kripto değişim eşiği', '% (24 saat)', 1, 50, 0.5, 1));
        esik.add(sayiSatiri(ayar, 'basket-yakin-dk', 'Maç yaklaşıyor', 'dakika kala', 15, 720, 15));
        esik.add(sayiSatiri(ayar, 'anime-yakin-dk', 'Anime bölümü yaklaşıyor', 'dakika kala', 5, 720, 5));
        esik.add(sayiSatiri(ayar, 'power-low-threshold', 'Düşük pil uyarısı', '%', 5, 50, 1));
        esik.add(sayiSatiri(ayar, 'cihaz-dusuk-esik', 'Klavye/fare pili düşük', '%', 5, 50, 1));
        esik.add(sayiSatiri(ayar, 'notification-coalesce-threshold', 'Bildirimleri topla', 'bu sayıdan sonra tek satır', 1, 20, 1));
        esik.add(anahtarSatiri(ayar, 'keyboard-flash-caps-lock', 'Caps Lock değişimini göster'));
        esik.add(anahtarSatiri(ayar, 'keyboard-flash-layout-switch', 'Klavye düzeni değişimini göster'));
        const sifirla = new Adw.ButtonRow({title: 'Kapatılan sunucu uyarısını yeniden göster'});
        sifirla.connect('activated', () => ayar.reset('sunucu-goruldu'));
        esik.add(sifirla);
        sayfa.add(esik);
        return sayfa;
    }

    _yenileme(ayar) {
        const sayfa = new Adw.PreferencesPage({title: 'Yenileme', icon_name: 'view-refresh-symbolic'});
        const g = new Adw.PreferencesGroup({title: 'Yenileme aralıkları',
            description: 'Ekran kilitliyken hiç sorgu yapılmaz. Pildeyken ya da Pil Tasarrufu açıkken aralıklar çarpanla uzar.'});
        g.add(sayiSatiri(ayar, 'yenileme-sunucu', 'Sunucu durumu', 'saniye', 10, 600, 5));
        g.add(sayiSatiri(ayar, 'yenileme-kripto', 'Kripto ve döviz', 'saniye', 15, 600, 5));
        g.add(sayiSatiri(ayar, 'yenileme-pc', 'Bu PC', 'saniye', 5, 600, 5));
        g.add(sayiSatiri(ayar, 'yenileme-anime', 'Anime listesi', 'saniye', 300, 7200, 60));
        g.add(sayiSatiri(ayar, 'pil-carpani', 'Pildeyken çarpan', 'kat', 1, 10, 1));
        sayfa.add(g);
        return sayfa;
    }
}
