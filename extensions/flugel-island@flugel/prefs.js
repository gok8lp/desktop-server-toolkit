// FLUGEL Island — ayarlar penceresi (Adwaita, her zaman koyu). Şemadaki her anahtar bir kontrole bağlıdır;
// değişiklikler anında uygulanır. Yeniden başlatma isteyen ayarların yanında yazar.
// Sayfalar: Genel · Island görünümü · Animasyon · Canlı etkinlikler · Kısayollar · Sanal makineler · Kripto ·
// Maçlar · Anime & Manga · Dock · Gelişmiş. Her sayfada "varsayılana dön".
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GioUnix from 'gi://GioUnix';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {dilKur, _, f} from './src/dil.js';

const SAGLAYICILAR = () => ({
    'privacy': [_('Ekran kaydı, mikrofon, kamera'), _('Kayıt/paylaşım sürerken ya da mikrofon/kamera kullanımdayken')],
    'bildirim': [_('Bildirimler adadan'), _('Yeni bildirim adadan animasyonlu afiş olarak açılır (GNOME afişi yerine)')],
    'panik': [_('Panik modu'), _('Panikle gizlenen pencereler varken; tek tıkla geri al')],
    'sunucu': [_('Sunucu uyarısı'), _('Sunucuda sorun olunca (aynı sorun kapatılınca tekrar gelmez)')],
    'gpu-vm': [_('Windows (GPU) açık'), _('GPU sanal makinedeyken yerel yapay zekâ durur')],
    'media': [_('Çalan medya'), _('Kapak, başlık, önceki / oynat-duraklat / sonraki')],
    'basket': [_('Maçlar'), _('Bugün hakemlik görevin varsa; canlı maç skoru')],
    'anime': [_('Anime bölümü'), _('İzlediğin dizinin bölümü yaklaşınca / çıkınca')],
    'kripto': [_('Kripto büyük değişim'), _('BTC/ETH 24 saatte eşikten fazla değişince')],
    'osd': [_('Ses ve parlaklık'), _('Ses, ekran parlaklığı, klavye ışığı değişince')],
    'power': [_('Şarj ve pil'), _('Şarj takılınca/çıkınca, pil azalınca; boşta mini pil göstergesi')],
    'cihaz': [_('Klavye ve fare'), _('Kablosuz klavye/fare bağlanınca pil yüzdesi, pili azalınca uyarı')],
    'notification': [_('Bildirim afişi'), _('Gelen bildirimleri adada da göster')],
    'akis': [_('FLUGEL Akış takip kelimesi'), _('Takip ettiğin bir kelime haberlerde geçince')],
    'keyboard': [_('Caps Lock / klavye düzeni'), _('Değişince kısa süre göster')],
});
const VM_ADLARI = {'W11-GPU': 'Windows (GPU)', 'W11': 'Windows', 'mullvad-ts': 'Ubuntu VPN'};
const DOCK_SEMA = 'org.gnome.shell.extensions.dash-to-dock';

function sayi(ayar, anahtar, baslik, alt, min, max, adim, ondalik = 0) {
    const row = new Adw.SpinRow({title: baslik, subtitle: alt ?? '', digits: ondalik,
        adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: adim, page_increment: adim * 10})});
    ayar.bind(anahtar, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function anahtar(ayar, k, baslik, alt) {
    const row = new Adw.SwitchRow({title: baslik, subtitle: alt ?? ''});
    ayar.bind(k, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function secim(ayar, k, baslik, alt, degerler) {
    // degerler: [[değer, etiket], …]
    const row = new Adw.ComboRow({title: baslik, subtitle: alt ?? '', model: Gtk.StringList.new(degerler.map(d => d[1]))});
    const oku = () => {
        const i = degerler.findIndex(d => d[0] === ayar.get_string(k));
        row.selected = Math.max(0, i);
    };
    oku();
    row.connect('notify::selected', () => {
        const d = degerler[row.selected];
        if (d && ayar.get_string(k) !== d[0])
            ayar.set_string(k, d[0]);
    });
    return [row, ayar.connect(`changed::${k}`, oku)];
}

function sifirla(ayar, anahtarlar, sayfa) {
    const g = new Adw.PreferencesGroup();
    const b = new Adw.ButtonRow({title: _('Bu sayfayı varsayılana döndür'), start_icon_name: 'edit-undo-symbolic'});
    b.connect('activated', () => anahtarlar.forEach(k => ayar.reset(k)));
    g.add(b);
    sayfa.add(g);
}

export default class FlugelIslandAyarlari extends ExtensionPreferences {
    fillPreferencesWindow(pencere) {
        const ayar = this.getSettings();
        dilKur(this.path, ayar.get_string('dil'));
        this._ayar = ayar;
        this._idler = [];
        pencere.set_default_size(760, 860);
        pencere.search_enabled = true;
        // FLUGEL kimliği: ayar penceresi de her zaman koyu ve vurgu rengi nötr (sistem turuncusu yok)
        Adw.StyleManager.get_default().color_scheme = Adw.ColorScheme.FORCE_DARK;
        const css = new Gtk.CssProvider();
        css.load_from_string(':root { --accent-bg-color: #e8e8ec; --accent-fg-color: #000000; --accent-color: #f2f2f4; }');
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        pencere.connect('close-request', () => {
            Gtk.StyleContext.remove_provider_for_display(Gdk.Display.get_default(), css);
            this._idler.forEach(([nesne, id]) => nesne.disconnect(id));
            this._idler = [];
            return false;
        });
        for (const sayfa of [this._genel(pencere), this._gorunum(), this._animasyon(), this._etkinlikler(),
            this._kisayollar(), this._vm(), this._kripto(), this._maclar(), this._anime(), this._dock(), this._gelismis(pencere)])
            pencere.add(sayfa);
    }

    _baglan(nesne, id) {
        this._idler.push([nesne, id]);
    }

    // ---------- Genel ----------
    _genel(pencere) {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Genel'), icon_name: 'preferences-system-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Dil ve davranış')});
        const [dil, dilId] = secim(a, 'dil', _('Dil'), _('Değişince Island yeniden başlatılır; bu pencereyi kapatıp aç'),
            [['sistem', _('Sistem dili')], ['tr', 'Türkçe'], ['en', 'English']]);
        this._baglan(a, dilId);
        this._baglan(a, a.connect('changed::dil', () => this._yenidenBaslat()));
        g.add(dil);
        g.add(anahtar(a, 'ust-cubuk-sade', _('Üst çubukta sadece Island'),
            _('Saat, pil, Hızlı Ayarlar, tepsi, Etkinlikler ve çalışma alanları adanın içinde; kısayollar çalışır')));
        const [tetik, tetikId] = secim(a, 'tetik', _('Kartı açma'), _('Kapsüle tıklamak her zaman kartı açık tutar'),
            [['hover', _('Üzerine gelince')], ['click', _('Sadece tıklayınca')]]);
        this._baglan(a, tetikId);
        g.add(tetik);
        const [te, teId] = secim(a, 'tam-ekran-kipi', _('Tam ekranda ada'),
            _('Ekranın üst kenarına yapışık çentik olur; fare üst ortaya gelince aşağı kayar'),
            [['gizli', _('Sadece fareyle (oyun modu)')], ['bildirim', _('Bildirim ve ses/parlaklıkta da')], ['canli', _('Canlı etkinliklerde de (maç skoru…)')]]);
        this._baglan(a, teId);
        g.add(te);
        g.add(sayi(a, 'hover-gecikme', _('Üzerine gelince açılma gecikmesi'), _('milisaniye'), 0, 2000, 20));
        g.add(sayi(a, 'monitor', _('Ekran'), _('-1 = birincil ekran; 0, 1… = ekran sırası'), -1, 7, 1));
        const [panik, panikId] = secim(a, 'panik-onay', _('Panik onayı'), _('Yanlışlıkla basılmasın'),
            [['cift', _('İkinci tık')], ['basili', _('0,6 sn basılı tut')]]);
        this._baglan(a, panikId);
        g.add(panik);
        sayfa.add(g);

        const eski = new Adw.PreferencesGroup({title: _('Eski panel'),
            description: _('FLUGEL v1 paneli silinmedi. Geri dönersen Island kapanır, eski üst çubuk düğmeleri gelir.')});
        const don = new Adw.ButtonRow({title: _('Eski panele dön'), start_icon_name: 'edit-undo-symbolic'});
        don.add_css_class('destructive-action');
        don.connect('activated', () => this._eskiPanel(pencere));
        eski.add(don);
        sayfa.add(eski);
        sifirla(a, ['dil', 'ust-cubuk-sade', 'tetik', 'hover-gecikme', 'monitor', 'panik-onay'], sayfa);
        return sayfa;
    }

    _eskiPanel(pencere) {
        const soru = new Adw.AlertDialog({heading: _('Eski panele dönülsün mü?'),
            body: _('FLUGEL Island kapatılır, FLUGEL v1 paneli açılır. Ayarların silinmez.')});
        soru.add_response('vazgec', _('Vazgeç'));
        soru.add_response('don', _('Eski panele dön'));
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
    }

    // eklentiyi kapat-aç (dil gibi kurulumda okunan ayarlar için); kabuk D-Bus'ı üzerinden
    _yenidenBaslat() {
        const cagir = (yontem, sonra) => Gio.DBus.session.call('org.gnome.Shell.Extensions', '/org/gnome/Shell/Extensions',
            'org.gnome.Shell.Extensions', yontem, new GLib.Variant('(s)', [this.uuid]), null, Gio.DBusCallFlags.NONE, -1, null,
            () => sonra?.());
        cagir('DisableExtension', () => cagir('EnableExtension'));
    }

    // ---------- Island görünümü ----------
    _gorunum() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Island görünümü'), icon_name: 'applications-graphics-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Boyut ve renk'), description: _('Karanlık tema sabittir; renkler siyah-beyaz')});
        g.add(sayi(a, 'genislik-carpani', _('Kapsül genişliği'), _('çarpan'), 0.6, 2.0, 0.05, 2));
        g.add(sayi(a, 'kart-genislik', _('Kart genişliği'), _('mantıksal piksel; ızgaralar Island yeniden başlayınca uyar'), 560, 960, 10));
        g.add(sayi(a, 'saydamlik', _('Kapsül opaklığı'), _('% (100 = tam siyah)'), 40, 100, 1));
        g.add(sayi(a, 'kart-saydamlik', _('Kart opaklığı'), _('% (koyu nötr cam)'), 60, 100, 1));
        g.add(anahtar(a, 'ekip-surpriz', _('Re:Zero sürprizi'), _('Ara sıra bir karakter adanın kenarında görünür; kapsüle 5 hızlı tık da çağırır')));
        const yb = new Adw.ButtonRow({title: _('Island\'ı şimdi yeniden başlat'), start_icon_name: 'view-refresh-symbolic'});
        yb.connect('activated', () => this._yenidenBaslat());
        g.add(yb);
        sayfa.add(g);
        sifirla(a, ['genislik-carpani', 'kart-genislik', 'saydamlik', 'kart-saydamlik', 'ekip-surpriz'], sayfa);
        return sayfa;
    }

    // ---------- Animasyon ----------
    _animasyon() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Animasyon'), icon_name: 'media-playlist-repeat-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Hareket'),
            description: _('Sistemde "Animasyonları azalt" açıksa her geçiş anında olur. Pildeyken ağır efektler kapanır.')});
        g.add(sayi(a, 'animasyon-hizi', _('Animasyon hızı'), _('çarpan (1 = varsayılan yay)'), 0.5, 2.0, 0.05, 2));
        g.add(sayi(a, 'transient-duration-ms', _('Kısa bildirimlerin süresi'), _('milisaniye'), 500, 10000, 100));
        sayfa.add(g);
        sifirla(a, ['animasyon-hizi', 'transient-duration-ms'], sayfa);
        return sayfa;
    }

    // ---------- Canlı etkinlikler ----------
    _etkinlikler() {
        const a = this._ayar;
        const ADLAR = SAGLAYICILAR();
        const sayfa = new Adw.PreferencesPage({title: _('Canlı etkinlikler'), icon_name: 'view-list-symbolic'});
        const liste = new Adw.PreferencesGroup({title: _('Kaynaklar ve öncelik'),
            description: _('Üstteki daha önemli: iki etkinlik varsa üstteki kapsülde, ikincisi yandaki balonda')});
        sayfa.add(liste);
        let satirlar = [];
        const kur = () => {
            satirlar.forEach(r => liste.remove(r));
            satirlar = [];
            const sira = a.get_strv('oncelik-sirasi');
            for (const id of Object.keys(ADLAR)) {
                if (!sira.includes(id))
                    sira.push(id);
            }
            const etkin = new Set(a.get_strv('etkin-saglayicilar'));
            sira.forEach((id, i) => {
                const [baslik, alt] = ADLAR[id] ?? [id, ''];
                const row = new Adw.ActionRow({title: `${i + 1}. ${baslik}`, subtitle: alt});
                const tasi = yon => {
                    const yeni = [...sira];
                    [yeni[i], yeni[i + yon]] = [yeni[i + yon], yeni[i]];
                    a.set_strv('oncelik-sirasi', yeni);
                };
                for (const [ik, yon, ipucu, etkinMi] of [['go-up-symbolic', -1, _('Önceliği artır'), i > 0],
                    ['go-down-symbolic', 1, _('Önceliği azalt'), i < sira.length - 1]]) {
                    const b = new Gtk.Button({icon_name: ik, valign: Gtk.Align.CENTER, sensitive: etkinMi, tooltip_text: ipucu});
                    b.add_css_class('flat');
                    b.connect('clicked', () => tasi(yon));
                    row.add_suffix(b);
                }
                const sw = new Gtk.Switch({active: etkin.has(id), valign: Gtk.Align.CENTER});
                sw.connect('notify::active', () => {
                    const e = new Set(a.get_strv('etkin-saglayicilar'));
                    if (sw.active)
                        e.add(id);
                    else
                        e.delete(id);
                    a.set_strv('etkin-saglayicilar', [...e]);
                });
                row.add_suffix(sw);
                liste.add(row);
                satirlar.push(row);
            });
        };
        kur();
        this._baglan(a, a.connect('changed::oncelik-sirasi', kur));
        this._baglan(a, a.connect('changed::etkin-saglayicilar', kur));

        const esik = new Adw.PreferencesGroup({title: _('Eşikler')});
        esik.add(anahtar(a, 'osd-yerine', _('Ses/parlaklıkta GNOME göstergesi yerine Island'),
            _('Tam ekranda Island gizliyken GNOME\'un göstergesi yine çıkar')));
        esik.add(sayi(a, 'bildirim-sure', _('Bildirim afişi süresi'), _('milisaniye'), 2000, 20000, 500));
        esik.add(sayi(a, 'power-low-threshold', _('Düşük pil uyarısı'), '%', 5, 50, 1));
        esik.add(sayi(a, 'cihaz-dusuk-esik', _('Klavye/fare pili düşük'), '%', 5, 50, 1));
        esik.add(sayi(a, 'notification-coalesce-threshold', _('Bildirimleri topla'), _('bu sayıdan sonra tek satır'), 1, 20, 1));
        const haric = new Adw.EntryRow({title: _('Bildirimde gösterilmeyecek uygulamalar (virgülle, .desktop kimliği)'),
            text: a.get_strv('notification-excluded-apps').join(', '), show_apply_button: true});
        haric.connect('apply', () => a.set_strv('notification-excluded-apps',
            haric.text.split(',').map(x => x.trim()).filter(Boolean)));
        esik.add(haric);
        esik.add(anahtar(a, 'keyboard-flash-caps-lock', _('Caps Lock değişimini göster')));
        esik.add(anahtar(a, 'keyboard-flash-layout-switch', _('Klavye düzeni değişimini göster')));
        const goster = new Adw.ButtonRow({title: _('Kapatılan sunucu uyarısını yeniden göster')});
        goster.connect('activated', () => a.reset('sunucu-goruldu'));
        esik.add(goster);
        sayfa.add(esik);
        sifirla(a, ['etkin-saglayicilar', 'oncelik-sirasi', 'osd-yerine', 'power-low-threshold', 'cihaz-dusuk-esik',
            'notification-coalesce-threshold', 'notification-excluded-apps', 'keyboard-flash-caps-lock',
            'keyboard-flash-layout-switch'], sayfa);
        return sayfa;
    }

    // ---------- Kısayollar: sabitlenmiş uygulamalar ----------
    _kisayollar() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Kısayollar'), icon_name: 'view-app-grid-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Sabitlenmiş uygulamalar'),
            description: _('Hızlı ve Kısayollar sekmesinin en üstünde, bu sırayla')});
        sayfa.add(g);
        let satirlar = [];
        const kur = () => {
            satirlar.forEach(r => g.remove(r));
            satirlar = [];
            const liste = a.get_strv('sabit-uygulamalar');
            liste.forEach((id, i) => {
                const app = GioUnix.DesktopAppInfo.new(id);
                const row = new Adw.ActionRow({title: app?.get_name() ?? id, subtitle: id});
                if (app?.get_icon())
                    row.add_prefix(new Gtk.Image({gicon: app.get_icon(), pixel_size: 32}));
                for (const [ik, yon] of [['go-up-symbolic', -1], ['go-down-symbolic', 1]]) {
                    const b = new Gtk.Button({icon_name: ik, valign: Gtk.Align.CENTER, sensitive: yon < 0 ? i > 0 : i < liste.length - 1});
                    b.add_css_class('flat');
                    b.connect('clicked', () => {
                        const yeni = [...liste];
                        [yeni[i], yeni[i + yon]] = [yeni[i + yon], yeni[i]];
                        a.set_strv('sabit-uygulamalar', yeni);
                    });
                    row.add_suffix(b);
                }
                const sil = new Gtk.Button({icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER, tooltip_text: _('Kaldır')});
                sil.add_css_class('flat');
                sil.connect('clicked', () => a.set_strv('sabit-uygulamalar', liste.filter(x => x !== id)));
                row.add_suffix(sil);
                g.add(row);
                satirlar.push(row);
            });
        };
        kur();
        this._baglan(a, a.connect('changed::sabit-uygulamalar', kur));

        const ekle = new Adw.PreferencesGroup({title: _('Uygulama ekle')});
        const uygulamalar = Gio.AppInfo.get_all().filter(x => x.should_show()).sort((x, y) => x.get_name().localeCompare(y.get_name(), 'tr'));
        const secici = new Adw.ComboRow({title: _('Uygulama'), model: Gtk.StringList.new(uygulamalar.map(x => x.get_name())),
            enable_search: true});
        ekle.add(secici);
        const ekleBtn = new Adw.ButtonRow({title: _('Sabitle'), start_icon_name: 'list-add-symbolic'});
        ekleBtn.connect('activated', () => {
            const id = uygulamalar[secici.selected]?.get_id();
            const liste = a.get_strv('sabit-uygulamalar');
            if (id && !liste.includes(id))
                a.set_strv('sabit-uygulamalar', [...liste, id]);
        });
        ekle.add(ekleBtn);
        sayfa.add(ekle);
        sifirla(a, ['sabit-uygulamalar'], sayfa);
        return sayfa;
    }

    // ---------- Sanal makineler ----------
    _vm() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Sanal makineler'), icon_name: 'computer-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Gösterilen sanal makineler'),
            description: _('Kapatma her zaman nazik (ACPI); zorla kapatma yoktur')});
        for (const [ad, etiket] of Object.entries(VM_ADLARI)) {
            const row = new Adw.SwitchRow({title: etiket, subtitle: ad, active: !a.get_strv('vm-gizli').includes(ad)});
            row.connect('notify::active', () => {
                const gizli = new Set(a.get_strv('vm-gizli'));
                if (row.active)
                    gizli.delete(ad);
                else
                    gizli.add(ad);
                a.set_strv('vm-gizli', [...gizli]);
            });
            g.add(row);
        }
        g.add(sayi(a, 'yenileme-sunucu', _('Durum yenileme'), _('saniye (sunucu durumu ile birlikte)'), 10, 600, 5));
        sayfa.add(g);
        sifirla(a, ['vm-gizli', 'yenileme-sunucu'], sayfa);
        return sayfa;
    }

    // ---------- Kripto ----------
    _kripto() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Kripto'), icon_name: 'money-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Varlıklar'), description: _('Kaynak: Binance açık piyasa verisi (anahtarsız)')});
        for (const [k, ad] of [['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['USD', _('Dolar / TL')], ['EUR', _('Euro / TL')]]) {
            const row = new Adw.SwitchRow({title: ad, active: a.get_strv('kripto-varliklar').includes(k)});
            row.connect('notify::active', () => {
                const s = a.get_strv('kripto-varliklar').filter(x => x !== k);
                a.set_strv('kripto-varliklar', row.active ? [...s, k] : s);
            });
            g.add(row);
        }
        g.add(anahtar(a, 'kripto-renk', _('Değişimde renk kullan'), _('Kapalıysa siyah-beyaz')));
        g.add(sayi(a, 'kripto-esik', _('Büyük değişim uyarısı'), _('% (24 saat)'), 1, 50, 0.5, 1));
        g.add(sayi(a, 'yenileme-kripto', _('Fiyat yenileme'), _('saniye'), 15, 600, 5));
        sayfa.add(g);
        sifirla(a, ['kripto-varliklar', 'kripto-renk', 'kripto-esik', 'yenileme-kripto'], sayfa);
        return sayfa;
    }

    // ---------- Maçlar ----------
    _maclar() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Maçlar'), icon_name: 'x-office-calendar-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Maçlar ve hakemlik')});
        g.add(anahtar(a, 'mac-canli-etkinlik', _('Canlı maç kapsülde'), _('Canlı maç olunca skor adada görünür')));
        g.add(sayi(a, 'basket-yakin-dk', _('Maçım yaklaşıyor'), _('dakika kala'), 15, 720, 15));
        g.add(sayi(a, 'yenileme-maclar', _('Maç yenileme'), _('saniye (canlı maç varken sunucu 2 dk\'da bir günceller)'), 60, 3600, 30));
        sayfa.add(g);
        sifirla(a, ['mac-canli-etkinlik', 'basket-yakin-dk', 'yenileme-maclar'], sayfa);
        return sayfa;
    }

    // ---------- Anime & Manga ----------
    _anime() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Anime ve manga'), icon_name: 'media-playback-start-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Anime ve manga'),
            description: _('Sadece MyAnimeList / AniList ve yasal yayın platformlarına bağlantı verilir')});
        g.add(sayi(a, 'anime-yakin-dk', _('Bölüm yaklaşıyor'), _('dakika kala kapsülde göster'), 5, 720, 5));
        g.add(sayi(a, 'yenileme-anime', _('Liste yenileme'), _('saniye'), 300, 7200, 60));
        for (const [k, ad] of [['anime-secili', _('Eklediğin animeler')], ['manga-secili', _('Eklediğin mangalar')]]) {
            const row = new Adw.ActionRow({title: ad, subtitle: f(_('%d adet; kaldırmak için kapağa sağ tıkla'), a.get_strv(k).length)});
            const b = new Gtk.Button({label: _('Temizle'), valign: Gtk.Align.CENTER});
            b.connect('clicked', () => a.reset(k));
            row.add_suffix(b);
            this._baglan(a, a.connect(`changed::${k}`, () => (row.subtitle = f(_('%d adet; kaldırmak için kapağa sağ tıkla'), a.get_strv(k).length))));
            g.add(row);
        }
        sayfa.add(g);
        sifirla(a, ['anime-yakin-dk', 'yenileme-anime', 'anime-secili', 'manga-secili'], sayfa);
        return sayfa;
    }

    // ---------- Dock ----------
    _dock() {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Dock'), icon_name: 'view-more-horizontal-symbolic'});
        const g = new Adw.PreferencesGroup({title: _('Alt dock'), description: _('Ubuntu dock ayarları (Dash to Dock)')});
        g.add(anahtar(a, 'dock-buyume', _('Üzerine gelince büyüme'), _('Simge hafifçe büyür (animasyon kapalıysa/pildeyken yok)')));
        const kaynak = Gio.SettingsSchemaSource.get_default();
        if (kaynak.lookup(DOCK_SEMA, true)) {
            const d = new Gio.Settings({schema_id: DOCK_SEMA});
            g.add(anahtar(d, 'autohide', _('Otomatik gizlen')));
            g.add(anahtar(d, 'intellihide', _('Pencere değince gizlen')));
            g.add(sayi(d, 'dash-max-icon-size', _('Simge boyutu'), 'px', 24, 64, 2));
            g.add(sayi(d, 'background-opacity', _('Dock opaklığı'), _('0–1'), 0, 1, 0.05, 2));
            g.add(anahtar(d, 'show-running', _('Çalışan uygulama noktaları')));
            g.add(anahtar(d, 'show-trash', _('Çöp kutusu')));
            g.add(anahtar(d, 'show-mounts', _('Bağlı diskler')));
            g.add(anahtar(d, 'show-icons-notifications-counter', _('Bildirim rozeti')));
            const [orta, ortaId] = secim(d, 'middle-click-action', _('Orta tık'), '',
                [['launch', _('Yeni pencere')], ['minimize', _('Küçült')], ['quit', _('Kapat')], ['skip', _('Hiçbir şey')]]);
            this._baglan(d, ortaId);
            g.add(orta);
            const [tekerlek, tekerlekId] = secim(d, 'scroll-action', _('Simge üstünde tekerlek'), '',
                [['cycle-windows', _('Pencereler arası geçiş')], ['switch-workspace', _('Çalışma alanı')], ['do-nothing', _('Hiçbir şey')]]);
            this._baglan(d, tekerlekId);
            g.add(tekerlek);
        } else {
            g.add(new Adw.ActionRow({title: _('Dash to Dock / Ubuntu dock bulunamadı')}));
        }
        sayfa.add(g);
        sifirla(a, ['dock-buyume'], sayfa);
        return sayfa;
    }

    // ---------- Gelişmiş ----------
    _gelismis(pencere) {
        const a = this._ayar;
        const sayfa = new Adw.PreferencesPage({title: _('Gelişmiş'), icon_name: 'applications-engineering-symbolic'});
        const y = new Adw.PreferencesGroup({title: _('Yenileme aralıkları'),
            description: _('Ekran kilitliyken hiç sorgu yapılmaz. Pildeyken ya da Pil Tasarrufunda aralıklar çarpanla uzar.')});
        y.add(sayi(a, 'yenileme-sunucu', _('Sunucu durumu'), _('saniye'), 10, 600, 5));
        y.add(sayi(a, 'yenileme-pc', _('Bu PC'), _('saniye'), 5, 600, 5));
        y.add(sayi(a, 'pil-carpani', _('Pildeyken çarpan'), _('kat'), 1, 10, 1));
        sayfa.add(y);

        const gu = new Adw.PreferencesGroup({title: _('Otomatik güncelleme'),
            description: _('apt, snap ve flatpak; dağıtım sürümü ve sürücü ana sürümü değişmez; sonuç bildirim olarak gelir')});
        const [kip, kipId] = secim(a, 'otomatik-guncelleme', _('Sıklık'), '',
            [['kapali', _('Kapalı')], ['gunluk', _('Günlük')], ['haftalik', _('Haftalık (Pazartesi 12:30)')]]);
        this._baglan(a, kipId);
        gu.add(kip);
        const simdi = new Adw.ButtonRow({title: _('Şimdi güncelle'), start_icon_name: 'software-update-available-symbolic'});
        simdi.connect('activated', () => GLib.spawn_command_line_async('systemctl --user start flugel-guncelle.service'));
        gu.add(simdi);
        sayfa.add(gu);

        const s = new Adw.PreferencesGroup({title: _('Sıfırlama ve yedek')});
        const pip = new Adw.ButtonRow({title: _('Resim içinde resim konumunu sıfırla (sol alt)')});
        pip.connect('activated', () => a.reset('pip-konum'));
        s.add(pip);
        const disa = new Adw.ButtonRow({title: _('Ayarları JSON olarak dışa aktar'), start_icon_name: 'document-save-symbolic'});
        disa.connect('activated', () => this._disaAktar(pencere));
        s.add(disa);
        const ice = new Adw.ButtonRow({title: _('JSON\'dan içe aktar'), start_icon_name: 'document-open-symbolic'});
        ice.connect('activated', () => this._iceAktar(pencere));
        s.add(ice);
        const hepsi = new Adw.ButtonRow({title: _('Tüm ayarları varsayılana döndür'), start_icon_name: 'edit-clear-all-symbolic'});
        hepsi.add_css_class('destructive-action');
        hepsi.connect('activated', () => a.settings_schema.list_keys().forEach(k => a.reset(k)));
        s.add(hepsi);
        const don = new Adw.ButtonRow({title: _('Eski panele dön'), start_icon_name: 'edit-undo-symbolic'});
        don.connect('activated', () => this._eskiPanel(pencere));
        s.add(don);
        sayfa.add(s);
        sifirla(a, ['yenileme-sunucu', 'yenileme-pc', 'pil-carpani', 'otomatik-guncelleme'], sayfa);
        return sayfa;
    }

    _disaAktar(pencere) {
        const a = this._ayar;
        const veri = {};
        for (const k of a.settings_schema.list_keys())
            veri[k] = a.get_value(k).deepUnpack();
        const dlg = new Gtk.FileDialog({title: _('Ayarları kaydet'), initial_name: 'flugel-island-ayarlar.json'});
        dlg.save(pencere, null, (d, res) => {
            try {
                const dosya = d.save_finish(res);
                dosya.replace_contents(new TextEncoder().encode(JSON.stringify(veri, null, 2)), null, false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            } catch (e) {
                // vazgeçildi
            }
        });
    }

    _iceAktar(pencere) {
        const a = this._ayar;
        const dlg = new Gtk.FileDialog({title: _('Ayar dosyası seç')});
        dlg.open(pencere, null, (d, res) => {
            try {
                const [, icerik] = d.open_finish(res).load_contents(null);
                const veri = JSON.parse(new TextDecoder().decode(icerik));
                const anahtarlar = new Set(a.settings_schema.list_keys());
                for (const [k, v] of Object.entries(veri)) {
                    if (!anahtarlar.has(k))
                        continue;
                    const tur = a.settings_schema.get_key(k).get_value_type();
                    try {
                        a.set_value(k, new GLib.Variant(tur.dup_string(), v));
                    } catch (e) {
                        // tür uymayan değer atlanır
                    }
                }
            } catch (e) {
                // vazgeçildi ya da bozuk dosya
            }
        });
    }
}
