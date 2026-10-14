// FLUGEL Island — Re:Zero ekibi (FLUGEL v1 panelinden): göz kırpma, karakter değişimi, hafif salınım.
// Aynı karakter birden çok yerde (kapsül, kart başlığı, Ekip sekmesi) gösterilir; zamanlayıcılar tektir.
// Seyrek modda (pil / Pil Tasarrufu) salınım durur ve değişim 4 kat seyrekleşir.
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import {dosya} from './ortak.js';

export const EKIP = [
    ['emilia', 'Emilia', ['Bugün de elinden gelenin en iyisini yaptın!', 'Biraz mola ver, su iç. Puck da öyle diyor.', 'Birlikte her şeyi aşarız.']],
    ['subaru', 'Subaru', ['Pes etmek yok, baştan başlarız!', 'Bir planım var... sanırım.', 'Yorgunsan kısa bir mola, sonra tam gaz!']],
    ['beatrice', 'Beatrice', ['Betty sana biraz dinlenmeni söylüyor, kashira.', 'Kod yazarken acele etme, kashira.', 'Bu kadar çalışma yeter, kashira.']],
    ['rem', 'Rem', ['Sana inanıyorum!', 'Bugünkü görevlerini tek tek bitirelim.', 'Kahvaltını atlama.']],
    ['ram', 'Ram', ['Bu kadar dağınık bir masa kabul edilemez.', 'Hadi, kalk ve işini bitir.', 'Fena değil... bu seferlik.']],
    ['julius', 'Julius', ['Bir şövalye gibi disiplinli ol.', 'Zarafet ve azimle devam.', 'Dostluk her zorluğu kolaylaştırır.']],
    ['anastasia', 'Anastasia', ['Zaman paradır, boşa harcama!', 'İyi bir yatırım: dinlenmek.', 'Pazarlık her zaman mümkündür.']],
    ['meili', 'Meili', ['Biraz oyun oynamaya ne dersin?', 'Sakin ol, her şey yolunda.', 'Güneş batmadan işini bitir.']],
    ['shaula', 'Shaula', ['Ustam! Kuleyi ben korurum!', 'Bekliyordum seni, ustam!', 'Bugün de enerjik ol, ustam!']],
];

export class EkipYoneticisi {
    constructor(ayarlar) {
        this._ayar = ayarlar;
        this.sira = 0;
        this._seyrek = false;
        this._hedefler = new Set();     // {kutu, kim, puck, salinim}
        this._dinleyiciler = new Set();
        this._kareler = EKIP.map(([id]) => [
            Gio.FileIcon.new(Gio.File.new_for_path(dosya(`ekip/${id}-acik.svg`))),
            Gio.FileIcon.new(Gio.File.new_for_path(dosya(`ekip/${id}-kapali.svg`))),
        ]);
        this._puckIkon = Gio.FileIcon.new(Gio.File.new_for_path(dosya('emilia/puck.svg')));
        this._tik = 0;
        this._gozId = GLib.timeout_add(GLib.PRIORITY_LOW, 3700, () => {
            this._kirp();
            return GLib.SOURCE_CONTINUE;
        });
        this._degisId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 9, () => {
            // seyrekken 9 yerine ~36 saniyede bir değişir
            if (this._ayar.get_boolean('ekip-otomatik') && (!this._seyrek || ++this._tik % 4 === 0))
                this._gecis((this.sira + 1) % EKIP.length);
            return GLib.SOURCE_CONTINUE;
        });
    }

    get ad() {
        return EKIP[this.sira][1];
    }

    soz() {
        const s = EKIP[this.sira][2];
        return s[Math.floor(Math.random() * s.length)];
    }

    abone(fn) {
        this._dinleyiciler.add(fn);
        return () => this._dinleyiciler.delete(fn);
    }

    // salinim: 'kapsul' | 'kart' | 'sayfa' — sadece kapsüldeki ve karttaki salınır
    ikonOlustur(boyut, yer) {
        // Puck, karakterin sağ üst köşesinde uçar; kutu sabit boyutlu ki ada genişliği karakterle değişmesin
        const kutu = new St.Widget({layout_manager: new Clutter.BinLayout(), y_align: Clutter.ActorAlign.CENTER,
            x_expand: false, style_class: `flugel-ekip flugel-ekip-${yer}`,
            style: `width: ${Math.round(boyut * 1.3)}px; height: ${boyut}px;`});
        const kim = new St.Icon({gicon: this._kareler[this.sira][0], icon_size: boyut, x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER});
        const puck = new St.Icon({gicon: this._puckIkon, icon_size: Math.round(boyut / 2), x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START, visible: EKIP[this.sira][0] === 'emilia'});
        kutu.add_child(kim);
        kutu.add_child(puck);
        const h = {kutu, kim, puck, salinim: yer !== 'sayfa'};
        this._hedefler.add(h);
        kutu.connect('destroy', () => this._hedefler.delete(h));
        // salınım sadece ekrandayken çalışır (gizli kartta boşuna kare çizilmez)
        kutu.connect('notify::mapped', () => this._salinim(h));
        return kutu;
    }

    _salinim(h) {
        h.kim.remove_all_transitions();
        h.puck.remove_all_transitions();
        h.kim.translation_y = h.puck.translation_y = h.puck.translation_x = 0;
        if (!h.salinim || this._seyrek || !h.kutu.mapped || !St.Settings.get().enable_animations)
            return;
        h.kim.translation_y = 1;
        h.kim.ease({translation_y: -1.5, duration: 1400, mode: Clutter.AnimationMode.EASE_IN_OUT_SINE, repeatCount: -1, autoReverse: true});
        h.puck.translation_y = 2;
        h.puck.ease({translation_y: -3, translation_x: 1.5, duration: 1100, mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD, repeatCount: -1, autoReverse: true});
    }

    seyrekModu(seyrek) {
        if (seyrek === this._seyrek)
            return;
        this._seyrek = seyrek;
        for (const h of this._hedefler)
            this._salinim(h);
    }

    _kirp() {
        const kapali = this._kareler[this.sira][1];
        const gorunur = [...this._hedefler].filter(h => h.kutu.mapped);
        if (!gorunur.length)
            return;
        gorunur.forEach(h => (h.kim.gicon = kapali));
        if (this._kirpId)
            GLib.source_remove(this._kirpId);
        this._kirpId = GLib.timeout_add(GLib.PRIORITY_LOW, 160, () => {
            this._kirpId = 0;
            for (const h of this._hedefler)
                h.kim.gicon = this._kareler[this.sira][0];
            return GLib.SOURCE_REMOVE;
        });
    }

    sec(i) {
        this._ayar.set_boolean('ekip-otomatik', false);
        this._goster(i);
    }

    _goster(i) {
        this.sira = i;
        for (const h of this._hedefler) {
            h.kim.gicon = this._kareler[i][0];
            h.puck.visible = EKIP[i][0] === 'emilia';
        }
        for (const fn of this._dinleyiciler)
            fn(i);
    }

    _gecis(i) {
        if (this._seyrek || !St.Settings.get().enable_animations) {
            this._goster(i);
            return;
        }
        // yumuşak geçiş: solup yeni karakterle geri gelir
        const gorunur = [...this._hedefler].filter(h => h.kutu.mapped);
        if (!gorunur.length) {
            this._goster(i);
            return;
        }
        gorunur.forEach((h, n) => h.kim.ease({opacity: 0, duration: 350, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (n === 0)
                    this._goster(i);
                h.kim.ease({opacity: 255, duration: 350, mode: Clutter.AnimationMode.EASE_IN_QUAD});
            }}));
    }

    destroy() {
        for (const id of [this._gozId, this._degisId, this._kirpId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._gozId = this._degisId = this._kirpId = 0;
        for (const h of this._hedefler) {
            h.kim.remove_all_transitions();
            h.puck.remove_all_transitions();
        }
        this._hedefler.clear();
        this._dinleyiciler.clear();
    }
}
