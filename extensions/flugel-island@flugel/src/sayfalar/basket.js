// FLUGEL Island — "Basket" sekmesi: hakemlik görevlerim (ankarabasket bülteni, FLUGEL v1 panelinden).
import GLib from 'gi://GLib';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {SARI, bilgiSatiri, menuOgesi, calistir, kac, kisaTarih, renkli, soluk, bugun} from '../ortak.js';

export class BasketSayfa extends Sayfa {
    constructor({veri}) {
        super();
        this._veri = veri;
        this._bolum = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._bolum);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this, 'Şimdi kontrol et', () => {
            calistir('ssh -o BatchMode=yes flugelserver python3 /opt/basket-bot/basket_bot.py');
            if (this._bekleId)
                GLib.source_remove(this._bekleId);
            this._bekleId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 40, () => {
                this._bekleId = 0;
                this._veri.yenile('basket', true);
                this._veri.yenile('island', true);
                return GLib.SOURCE_REMOVE;
            });
        }, 'view-refresh-symbolic');
        menuOgesi(this, 'Fikstür sayfası', 'xdg-open https://www.ankarabasket.org.tr/fiksturler', 'send-to-symbolic');
        this._aboneler = [
            veri.abone('basket', () => this.gorunurse(() => this._yaz())),
            veri.abone('island', s => {
                const g = s?.basket?.gelecek ?? [];
                this.rozetDegisti?.(g.length ? (g[0].tarih === bugun() ? 'bugün' : String(g.length)) : '');
            }),
        ];
    }

    goster() {
        this._yaz();
        this._veri.tazele('basket', 120);
    }

    _yaz() {
        if (!this.degisti('basket', this._veri.son('basket')))
            return;
        this._bolum.removeAll();
        const d = this._veri.son('basket');
        if (!d) {
            bilgiSatiri(this._bolum, soluk('Yükleniyor…'), 'basket');
            return;
        }
        if (d.hata) {
            bilgiSatiri(this._bolum, renkli('Veri alınamadı', SARI), 'basket');
            return;
        }
        const g = d.gelecek || [];
        if (g.length) {
            bilgiSatiri(this._bolum, `<b>Yaklaşan maçların (${g.length})</b>`, 'basket');
            const b = bugun();
            for (const x of g) {
                const gun = x.tarih === b ? renkli('BUGÜN', SARI) : kisaTarih(x.tarih);
                bilgiSatiri(this._bolum, `<b>${gun} ${kac(x.saat)}</b>  ${kac(x.ev)} — ${kac(x.dep)}\n<small>${soluk(`${kac(x.salon)} · ${kac(x.gorev)}${x.lig ? ` · ${kac(x.lig)}` : ''}`)}</small>`);
            }
        } else {
            bilgiSatiri(this._bolum, 'Şu an atanmış maçın yok', 'basket');
        }
        bilgiSatiri(this._bolum, `<small>${soluk(`Takip: ${kac((d.isimler || []).join(', '))} · ${d.taranan ?? '?'} bülten · son kontrol ${d.guncelleme || '?'}${d.yedek ? ' · PC yedek verisi' : ''}`)}</small>`);
    }

    destroy() {
        if (this._bekleId)
            GLib.source_remove(this._bekleId);
        this._bekleId = 0;
        this._aboneler.forEach(f => f());
        super.destroy();
    }
}
