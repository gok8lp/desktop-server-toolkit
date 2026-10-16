// FLUGEL Island — oyun istek listesi ve "görüldü" kayıtları (ayarlarda JSON).
//   oyun-istek   : [{id: Steam uygulama no, ad, resim, eklendi, son: {steam, ucuz}}] — fiyat düşünce adada uyarı
//   oyun-gorulen : {psplus: [duyuru linkleri], epic: [oyun adları]} — yeni PS Plus / ücretsiz Epic duyurusu için
const oku = (ayar, anahtar, bos) => {
    try {
        return JSON.parse(ayar.get_string(anahtar) || bos);
    } catch (e) {
        return JSON.parse(bos);
    }
};

// Steam uygulama numarası: mağaza bağlantısından ya da kapak görselinin adresinden
export function steamKimligi(o) {
    const m = /\/app\/(\d+)/.exec(o?.link ?? '') ?? /\/apps\/(\d+)\//.exec(o?.resim ?? '');
    return m ? m[1] : (o?.id && /^\d+$/.test(String(o.id)) ? String(o.id) : null);
}

export const istekListesi = ayar => oku(ayar, 'oyun-istek', '[]').filter(o => o?.id);

export function istekteMi(ayar, id) {
    return !!id && istekListesi(ayar).some(o => o.id === id);
}

export function istegeEkle(ayar, o) {
    const id = steamKimligi(o);
    if (!id || istekteMi(ayar, id))
        return false;
    const l = istekListesi(ayar);
    l.push({id, ad: o.ad, resim_yol: o.resim_yol ?? null, eklendi: Math.floor(Date.now() / 1000), son: {}});
    ayar.set_string('oyun-istek', JSON.stringify(l));
    return true;
}

export function istektenCikar(ayar, id) {
    ayar.set_string('oyun-istek', JSON.stringify(istekListesi(ayar).filter(o => o.id !== id)));
}

export function sonFiyatYaz(ayar, id, son) {
    const l = istekListesi(ayar);
    const o = l.find(x => x.id === id);
    if (!o)
        return;
    o.son = {...o.son, ...son};
    ayar.set_string('oyun-istek', JSON.stringify(l));
}

export const gorulen = ayar => oku(ayar, 'oyun-gorulen', '{}');

export function gorulenYaz(ayar, alan, liste) {
    const g = gorulen(ayar);
    g[alan] = liste.slice(-60);
    ayar.set_string('oyun-gorulen', JSON.stringify(g));
}

export const fiyatMetni = (v, para = 'USD') => (Number.isFinite(v) ? (v === 0 ? 'Ücretsiz' : `${v.toFixed(2)} ${para === 'USD' ? '$' : para}`) : '');
