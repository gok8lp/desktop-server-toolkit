// FLUGEL Island — kapak resminden vurgu rengi (Atoll'daki gibi sanatçı adı, ilerleme ve ekolayzer bu renkle tonlanır).
// Resim 24x24'e küçültülür; doygun ve çok karanlık/aydınlık olmayan pikseller renk tonuna göre 12 kovaya ayrılır,
// en ağır kovanın ortalaması alınır ve koyu zeminde okunacak parlaklığa getirilir. Sonuç URI başına önbelleklenir.
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';

const onbellek = new Map();

function hslRgb(h, s, l) {
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}

function cikar(pb) {
    const w = pb.get_width(), h = pb.get_height(), n = pb.get_n_channels(), adim = pb.get_rowstride();
    const p = pb.get_pixels();
    const kova = Array.from({length: 12}, () => ({w: 0, r: 0, g: 0, b: 0}));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * adim + x * n;
            const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
            if (mx < 0.12 || d < 0.08)
                continue;
            let ton = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
            ton = (ton * 60 + 360) % 360;
            const agirlik = (d / mx) * mx;   // doygunluk × parlaklık
            const k = kova[Math.floor(ton / 30) % 12];
            k.w += agirlik;
            k.r += p[i] * agirlik;
            k.g += p[i + 1] * agirlik;
            k.b += p[i + 2] * agirlik;
        }
    }
    const en = kova.reduce((a, b) => (b.w > a.w ? b : a));
    if (en.w < 0.8)
        return null;   // renksiz kapak: varsayılan (beyaz) kalır
    const [r, g, b] = [en.r / en.w / 255, en.g / en.w / 255, en.b / en.w / 255];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let ton = d ? (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) : 0;
    ton = (ton * 60 + 360) % 360;
    const l = (mx + mn) / 2;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return hslRgb(ton, Math.max(0.45, Math.min(0.85, s)), Math.max(0.58, Math.min(0.72, l)));
}

// uri: file:// ya da https:// — [r, g, b] ya da null döner
export function vurguRengi(uri, iptal = null) {
    if (!uri)
        return Promise.resolve(null);
    if (onbellek.has(uri))
        return Promise.resolve(onbellek.get(uri));
    return new Promise(coz => {
        Gio.File.new_for_uri(uri).read_async(0, iptal, (dosya, res) => {
            let akis;
            try {
                akis = dosya.read_finish(res);
            } catch (e) {
                coz(null);
                return;
            }
            GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(akis, 24, 24, false, iptal, (_k, r2) => {
                let renk = null;
                try {
                    renk = cikar(GdkPixbuf.Pixbuf.new_from_stream_finish(r2));
                } catch (e) {
                    renk = null;
                }
                akis.close_async(0, null, null);
                if (onbellek.size > 60)
                    onbellek.clear();
                onbellek.set(uri, renk);
                coz(renk);
            });
        });
    });
}
