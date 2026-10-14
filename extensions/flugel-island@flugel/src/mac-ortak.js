// FLUGEL Island — maçlar: favori takım eşleme, özel maç anahtarı, önem sıralaması, yıldız gösterimi.
// Futbol/basketbol yıldızları ust-panel-veri'den (lig + büyük takım + derbi), CS2 yıldızları HLTV'den gelir.
import GLib from 'gi://GLib';

// aksan ve büyük/küçük harf duyarsız karşılaştırma ("Beşiktaş" = "besiktas", "Türkiye" ≈ "Turkiye")
export const sade = t => GLib.utf8_normalize(String(t ?? '').toLowerCase(), -1, GLib.NormalizeMode.NFKD)
    .replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export function favoriMi(favoriler, ad) {
    const a = sade(ad);
    return !!a && favoriler.some(f => sade(f) && a.includes(sade(f)));
}

// her iki tür maç için ortak alanlar: {ev, dep} (futbol) ya da {takim1, takim2} (CS2)
export const takimlar = m => (m.takim1 ? [m.takim1, m.takim2] : [m.ev, m.dep]).map(t => t ?? {});
export const macAnahtar = m => (m.takim1 ? `cs2:${m.id}` : `${sade(m.ev?.ad)}|${sade(m.dep?.ad)}|${m.ts}`);
export const canliMi = m => m.durum === 'in' || m.canli === true;

export function favoriVar(favoriler, m) {
    return takimlar(m).some(t => favoriMi(favoriler, t.ad));
}

// favoriler → özel → canlı → yıldız → saat
export function onemSirala(liste, favoriler, ozel) {
    const puan = m => (favoriVar(favoriler, m) ? 4000 : 0) + (ozel.has(macAnahtar(m)) ? 2000 : 0) + (canliMi(m) ? 1000 : 0) +
        (m.yildiz ?? 0) * 10 + (m.derbi ? 5 : 0);
    return [...liste].sort((x, y) => puan(y) - puan(x) || x.ts - y.ts);
}

// ★★★☆☆ (Pango biçimi): dolu yıldızlar sarı, boşlar soluk
export function yildizMetni(n, toplam = 5) {
    n = Math.max(0, Math.min(toplam, n ?? 0));
    return `<span foreground="#e8c66b">${'★'.repeat(n)}</span><span foreground="#4a4a52">${'★'.repeat(toplam - n)}</span>`;
}
