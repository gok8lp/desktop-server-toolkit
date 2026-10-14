// FLUGEL Island — çizgi grafik (St.DrawingArea + cairo). Sadece veri değişince yeniden çizilir.
// Siyah-beyaz; "renkli" açıksa yükselişte yeşil, düşüşte kırmızı.
import St from 'gi://St';
import Cairo from 'cairo';

const renk = (hex, a = 1) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255, a];

export class Grafik {
    // {genislik, yukseklik, izgara: bool (büyük grafikte yatay çizgiler)}
    constructor({genislik = 120, yukseklik = 36, izgara = false} = {}) {
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this.actor = new St.DrawingArea({style_class: 'flugel-grafik', width: genislik * s, height: yukseklik * s});
        this._izgara = izgara;
        this._seri = [];
        this._renk = '#f2f2f4';
        this.actor.connect('repaint', a => this._ciz(a));
    }

    ayarla(seri, {renkli = false} = {}) {
        const yeni = (seri ?? []).filter(Number.isFinite);
        const yukseldi = yeni.length > 1 && yeni[yeni.length - 1] >= yeni[0];
        const r = renkli ? (yukseldi ? '#8fd6a0' : '#f07b7b') : '#f2f2f4';
        if (r === this._renk && yeni.length === this._seri.length && yeni.every((v, i) => v === this._seri[i]))
            return;
        this._seri = yeni;
        this._renk = r;
        this.actor.queue_repaint();
    }

    _ciz(alan) {
        const cr = alan.get_context();
        try {
            const [w, h] = alan.get_surface_size();
            const s = this._seri;
            if (s.length < 2)
                return;
            const pay = this._izgara ? 6 : 2;
            const enAz = Math.min(...s), enCok = Math.max(...s);
            const aralik = enCok - enAz || 1;
            const x = i => pay + (i / (s.length - 1)) * (w - 2 * pay);
            const y = v => pay + (1 - (v - enAz) / aralik) * (h - 2 * pay);
            if (this._izgara) {
                cr.setSourceRGBA(1, 1, 1, 0.08);
                cr.setLineWidth(1);
                for (let i = 0; i <= 3; i++) {
                    const gy = Math.round(pay + (i / 3) * (h - 2 * pay)) + 0.5;
                    cr.moveTo(pay, gy);
                    cr.lineTo(w - pay, gy);
                }
                cr.stroke();
            }
            // altı hafif dolgu
            cr.moveTo(x(0), h);
            s.forEach((v, i) => cr.lineTo(x(i), y(v)));
            cr.lineTo(x(s.length - 1), h);
            cr.closePath();
            const [r, g, b] = renk(this._renk);
            const dolgu = new Cairo.LinearGradient(0, 0, 0, h);
            dolgu.addColorStopRGBA(0, r, g, b, 0.22);
            dolgu.addColorStopRGBA(1, r, g, b, 0);
            cr.setSource(dolgu);
            cr.fill();
            // çizgi
            cr.setSourceRGBA(r, g, b, 1);
            cr.setLineWidth(this._izgara ? 2 : 1.5);
            cr.setLineJoin(Cairo.LineJoin.ROUND);
            s.forEach((v, i) => (i ? cr.lineTo(x(i), y(v)) : cr.moveTo(x(i), y(v))));
            cr.stroke();
            // son nokta
            cr.arc(x(s.length - 1), y(s[s.length - 1]), this._izgara ? 3.5 : 2.5, 0, 2 * Math.PI);
            cr.fill();
        } finally {
            cr.$dispose();
        }
    }
}
