// FLUGEL Island — çizgi grafik (St.DrawingArea + cairo). Sadece veri değişince yeniden çizilir.
// Siyah-beyaz; "renkli" açıksa yükselişte yeşil, düşüşte kırmızı.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
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

// ---------- inceleme grafiği (kripto ayrıntısı) ----------
// Üzerine gelince: dikey/yatay imleç, o anki fiyat ve zaman, başlangıca göre değişim.
// Basılı tutup sürükleyince: iki nokta arası ölçüm (yüzde, fiyat farkı, süre). Kısa tık: tiklandi(fiyat).
// Sağ tık bir çizginin yakınında: cizgiSil(cizgi). Çizgiler: {fiyat, tur: 'isaret'|'alarm', id?}.
const ISARET = '#e8c66b', ALARM = '#7fb2ff', YUKARI = '#8fd6a0', ASAGI = '#f07b7b';

export class InteraktifGrafik {
    constructor({genislik = 600, yukseklik = 240} = {}) {
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._s = s;
        this.actor = new St.DrawingArea({style_class: 'flugel-igrafik', width: genislik * s, height: yukseklik * s,
            reactive: true, track_hover: true});
        this._t = [];
        this._c = [];
        this._cizgiler = [];
        this._imlec = null;
        this._olcum = null;
        this._renkli = true;
        this._fiyatBicim = v => String(v);
        this._zamanBicim = t => String(t);
        this.tiklandi = null;
        this.cizgiSil = null;
        this.actor.connect('repaint', a => this._ciz(a));
        this.actor.connect('motion-event', (_a, e) => {
            const [x] = this._yerel(e);
            this._imlec = this._sira(x);
            if (this._olcum)
                this._olcum.bit = this._imlec;
            this.actor.queue_repaint();
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.connect('leave-event', () => {
            this._imlec = null;
            this._olcum = null;
            this.actor.queue_repaint();
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.connect('button-press-event', (_a, e) => {
            const [x, y] = this._yerel(e);
            if (e.get_button() === 3) {
                const c = this._yakinCizgi(y);
                if (c)
                    this.cizgiSil?.(c);
                return Clutter.EVENT_STOP;
            }
            if (e.get_button() === 1)
                this._olcum = {bas: this._sira(x), bit: this._sira(x), x0: x};
            return Clutter.EVENT_STOP;
        });
        this.actor.connect('button-release-event', (_a, e) => {
            const [x, y] = this._yerel(e);
            const o = this._olcum;
            this._olcum = null;
            if (e.get_button() === 1 && o && Math.abs(x - o.x0) < 6 * this._s)
                this.tiklandi?.(this._fiyatAt(y));
            this.actor.queue_repaint();
            return Clutter.EVENT_STOP;
        });
    }

    // {t: [unix sn], c: [kapanış], cizgiler, renkli, fiyatBicim, zamanBicim}
    ayarla(o) {
        this._t = o.t ?? [];
        this._c = (o.c ?? []).map(Number);
        this._cizgiler = o.cizgiler ?? [];
        this._renkli = o.renkli ?? true;
        if (o.fiyatBicim)
            this._fiyatBicim = o.fiyatBicim;
        if (o.zamanBicim)
            this._zamanBicim = o.zamanBicim;
        this.actor.queue_repaint();
    }

    _yerel(e) {
        const [ex, ey] = e.get_coords();
        const [, x, y] = this.actor.transform_stage_point(ex, ey);
        return [x, y];
    }

    // çizim alanı (fiziksel piksel): sağda fiyat ekseni, üstte bilgi satırı, altta zaman ekseni
    _alan() {
        const [w, h] = this.actor.get_size();
        const s = this._s;
        return {sol: 6 * s, sag: w - 70 * s, ust: 24 * s, alt: h - 18 * s, w, h};
    }

    _aralik() {
        const c = this._c;
        let enAz = Math.min(...c), enCok = Math.max(...c);
        const pay = (enCok - enAz) || enCok * 0.01 || 1;
        // grafiğe yakın çizgiler aralığa dahil edilir; çok uzaktakiler kenarda ok olarak gösterilir
        for (const l of this._cizgiler) {
            if (l.fiyat > enAz - pay * 0.6 && l.fiyat < enCok + pay * 0.6) {
                enAz = Math.min(enAz, l.fiyat);
                enCok = Math.max(enCok, l.fiyat);
            }
        }
        const ek = (enCok - enAz || pay) * 0.06;
        return [enAz - ek, enCok + ek];
    }

    _sira(x) {
        const n = this._c.length;
        if (n < 2)
            return null;
        const a = this._alan();
        return Math.max(0, Math.min(n - 1, Math.round((x - a.sol) / (a.sag - a.sol) * (n - 1))));
    }

    _fiyatAt(y) {
        const a = this._alan();
        const [enAz, enCok] = this._aralik();
        return enCok - (Math.max(a.ust, Math.min(a.alt, y)) - a.ust) / (a.alt - a.ust) * (enCok - enAz);
    }

    _yakinCizgi(y) {
        if (this._c.length < 2)
            return null;
        const a = this._alan();
        const [enAz, enCok] = this._aralik();
        const yy = v => a.ust + (1 - (v - enAz) / (enCok - enAz)) * (a.alt - a.ust);
        let en = null, fark = 10 * this._s;
        for (const l of this._cizgiler) {
            const d = Math.abs(yy(Math.max(enAz, Math.min(enCok, l.fiyat))) - y);
            if (d < fark) {
                fark = d;
                en = l;
            }
        }
        return en;
    }

    _metin(cr, metin, x, y, {boyut = 10, kalin = false, renk: rk = [1, 1, 1, 0.6], hiza = 'sol'} = {}) {
        cr.selectFontFace('Cantarell', Cairo.FontSlant.NORMAL, kalin ? Cairo.FontWeight.BOLD : Cairo.FontWeight.NORMAL);
        cr.setFontSize(boyut * this._s);
        const e = cr.textExtents(metin);
        const x0 = hiza === 'sag' ? x - e.xAdvance : (hiza === 'orta' ? x - e.xAdvance / 2 : x);
        cr.setSourceRGBA(...rk);
        cr.moveTo(x0, y);
        cr.showText(metin);
        return e.xAdvance;
    }

    // sağ eksende renkli etiket kutusu
    _etiket(cr, metin, y, zemin, yazi = [0, 0, 0, 1]) {
        const a = this._alan();
        const s = this._s;
        cr.selectFontFace('Cantarell', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(9.5 * s);
        const e = cr.textExtents(metin);
        const g = e.xAdvance + 10 * s, yk = 15 * s;
        const x = a.sag + 4 * s, yy = Math.max(a.ust, Math.min(a.alt - yk, y - yk / 2));
        cr.setSourceRGBA(...zemin);
        const r = 4 * s;
        cr.newSubPath();
        cr.arc(x + g - r, yy + r, r, -Math.PI / 2, 0);
        cr.arc(x + g - r, yy + yk - r, r, 0, Math.PI / 2);
        cr.arc(x + r, yy + yk - r, r, Math.PI / 2, Math.PI);
        cr.arc(x + r, yy + r, r, Math.PI, 1.5 * Math.PI);
        cr.closePath();
        cr.fill();
        cr.setSourceRGBA(...yazi);
        cr.moveTo(x + 5 * s, yy + yk - 4 * s);
        cr.showText(metin);
    }

    _ciz(alan) {
        const cr = alan.get_context();
        try {
            const c = this._c;
            const a = this._alan();
            const s = this._s;
            if (c.length < 2) {
                this._metin(cr, '…', a.w / 2, a.h / 2, {hiza: 'orta', boyut: 14});
                return;
            }
            const [enAz, enCok] = this._aralik();
            const x = i => a.sol + (i / (c.length - 1)) * (a.sag - a.sol);
            const y = v => a.ust + (1 - (v - enAz) / (enCok - enAz)) * (a.alt - a.ust);
            const yukseldi = c[c.length - 1] >= c[0];
            const ana = renk(this._renkli ? (yukseldi ? YUKARI : ASAGI) : '#f2f2f4');

            // ızgara + fiyat ekseni
            cr.setLineWidth(1);
            for (let i = 0; i <= 4; i++) {
                const gy = Math.round(a.ust + (i / 4) * (a.alt - a.ust)) + 0.5;
                cr.setSourceRGBA(1, 1, 1, 0.07);
                cr.moveTo(a.sol, gy);
                cr.lineTo(a.sag, gy);
                cr.stroke();
                const v = enCok - (i / 4) * (enCok - enAz);
                this._metin(cr, this._fiyatBicim(v), a.sag + 6 * s, gy + 3.5 * s, {boyut: 9});
            }
            // zaman ekseni
            for (const i of [0, Math.round((c.length - 1) / 3), Math.round(2 * (c.length - 1) / 3), c.length - 1]) {
                if (this._t[i])
                    this._metin(cr, this._zamanBicim(this._t[i]), x(i), a.h - 4 * s, {boyut: 9, hiza: i === 0 ? 'sol' : (i === c.length - 1 ? 'sag' : 'orta')});
            }
            // başlangıç fiyatı: kesikli soluk çizgi
            cr.setDash([3 * s, 4 * s], 0);
            cr.setSourceRGBA(1, 1, 1, 0.18);
            cr.moveTo(a.sol, Math.round(y(c[0])) + 0.5);
            cr.lineTo(a.sag, Math.round(y(c[0])) + 0.5);
            cr.stroke();
            cr.setDash([], 0);

            // ölçüm alanı
            const o = this._olcum;
            if (o && o.bas !== null && o.bit !== null && o.bas !== o.bit) {
                const [i1, i2] = [Math.min(o.bas, o.bit), Math.max(o.bas, o.bit)];
                const art = c[o.bit] >= c[o.bas];
                cr.setSourceRGBA(...renk(art ? YUKARI : ASAGI, 0.12));
                cr.rectangle(x(i1), a.ust, x(i2) - x(i1), a.alt - a.ust);
                cr.fill();
            }

            // dolgu + çizgi
            const dolgu = new Cairo.LinearGradient(0, a.ust, 0, a.alt);
            dolgu.addColorStopRGBA(0, ana[0], ana[1], ana[2], 0.25);
            dolgu.addColorStopRGBA(1, ana[0], ana[1], ana[2], 0);
            cr.moveTo(x(0), a.alt);
            c.forEach((v, i) => cr.lineTo(x(i), y(v)));
            cr.lineTo(x(c.length - 1), a.alt);
            cr.closePath();
            cr.setSource(dolgu);
            cr.fill();
            cr.setSourceRGBA(...ana);
            cr.setLineWidth(2 * s);
            cr.setLineJoin(Cairo.LineJoin.ROUND);
            c.forEach((v, i) => (i ? cr.lineTo(x(i), y(v)) : cr.moveTo(x(i), y(v))));
            cr.stroke();

            // işaret ve alarm çizgileri
            for (const l of this._cizgiler) {
                const disarida = l.fiyat > enCok ? 'ust' : (l.fiyat < enAz ? 'alt' : null);
                const ly = Math.round(y(Math.max(enAz, Math.min(enCok, l.fiyat)))) + 0.5;
                const rk = renk(l.tur === 'alarm' ? ALARM : ISARET);
                cr.setSourceRGBA(rk[0], rk[1], rk[2], disarida ? 0.45 : 0.9);
                cr.setLineWidth(1.2 * s);
                if (l.tur === 'alarm' || disarida)
                    cr.setDash([6 * s, 4 * s], 0);
                cr.moveTo(a.sol, ly);
                cr.lineTo(a.sag, ly);
                cr.stroke();
                cr.setDash([], 0);
                const ok = disarida === 'ust' ? '↑ ' : (disarida === 'alt' ? '↓ ' : '');
                this._etiket(cr, `${ok}${l.tur === 'alarm' ? 'A ' : ''}${this._fiyatBicim(l.fiyat)}`, ly, rk);
            }

            // son fiyat
            const sx = x(c.length - 1), sy = y(c[c.length - 1]);
            cr.setSourceRGBA(...ana);
            cr.arc(sx, sy, 3.5 * s, 0, 2 * Math.PI);
            cr.fill();
            this._etiket(cr, this._fiyatBicim(c[c.length - 1]), sy, ana);

            // imleç ve bilgi satırı
            const i = this._imlec;
            if (i !== null && i !== undefined) {
                const ix = Math.round(x(i)) + 0.5, iy = Math.round(y(c[i])) + 0.5;
                cr.setSourceRGBA(1, 1, 1, 0.35);
                cr.setLineWidth(1);
                cr.moveTo(ix, a.ust);
                cr.lineTo(ix, a.alt);
                cr.stroke();
                cr.setDash([3 * s, 3 * s], 0);
                cr.moveTo(a.sol, iy);
                cr.lineTo(a.sag, iy);
                cr.stroke();
                cr.setDash([], 0);
                cr.setSourceRGBA(1, 1, 1, 1);
                cr.arc(x(i), y(c[i]), 4 * s, 0, 2 * Math.PI);
                cr.fill();
                this._etiket(cr, this._fiyatBicim(c[i]), iy, [1, 1, 1, 0.92]);
            }
            let bilgi = null, bilgiRenk = [1, 1, 1, 0.9];
            if (o && o.bas !== null && o.bit !== null && o.bas !== o.bit) {
                const [p1, p2] = [c[o.bas], c[o.bit]];
                const d = 100 * (p2 - p1) / p1;
                const sure = Math.abs((this._t[o.bit] ?? 0) - (this._t[o.bas] ?? 0));
                const sureMetin = sure >= 86400 ? `${(sure / 86400).toFixed(1)} g` : (sure >= 3600 ? `${(sure / 3600).toFixed(1)} sa` : `${Math.round(sure / 60)} dk`);
                bilgi = `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}%   ${this._fiyatBicim(p1)} → ${this._fiyatBicim(p2)}   ${sureMetin}`;
                bilgiRenk = renk(d >= 0 ? YUKARI : ASAGI);
            } else if (i !== null && i !== undefined) {
                const d = 100 * (c[i] - c[0]) / c[0];
                bilgi = `${this._zamanBicim(this._t[i], true)}   ${this._fiyatBicim(c[i])}   ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}%`;
            }
            if (bilgi)
                this._metin(cr, bilgi, a.sol, 14 * s, {boyut: 10.5, kalin: true, renk: bilgiRenk});
        } finally {
            cr.$dispose();
        }
    }
}
