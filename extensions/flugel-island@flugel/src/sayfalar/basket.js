// FLUGEL Island — "Maçlar" sekmesi (sunucudaki FLUGEL Akış Maçlar sayfasının GNOME uyarlaması).
// En üstte sabit "Benim maçlarım" (hakemlik görevlerim: saat, salon, görev, kalan süre). Altında
// Bugün · Yarın · Geçmiş seçimi; her satırda lig simgesi, saat ya da skor, takımlar (logolu), durum rozeti.
// Canlı maç satırı vurgulu. Veri: ust-panel-veri maclar (← /api/maclar?island=1; logolar diskte önbellekli).
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import {Sayfa} from './sayfa.js';
import {calistir, kisaTarih} from '../ortak.js';
import {bolum, dugme, ipucuBagla} from '../bilesenler.js';
import {ikon} from '../ortak.js';

const saat = ts => GLib.DateTime.new_from_unix_local(ts).format('%H:%M');
const kalan = (tarih, s) => {
    const [y, a, g] = (tarih ?? '').split('-').map(Number);
    const [sa, dk] = String(s ?? '').split(':').map(Number);
    if (!y || !Number.isFinite(sa))
        return '';
    const fark = (new Date(y, a - 1, g, sa, dk || 0).getTime() - Date.now()) / 60000;
    if (fark < -120)
        return 'bitti';
    if (fark < 0)
        return 'şimdi';
    return fark >= 60 ? `${Math.floor(fark / 60)} sa ${Math.round(fark % 60)} dk kaldı` : `${Math.round(fark)} dk kaldı`;
};
const ligSimge = lig => (/NBA|basket/i.test(lig) ? 'basket' : 'top');

function etiket(metin, stil, genislik) {
    const l = new St.Label({text: metin ?? '', style_class: stil, y_align: Clutter.ActorAlign.CENTER});
    l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    if (genislik)
        l.style = `width: ${genislik}px;`;
    return l;
}

export class BasketSayfa extends Sayfa {
    constructor({veri}) {
        super();
        this._veri = veri;
        this._gorunum = 'bugun';

        this._benim = new St.BoxLayout({style_class: 'flugel-benim-kart', orientation: Clutter.Orientation.VERTICAL});
        this._benim.reactive = true;
        ipucuBagla(this._benim, () => {
            const b = this._sonBenim ?? {};
            return {baslik: `Takip: ${(b.isimler ?? []).join(', ')}`,
                ayrinti: [`Son kontrol ${b.guncelleme ?? '?'}`, ...(b.gecmis ?? []).map(m =>
                    `${kisaTarih(m.tarih)} ${m.ev} — ${m.dep} (${m.gorev ?? ''})`)].join('\n')};
        });
        this.actor.add_child(bolum('Benim maçlarım', this._benim, {sag: dugme('view-refresh-symbolic', 'Bültenleri şimdi kontrol et',
            () => this._kontrol(), {stil: 'flugel-dugme flugel-dugme-kucuk'})}));

        const cipler = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        this._cip = {};
        for (const [k, ad] of [['bugun', 'Bugün'], ['yarin', 'Yarın'], ['gecmis', 'Geçmiş']]) {
            const b = new St.Button({label: ad, style_class: 'flugel-cip', can_focus: true});
            b.connect('clicked', () => {
                this._gorunum = k;
                this._cizilen?.delete('maclar');
                this._yaz();
            });
            this._cip[k] = b;
            cipler.add_child(b);
        }
        this.actor.add_child(cipler);
        this._liste = new St.BoxLayout({style_class: 'flugel-mac-listesi', orientation: Clutter.Orientation.VERTICAL});
        this.actor.add_child(this._liste);
        const alt = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        const fikstur = new St.Button({label: 'Ankara basketbol fikstürü', style_class: 'flugel-cip', can_focus: true});
        fikstur.connect('clicked', () => {
            this.close();
            calistir('xdg-open https://www.ankarabasket.org.tr/fiksturler');
        });
        alt.add_child(fikstur);
        this.actor.add_child(alt);

        this._aboneler = [veri.abone('maclar', d => {
            const b = d?.benim ?? {};
            const bugunVar = (b.bugun ?? []).length;
            this.rozetDegisti?.(d?.canli ? 'canlı' : (bugunVar ? 'bugün' : ''));
            this.gorunurse(() => this._yaz());
        })];
    }

    _kontrol() {
        calistir('ssh -o BatchMode=yes flugelserver python3 /opt/basket-bot/basket_bot.py');
        if (this._bekleId)
            GLib.source_remove(this._bekleId);
        this._bekleId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 40, () => {
            this._bekleId = 0;
            this._veri.yenile('maclar', true);
            return GLib.SOURCE_REMOVE;
        });
    }

    goster() {
        this._yaz();
        this._veri.tazele('maclar', 120);
    }

    _yaz() {
        const d = this._veri.son('maclar');
        if (!this.degisti('maclar', [d, this._gorunum]))
            return;
        for (const [k, b] of Object.entries(this._cip)) {
            if (k === this._gorunum)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        this._benimYaz(d);
        this._liste.destroy_all_children();
        if (!d || d.hata) {
            this._liste.add_child(etiket(d ? 'Maç verisi alınamadı (sunucu?)' : 'Yükleniyor…', 'flugel-soluk'));
            return;
        }
        if (this._gorunum === 'gecmis') {
            for (const g of d.gecmis ?? []) {
                if (!g.ligler?.length)
                    continue;
                this._liste.add_child(etiket(g.gun, 'flugel-bolum-baslik'));
                this._ligler(g.ligler);
            }
        } else {
            this._ligler(d[this._gorunum] ?? []);
        }
        if (!this._liste.get_n_children())
            this._liste.add_child(etiket('Maç yok', 'flugel-soluk'));
    }

    _benimYaz(d) {
        this._benim.destroy_all_children();
        const b = d?.benim;
        if (!b) {
            this._benim.add_child(etiket('Hakemlik verisi yok', 'flugel-soluk'));
            return;
        }
        const satir = (m, gun) => {
            const s = new St.BoxLayout({style_class: 'flugel-benim-satir'});
            s.add_child(new St.Icon({gicon: ikon('basket'), icon_size: 20, y_align: Clutter.ActorAlign.CENTER}));
            const metin = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
            metin.add_child(etiket(`${gun} ${m.saat ?? ''} · ${m.ev ?? '?'} — ${m.dep ?? '?'}`, 'flugel-benim-baslik'));
            metin.add_child(etiket([m.salon, m.gorev, m.lig].filter(Boolean).join(' · '), 'flugel-benim-alt'));
            s.add_child(metin);
            const k = kalan(m.tarih, m.saat);
            if (k)
                s.add_child(etiket(k, 'flugel-rozet flugel-benim-kalan'));
            this._benim.add_child(s);
        };
        (b.bugun ?? []).forEach(m => satir(m, 'Bugün'));
        (b.yarin ?? []).forEach(m => satir(m, 'Yarın'));
        if (!(b.bugun ?? []).length && !(b.yarin ?? []).length) {
            this._benim.add_child(etiket('Bugün ve yarın görevin yok', 'flugel-benim-bos'));
            const y = (b.yaklasan ?? [])[0];
            if (y)
                this._benim.add_child(etiket(`Sıradaki: ${kisaTarih(y.tarih)} ${y.saat} · ${y.ev} — ${y.dep}`, 'flugel-benim-alt'));
        }
        this._sonBenim = b;
    }

    _ligler(ligler) {
        for (const lig of ligler) {
            const ust = new St.BoxLayout({style_class: 'flugel-lig-baslik'});
            ust.add_child(new St.Icon({gicon: ikon(ligSimge(lig.lig)), icon_size: 14, y_align: Clutter.ActorAlign.CENTER}));
            ust.add_child(etiket(lig.lig, 'flugel-lig-ad'));
            this._liste.add_child(ust);
            for (const m of lig.maclar)
                this._liste.add_child(this._macSatiri(m));
        }
    }

    _macSatiri(m) {
        const canli = m.durum === 'in', bitti = m.durum === 'post';
        const s = new St.Button({style_class: `flugel-mac-satir${canli ? ' flugel-mac-canli' : ''}`, can_focus: true,
            x_expand: true});
        const k = new St.BoxLayout({x_expand: true});
        const logo = t => new St.Icon({gicon: t.logo_yol ? Gio.FileIcon.new(Gio.File.new_for_path(t.logo_yol)) : ikon('top'),
            icon_size: 20, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-mac-logo'});
        k.add_child(etiket(m.ev?.ad, 'flugel-mac-takim flugel-mac-ev', 190));
        k.add_child(logo(m.ev ?? {}));
        const orta = canli || bitti ? `${m.ev?.skor ?? '-'} – ${m.dep?.skor ?? '-'}` : saat(m.ts);
        k.add_child(etiket(orta, 'flugel-mac-skor', 72));
        k.add_child(logo(m.dep ?? {}));
        k.add_child(etiket(m.dep?.ad, 'flugel-mac-takim', 190));
        k.add_child(etiket(canli ? 'CANLI' : (bitti ? 'Bitti' : ''), `flugel-mac-durum${canli ? ' flugel-rozet' : ''}`));
        s.set_child(k);
        if (/^https?:\/\//.test(m.link ?? '')) {
            s.connect('clicked', () => {
                this.close();
                calistir(`xdg-open ${GLib.shell_quote(m.link)}`);
            });
        }
        ipucuBagla(s, {baslik: `${m.ev?.ad} — ${m.dep?.ad}`, ayrinti: `${saat(m.ts)} · ${m.detay ?? ''}${m.link ? ' · tıkla: ESPN maç sayfası' : ''}`});
        return s;
    }

    destroy() {
        if (this._bekleId)
            GLib.source_remove(this._bekleId);
        this._bekleId = 0;
        this._aboneler.forEach(f => f());
        super.destroy();
    }
}
