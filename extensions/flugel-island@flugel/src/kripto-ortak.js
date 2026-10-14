// FLUGEL Island — kripto: izleme listesi, fiyat alarmları ve grafik işaretleri (ayarlarda JSON olarak saklanır).
// kripto-varliklar: izleme listesi (sıra kartlardaki sıradır), kripto-alarmlar: [{id, s, fiyat, yon: 'ust'|'alt', olustu}],
// kripto-isaretler: {SEMBOL: [fiyat, ...]}.
import Gio from 'gi://Gio';
import {ikon, para} from './ortak.js';

export const KOIN_IKON = {BTC: 'coin-btc', ETH: 'coin-eth', SOL: 'coin-sol', BNB: 'coin-bnb', XRP: 'coin-xrp',
    DOGE: 'coin-doge', AVAX: 'coin-avax', ADA: 'coin-ada'};

// sekme açık değilken sağlayıcıdan (alarm) ayrıntı istemek için
export const KriptoOlay = {detayIste: null};

function json(ayar, anahtar, bos) {
    try {
        return JSON.parse(ayar.get_string(anahtar) || bos);
    } catch (e) {
        return JSON.parse(bos);
    }
}

export const alarmlar = ayar => json(ayar, 'kripto-alarmlar', '[]').filter(a => a && a.s && Number.isFinite(a.fiyat));

export function alarmEkle(ayar, s, fiyat, simdiki) {
    const l = alarmlar(ayar);
    l.push({id: `${s}-${Date.now()}`, s, fiyat, yon: fiyat >= simdiki ? 'ust' : 'alt', olustu: Math.floor(Date.now() / 1000)});
    ayar.set_string('kripto-alarmlar', JSON.stringify(l));
}

export function alarmSil(ayar, id) {
    ayar.set_string('kripto-alarmlar', JSON.stringify(alarmlar(ayar).filter(a => a.id !== id)));
}

export const isaretler = (ayar, s) => (json(ayar, 'kripto-isaretler', '{}')[s] ?? []).filter(Number.isFinite);

export function isaretDegistir(ayar, s, fn) {
    const t = json(ayar, 'kripto-isaretler', '{}');
    t[s] = fn(t[s] ?? []);
    if (!t[s].length)
        delete t[s];
    ayar.set_string('kripto-isaretler', JSON.stringify(t));
}

// izleme listesi + alarm kurulmuş koinler (veri bunlar için çekilir)
export function izlenenler(ayar) {
    return [...new Set([...ayar.get_strv('kripto-varliklar'), ...alarmlar(ayar).map(a => a.s)])];
}

// fiyat basamakları büyüklüğe göre: 81,714 · 2,429.08 · 1.0181 · 0.081870 · 0.0000040700
export function koinFiyat(v) {
    if (!Number.isFinite(v))
        return '-';
    if (v >= 10000)
        return para(v, 0);
    if (v >= 10)
        return para(v, 2);
    return para(v, Math.min(10, Math.max(2, 4 - Math.floor(Math.log10(Math.abs(v) || 1)))));
}

export const birimli = (v, k) => `${koinFiyat(v)} ${k?.birim === 'TL' || k === 'TL' ? '₺' : '$'}`;

export const yuzde = d => (Number.isFinite(d) ? `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}%` : '');

export const rozetMetni = s => ({USD: '$', EUR: '€'}[s] ?? String(s).slice(0, 4));

// simge: indirilmiş beyaz SVG → eklentideki tek renkli simge → yok (harf rozeti)
export function koinIkonu(k) {
    if (k?.simge)
        return Gio.FileIcon.new(Gio.File.new_for_path(k.simge));
    if (KOIN_IKON[k?.s])
        return ikon(KOIN_IKON[k.s]);
    return null;
}
