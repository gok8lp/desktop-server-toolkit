// FLUGEL Akis v2 — istemci (sistem-bakim). Cerceve yok; sade JS.
"use strict";
const $ = (s, k = document) => k.querySelector(s);
const kac = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = (yol, govde, yontem) => fetch(yol, govde || yontem ? { method: yontem || "POST", headers: { "Content-Type": "application/json" }, body: govde ? JSON.stringify(govde) : undefined } : {}).then(r => r.json());

// ---------- simgeler ----------
const S = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IKON = {
  ana: S('<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>'),
  oyun: S('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 11.5h.01M18 13.5h.01"/>'),
  teknoloji: S('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>'),
  anime: S('<path d="M12 2l2.6 6.3L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.7z"/>'),
  youtube: S('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>'),
  fragman: S('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4l-2 5M13 4l-2 5M18 4l-2 5"/>'),
  film: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.5" r="1.6"/><circle cx="12" cy="16.5" r="1.6"/><circle cx="7.5" cy="12" r="1.6"/><circle cx="16.5" cy="12" r="1.6"/>'),
  fiyat: S('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  gundem: S('<path d="M4 5h13v14H5a1 1 0 0 1-1-1z"/><path d="M17 8h3v10a1 1 0 0 1-2 0M7 9h7M7 12h7M7 15h4"/>'),
  maclar: S('<circle cx="12" cy="12" r="9"/><path d="M12 3c3 3 3 15 0 18M3.5 9h17M3.5 15h17"/>'),
  uygulamalar: S('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
  kayitli: S('<path d="M6 3h12v18l-6-4-6 4z"/>'),
  sunucu: S('<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
  ayarlar: S('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  menu: S('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  ai: S('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  paylas: S('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>'),
};
const SAYFALAR = [
  ["ana", "Sana özel"], ["oyun", "Oyun"], ["teknoloji", "Teknoloji"], ["anime", "Anime & Manga"], ["youtube", "YouTube"],
  ["fragman", "Fragmanlar"], ["film", "Film & Dizi"], ["fiyat", "Oyun fiyatları"], ["gundem", "Gündem"], ["maclar", "Maçlar"],
  ["uygulamalar", "Uygulamalar"], ["kayitli", "Kaydedilenler"], ["sunucu", "Sunucu"], ["ayarlar", "Takip & ayarlar"],
];
const ALT = ["ana", "oyun", "anime", "maclar", "menu"];
const TUR_AD = { oyun: "Oyun", teknoloji: "Teknoloji", anime: "Anime", gundem: "Gündem", youtube: "YouTube", film: "Film" };
const KATEGORILI = new Set(["ana", "oyun", "teknoloji", "gundem", "anime", "youtube", "kayitli", "playstation", "fragman", "japonya", "film", "one", "uyari"]);

// ---------- zaman ----------
function once(ts) {
  const f = Date.now() / 1000 - ts;
  if (f < 60) return "şimdi";
  if (f < 3600) return `${Math.floor(f / 60)} dk`;
  if (f < 86400) return `${Math.floor(f / 3600)} sa`;
  return new Date(ts * 1000).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
function kalan(ts) {
  const f = ts - Date.now() / 1000;
  if (f <= 0) return "yayında";
  const g = Math.floor(f / 86400), s = Math.floor(f % 86400 / 3600), d = Math.floor(f % 3600 / 60);
  return g ? `${g}g ${s}s` : s ? `${s}s ${d}dk` : `${d}dk`;
}
const saat = ts => new Date(ts * 1000).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const gunSaat = ts => new Date(ts * 1000).toLocaleString("tr-TR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const alanAdi = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const RENK = ["#1d9bf0", "#a78bfa", "#ff7a45", "#00ba7c", "#f91880", "#ffd400"];
const renkSec = s => RENK[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % RENK.length];
const para = (f, p = "USD") => f ? f.toLocaleString("tr-TR", { style: "currency", currency: p }) : "Ücretsiz";

// ---------- menu ----------
function menuKur() {
  $("#menu").innerHTML = SAYFALAR.map(([k, ad]) => `<a class="menu-ogesi" href="#/${k}" data-k="${k}">${IKON[k]}<span>${ad}</span></a>`).join("");
  $("#alt-menu").innerHTML = ALT.map(k => k === "menu" ? `<a href="#" data-menu-ac>${IKON.menu}</a>` : `<a href="#/${k}" data-k="${k}">${IKON[k]}</a>`).join("");
  $("#tam-menu").innerHTML = SAYFALAR.map(([k, ad]) => `<a href="#/${k}" data-k="${k}">${IKON[k]}<span>${ad}</span></a>`).join("");
}

// ---------- gonderi karti ----------
function kart(o) {
  const yt = o.tur === "youtube";
  const avatar = `<div class="avatar" style="background:${renkSec(o.kaynak)}22;color:${renkSec(o.kaynak)}">
      <img loading="lazy" src="https://www.google.com/s2/favicons?domain=${alanAdi(o.link)}&sz=64" alt="" onerror="this.remove()">${kac([...o.kaynak][0])}</div>`;
  const medya = o.resim ? `<div class="medya" ${yt ? `data-video="${o.video}"` : ""}><img loading="lazy" referrerpolicy="no-referrer" src="${kac(o.resim)}" alt=""
      onerror="this.closest('.medya').remove()">${yt ? '<div class="oynat"></div>' : ""}</div>` : "";
  const onemli = o.onem >= 80 ? `<span class="ates" title="${kac(o.neden || "AI: senin için önemli")}">▲</span>` : "";
  const etiket = (o.etiketler || []).filter(e => e !== "fragman").slice(0, 3).map(e => `<span class="etiket">#${kac(e)}</span>`).join("");
  return `<article class="kart ${o.okundu ? "okundu" : ""} ${o.uyari ? "uyarili" : ""}" data-id="${o.id}" data-ts="${o.ts}">
    ${avatar}
    <div style="min-width:0">
      <div class="k-ust"><b>${kac(o.kaynak)}</b><span class="soluk">· ${once(o.ts)}</span>${onemli}<span class="rozet ${o.tur}">${TUR_AD[o.tur] || o.tur}</span></div>
      <a class="k-baslik" href="${kac(o.link)}" target="_blank" rel="noopener" data-oku>${kac(o.baslik_goster)}</a>
      ${o.ozet_goster && !yt ? `<p class="k-ozet">${kac(o.ozet_goster)}</p>` : ""}
      ${yt ? medya : medya ? `<a href="${kac(o.link)}" target="_blank" rel="noopener" data-oku>${medya}</a>` : ""}
      ${etiket ? `<div class="etiketler">${etiket}</div>` : ""}
      <div class="eylemler">
        <button class="eylem ai" data-ozetle title="AI ile özetle">${IKON.ai}<span>Özetle</span></button>
        <button class="eylem kaydet ${o.kayitli ? "aktif" : ""}" data-kaydet title="Kaydet">${IKON.kayitli}</button>
        <button class="eylem" data-paylas title="Bağlantıyı kopyala">${IKON.paylas}</button>
        ${o.kume_sayi ? `<button class="eylem kume" data-kume>+${o.kume_sayi} kaynak</button>` : ""}
        ${o.cevrildi ? `<span class="cevrildi">◎ ${o.dil === "ja" ? "Japoncadan" : "İngilizceden"} çevrildi</span>` : ""}
      </div>
      <div class="kume-liste" hidden></div>
    </div></article>`;
}
function videoKart(o, i) {
  return `<div class="vid" data-video="${o.video}" data-id="${o.id}" style="--i:${i % 20}">
    <div class="medya"><img loading="lazy" src="${kac(o.resim)}" alt=""><div class="oynat"></div></div>
    <div class="govde"><div class="ad">${kac(o.baslik_goster)}</div><div class="soluk" style="font-size:13px;margin-top:4px">${kac(o.kaynak)} · ${once(o.ts)}</div></div></div>`;
}

// ---------- sonsuz akis + canli ----------
let durum = { k: "_", enEski: 9e12, enYeni: 0, bitti: false, yukleniyor: false };
const gozcu = new IntersectionObserver(g => { if (g[0].isIntersecting) dahaFazla(); }, { rootMargin: "1400px" });
const izgaraMi = k => k === "youtube" || k === "fragman";

async function dahaFazla() {
  if (durum.yukleniyor || durum.bitti || !KATEGORILI.has(durum.k)) return;
  durum.yukleniyor = true;
  const k = durum.k;
  const liste = await api(`/api/akis?k=${k}&once=${durum.enEski}&n=20`).catch(() => []);
  if (k !== durum.k) return;
  durum.yukleniyor = false;
  if (!liste.length || k === "one") durum.bitti = true;
  if (!liste.length) {
    $("#nobet").innerHTML = $("#icerik .kart, #icerik .vid") ? '<p class="soluk">Hepsi bu kadar · yenileri gelince üstte haber veririm</p>' : "";
    if (!$("#icerik .kart, #icerik .vid")) $("#akis").innerHTML = '<div class="bos">Henüz bir şey yok. Kaynaklar birkaç dakika içinde dolacak.</div>';
    return;
  }
  durum.enEski = Math.min(...liste.map(o => o.ts));
  durum.enYeni = Math.max(durum.enYeni, ...liste.map(o => o.ts));
  $("#akis").insertAdjacentHTML("beforeend", liste.map((o, i) => izgaraMi(k) ? videoKart(o, i) : kart(o)).join(""));
  if (durum.bitti) $("#nobet").innerHTML = "";
}

// canli: 20 sn'de bir yeni var mi? En usteysen dogrudan ekle, asagidaysan "N yeni gonderi" goster
async function canliKontrol() {
  if (!KATEGORILI.has(durum.k) || !durum.enYeni || ["kayitli", "one"].includes(durum.k)) return;
  if (scrollY < 150 && !document.hidden) {
    const yeni = (await api(`/api/akis?k=${durum.k}&once=9e12&n=20`).catch(() => [])).filter(o => o.ts > durum.enYeni);
    if (yeni.length) {
      durum.enYeni = Math.max(...yeni.map(o => o.ts));
      $("#akis").insertAdjacentHTML("afterbegin", yeni.map((o, i) => izgaraMi(durum.k) ? videoKart(o, i) : kart(o)).join(""));
      [...$("#akis").children].slice(0, yeni.length).forEach(e => e.classList.add("taze"));
    }
    return;
  }
  const { sayi } = await api(`/api/yeni?k=${durum.k}&sonra=${durum.enYeni}`).catch(() => ({ sayi: 0 }));
  const d = $("#yeni-gonderi");
  if (sayi > 0) { d.textContent = `↑ ${sayi} yeni gönderi`; d.hidden = false; } else d.hidden = true;
}
setInterval(canliKontrol, 20000);
$("#yeni-gonderi").onclick = () => { window.scrollTo({ top: 0, behavior: "smooth" }); sayfaAc(location.hash.replace(/^#\//, "") || "ana", true); };

// takip edilen kelime gecen haber -> bildirim (izin verildiyse) + uygulama ici toast
let sonUyari = Math.floor(Date.now() / 1000);
setInterval(async () => {
  const l = await api(`/api/uyarilar?sonra=${sonUyari}`).catch(() => []);
  if (!l.length) return;
  sonUyari = Math.floor(Date.now() / 1000);
  l.forEach(o => {
    toast(`• ${o.baslik_goster}`, o.link);
    if ("Notification" in window && Notification.permission === "granted")
      new Notification("FLUGEL · takip ettiğin konu", { body: o.baslik_goster, icon: "/ikon.svg" }).onclick = () => open(o.link);
  });
}, 60000);
function toast(metin, link) {
  const t = document.createElement("a");
  t.className = "toast"; t.textContent = metin; if (link) { t.href = link; t.target = "_blank"; }
  document.body.appendChild(t); setTimeout(() => t.remove(), 9000);
}

// ---------- sayfalar ----------
const SEKMELER = {
  ana: [["ana", "Sana özel"], ["one", "▲ Öne çıkanlar"], ["uyari", "Takip"], ["gundem", "Gündem"]],
  oyun: [["oyun", "Haberler"], ["playstation", "PlayStation"], ["oyun:oneri", "Öneriler"], ["oyun:cok_satan", "Çok satanlar"], ["oyun:yeni", "Yeni çıkanlar"]],
  anime: [["anime", "Listem"], ["anime:sezon", "Bu sezon"], ["anime:haber", "Haberler"], ["japonya", "Japonya"], ["anime:manga", "Manga"]],
  film: [["film:dizi", "Bugün çıkan diziler"], ["film", "Haber & fragman"]],
  fiyat: [["fiyat", "Fırsatlar"], ["fiyat:epic", "Ücretsiz"], ["oyun:indirim", "Steam indirim"]],
  maclar: [["maclar", "Hafta sonu"], ["maclar:yakin", "Önümüzdeki 3 gün"]],
};
const KOK = { one: "ana", uyari: "ana", playstation: "oyun", japonya: "anime" };
function sekmeCiz(kok, alt) {
  const s = SEKMELER[kok] || [[kok, (SAYFALAR.find(x => x[0] === kok) || [null, ""])[1]]];
  $("#sekmeler").innerHTML = s.map(([id, ad]) => `<a class="sekme ${id === alt ? "aktif" : ""}" href="#/${id}"><span>${ad}</span></a>`).join("");
}

async function sayfaAc(k, zorla) {
  const kok = KOK[k] || k.split(":")[0];
  document.querySelectorAll("[data-k]").forEach(a => a.classList.toggle("aktif", a.dataset.k === kok));
  $("#sayfa-baslik").textContent = (SAYFALAR.find(x => x[0] === kok) || [null, "FLUGEL"])[1];
  sekmeCiz(kok, k);
  $("#tam-menu").hidden = true;
  $("#yeni-gonderi").hidden = true;
  $("#nobet").innerHTML = '<div class="donen"></div>';
  durum = { k: "_" + k, enEski: 9e12, enYeni: 0, bitti: false, yukleniyor: false };
  gozcu.disconnect();
  const ic = $("#icerik");
  if (!zorla) window.scrollTo(0, 0);
  const sayfa = { anime: animeSayfa, "anime:manga": mangaSayfa, "anime:sezon": sezonSayfa, "film:dizi": diziSayfa, fiyat: fiyatSayfa,
    "fiyat:epic": epicSayfa, uygulamalar: uygulamaSayfa, sunucu: sunucuSayfa, ayarlar: ayarSayfa }[k];
  if (sayfa) return sayfa(ic);
  if (k.startsWith("oyun:")) return oyunSayfa(ic, k.split(":")[1]);
  if (kok === "maclar") return macSayfa(ic, k === "maclar");

  const kat = k === "anime:haber" ? "anime" : k;
  durum.k = kat;
  let ust = "";
  if (k === "oyun") ust = await oyunSeridi("oneri", "Senin için öneriler", "Steam'de çok olumlu (%85+) yeni ve popüler oyunlar");
  if (k === "anime:haber") ust = '<div class="bolum-baslik">Anime haberleri <small>İngilizce kaynaklar sunucudaki yapay zekâyla Türkçeye çevrilir</small></div>';
  if (k === "japonya") ust = '<div class="bolum-baslik">Japonya\'dan <small>Japon anime/manga basını (アニメ！アニメ！) · Japoncadan Türkçeye çevrilir</small></div>';
  if (k === "one") ust = '<div class="bolum-baslik">▲ Öne çıkanlar <small>Yapay zekâ son 36 saatin haberlerini senin ilgi alanlarına göre puanladı</small></div>';
  if (k === "uyari") ust = '<div class="bolum-baslik">Takip ettiğin konular <small><a href="#/ayarlar" style="color:var(--mavi)">kelimeleri düzenle</a></small></div>';
  if (k === "fragman") ust = '<div class="bolum-baslik">Fragmanlar <small>oyun, anime, film ve dizi kanallarından · tıkla burada izle</small></div>';
  ic.innerHTML = ust + `<div id="akis" class="${izgaraMi(kat) ? "izgara" : ""}"></div>`;
  await dahaFazla();
  gozcu.observe($("#nobet"));
}

// ---------- anime ----------
let animeOnbellek = null;
const animeAl = async () => (animeOnbellek = animeOnbellek || await api("/api/anime"));
function animeKapak(a, i) {
  const s = a.sonraki;
  const yakin = s && s.airingAt - Date.now() / 1000 < 86400;
  const yuzde = a.toplam ? Math.min(100, Math.round(100 * a.ilerleme / a.toplam)) : 0;
  const digerleri = (a.izle_yerleri || []).slice(1, 4).map(y => `<a href="${kac(y.url)}" target="_blank" rel="noopener">${kac(y.site)}</a>`).join("");
  return `<div class="kapak" style="--renk:${a.renk};--i:${i}" data-egim tabindex="0">
    <img loading="lazy" src="${kac(a.kapak)}" alt="">
    ${s ? `<span class="sayac ${yakin ? "yakin" : ""}" data-geri="${s.airingAt}" data-on="${s.episode}.">${s.episode}. · ${kalan(s.airingAt)}</span>` : ""}
    ${a.puan ? `<span class="puan">★ ${(a.puan / 10).toFixed(1)}</span>` : ""}
    <div class="alt"><div class="ad">${kac(a.ad)}</div><div class="mini">${kac(a.liste || "")}${a.toplam && a.liste ? ` · ${a.ilerleme}/${a.toplam}` : ""}</div>
      ${a.toplam && a.liste ? `<div class="ilerleme"><i style="width:${yuzde}%"></i></div>` : ""}
      <div class="dugmeler">${a.izle ? `<a class="cr" href="${kac(a.izle)}" target="_blank" rel="noopener" title="${kac((a.izle_yerleri || [])[0]?.site || "Crunchyroll")}'da izle">▶ İzle</a>` : ""}
        ${a.oku ? `<a class="cr" href="${kac(a.oku)}" target="_blank" rel="noopener">Oku</a>` : ""}
        ${a.fragman ? `<button class="cr ikincil" data-video="${a.fragman}" title="Fragman">▸</button>` : ""}
        <a class="cr ikincil" href="${kac(a.mal || a.anilist)}" target="_blank" rel="noopener">MAL</a>
        ${a.imdb ? `<a class="cr ikincil" href="${kac(a.imdb)}" target="_blank" rel="noopener">IMDb</a>` : ""}</div>
      ${digerleri ? `<div class="diger-yer">Ayrıca: ${digerleri}</div>` : ""}</div></div>`;
}
async function animeSayfa(ic) {
  ic.innerHTML = '<div class="iskelet"></div><div class="iskelet"></div>';
  const d = await animeAl();
  const yayinda = d.anime.filter(a => a.sonraki);
  const one = yayinda.find(a => a.banner) || d.anime.find(a => a.banner);
  ic.innerHTML = `
    ${one ? `<div class="banner" style="background-image:url('${kac(one.banner)}')"><div>
      <div class="soluk" style="font-size:13px">${one.sonraki ? `Sıradaki: ${one.sonraki.episode}. bölüm · ${kalan(one.sonraki.airingAt)}` : "Listende"}</div>
      <h2>${kac(one.ad)}</h2><div class="soluk">${(one.turler || []).join(" · ")}</div>
      <a class="cr" href="${kac(one.izle)}" target="_blank" rel="noopener">▶ ${kac((one.izle_yerleri || [])[0]?.site || "Crunchyroll")}'da izle</a>
      ${one.fragman ? `<button class="cr ikincil" data-video="${one.fragman}">▸ Fragman</button>` : ""}</div></div>` : ""}
    <div class="bolum-baslik">Yayındaki animelerin <small>geri sayım canlı · yasal yayın sitesine bağlanır</small></div>
    <div class="serit">${yayinda.map(animeKapak).join("") || '<p class="soluk">Şu an yayında olan yok</p>'}</div>
    <div class="bolum-baslik">Son 24 saatte çıkan bölümler <small>popülerliğe göre</small></div>
    <div class="serit">${d.bugun.map((b, i) => animeKapak({ ...b, sonraki: null, liste: `${b.bolum}. bölüm · ${once(b.ts)} önce` }, i)).join("")}</div>
    <div class="bolum-baslik">Tüm listen</div>
    <div class="serit">${d.anime.filter(a => !a.sonraki).map(animeKapak).join("")}</div>`;
  egimKur(ic); $("#nobet").innerHTML = "";
}
async function sezonSayfa(ic) {
  ic.innerHTML = '<div class="iskelet"></div>';
  const d = await animeAl();
  ic.innerHTML = `<div class="bolum-baslik">Bu sezonun en popülerleri <small>AniList · ▸ ile fragmanı izle</small></div>
    <div class="kapak-izgara">${(d.sezon || []).map(animeKapak).join("")}</div>`;
  egimKur(ic); $("#nobet").innerHTML = "";
}
async function mangaSayfa(ic) {
  ic.innerHTML = '<div class="iskelet"></div>';
  const d = await animeAl();
  const gruplar = {};
  d.manga.forEach(m => (gruplar[m.liste || "Diğer"] = gruplar[m.liste || "Diğer"] || []).push(m));
  ic.innerHTML = Object.entries(gruplar).map(([g, l]) => `<div class="bolum-baslik">${kac(g)} <small>${l.length} seri</small></div>
    <div class="serit">${l.map(animeKapak).join("")}</div>`).join("") || '<div class="bos">Manga listen boş</div>';
  egimKur(ic); $("#nobet").innerHTML = "";
}
function egimKur(kok) {
  kok.querySelectorAll("[data-egim]").forEach(k => {
    k.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const r = k.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      k.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.04)`;
    });
    k.addEventListener("pointerleave", () => (k.style.transform = ""));
  });
}
setInterval(() => document.querySelectorAll("[data-geri]").forEach(e => {
  e.textContent = (e.dataset.on ? e.dataset.on + " · " : "· ") + kalan(+e.dataset.geri);
}), 30000);

// ---------- oyun + fiyat ----------
let oyunOnbellek = null, fiyatOnbellek = null;
const skorSinif = y => y >= 80 ? "s-iyi" : y >= 60 ? "s-orta" : "s-kotu";
function oyunKart(o, i) {
  return `<a class="oyunk" href="${o.link}" target="_blank" rel="noopener" style="--i:${i}"><img loading="lazy" src="${kac(o.resim)}" alt="">
    <div class="govde"><div class="ad">${kac(o.ad)}</div><div class="satir">
      ${o.yuzde != null ? `<span class="skor ${skorSinif(o.yuzde)}">%${o.yuzde} olumlu</span><span class="soluk">${(o.sayi || 0).toLocaleString("tr-TR")} inceleme</span>` : '<span class="soluk">henüz puan yok</span>'}
    </div><div class="satir">${o.indirim ? `<span class="indirim">-%${o.indirim}</span>` : ""}<span class="fiyat">${para(o.fiyat, o.para)}</span></div></div></a>`;
}
async function oyunSeridi(grup, baslik, alt) {
  oyunOnbellek = oyunOnbellek || await api("/api/oyunlar").catch(() => ({}));
  const l = oyunOnbellek[grup] || [];
  return l.length ? `<div class="bolum-baslik">${baslik} <small>${alt || ""}</small></div><div class="serit">${l.map(oyunKart).join("")}</div>` : "";
}
async function oyunSayfa(ic, grup) {
  ic.innerHTML = '<div class="iskelet"></div>';
  oyunOnbellek = oyunOnbellek || await api("/api/oyunlar").catch(() => ({}));
  const l = oyunOnbellek[grup] || [];
  const ad = { oneri: "Öneriler", cok_satan: "Steam çok satanlar", indirim: "Steam indirimleri", yeni: "Yeni çıkanlar" }[grup];
  ic.innerHTML = `<div class="bolum-baslik">${ad} <small>Steam Türkiye · puan = olumlu inceleme yüzdesi</small></div>
    <div class="izgara">${l.map(oyunKart).join("") || '<p class="soluk">Veri yok</p>'}</div>`;
  $("#nobet").innerHTML = "";
}
function firsatKart(o, i) {
  return `<a class="oyunk" href="${kac(o.link)}" target="_blank" rel="noopener" style="--i:${i}"><img loading="lazy" src="${kac(o.resim)}" alt="" style="aspect-ratio:16/9;object-fit:contain;background:#111">
    <div class="govde"><div class="ad">${kac(o.ad)}</div><div class="satir"><span class="soluk">${kac(o.magaza)}${o.magaza_sayisi > 1 ? ` +${o.magaza_sayisi - 1}` : ""}</span>
      ${o.metacritic ? `<span class="skor ${skorSinif(o.metacritic)}" title="Metacritic">MC ${o.metacritic}</span>` : ""}
      ${o.steam_puan ? `<span class="skor ${skorSinif(o.steam_puan)}" title="Steam">%${o.steam_puan}</span>` : ""}</div>
      <div class="satir"><span class="indirim">-%${o.indirim}</span><s class="soluk">${para(o.eski)}</s><span class="fiyat">${para(o.fiyat)}</span></div></div></a>`;
}
async function fiyatSayfa(ic) {
  ic.innerHTML = `<form class="ara" id="fiyat-ara"><input placeholder="Oyun ara: Steam TR ve 30+ PC mağazasında karşılaştır…" autocomplete="off"><button>Ara</button></form>
    <div id="ara-sonuc"></div><div class="iskelet"></div>`;
  $("#fiyat-ara").onsubmit = async e => {
    e.preventDefault();
    const q = $("input", e.target).value.trim(); if (!q) return;
    $("#ara-sonuc").innerHTML = '<div class="iskelet"></div>';
    const d = await api(`/api/fiyat?ara=${encodeURIComponent(q)}`).catch(() => ({}));
    const satir = (o, ek) => `<a class="fiyat-satir" href="${kac(o.link)}" target="_blank" rel="noopener"><img src="${kac(o.resim)}" alt=""><b>${kac(o.ad)}</b><span class="soluk">${ek}</span><span class="fiyat">${para(o.fiyat, o.para)}</span></a>`;
    $("#ara-sonuc").innerHTML = `<div class="bolum-baslik">Steam Türkiye</div>${(d.steam || []).map(o => satir(o, "Steam")).join("") || '<p class="soluk" style="padding:0 16px">Bulunamadı</p>'}
      <div class="bolum-baslik">En ucuz (PC mağazaları, CheapShark)</div>${(d.en_ucuz || []).map(o => satir(o, "en düşük fiyat")).join("") || '<p class="soluk" style="padding:0 16px">Bulunamadı</p>'}`;
  };
  fiyatOnbellek = fiyatOnbellek || await api("/api/fiyatlar").catch(() => ({}));
  ic.querySelector(".iskelet")?.remove();
  ic.insertAdjacentHTML("beforeend", `<div class="bolum-baslik">Günün fırsatları <small>AAA oyunlar · CheapShark fırsat puanına göre · USD</small></div>
    <div class="izgara">${(fiyatOnbellek.firsatlar || []).map(firsatKart).join("")}</div>`);
  $("#nobet").innerHTML = "";
}
async function epicSayfa(ic) {
  fiyatOnbellek = fiyatOnbellek || await api("/api/fiyatlar").catch(() => ({}));
  ic.innerHTML = `<div class="bolum-baslik">Epic Games ücretsiz oyunlar <small>her perşembe yenilenir</small></div>
    <div class="izgara">${(fiyatOnbellek.epic || []).map((o, i) => `<a class="oyunk" href="${kac(o.link)}" target="_blank" rel="noopener" style="--i:${i}"><img src="${kac(o.resim)}" alt="" style="aspect-ratio:16/9;object-fit:cover">
      <div class="govde"><div class="ad">${kac(o.ad)}</div><div class="satir"><span class="skor ${o.durum.startsWith("Şimdi") ? "s-iyi" : "s-orta"}">${kac(o.durum)}</span></div></div></a>`).join("") || '<p class="soluk">Şu an yok</p>'}</div>
    <div class="bolum-baslik">PlayStation indirimleri <small>PS Store fiyatları dışarıdan okunamıyor; resmi indirim sayfası</small></div>
    <a class="fiyat-satir" href="https://store.playstation.com/tr-tr/pages/deals" target="_blank" rel="noopener"><b>PS Store Türkiye · Fırsatlar</b><span class="soluk">store.playstation.com</span><span class="fiyat">→</span></a>`;
  $("#nobet").innerHTML = "";
}

// ---------- film & dizi ----------
async function diziSayfa(ic) {
  ic.innerHTML = '<div class="iskelet"></div><div class="iskelet"></div>';
  const d = await api("/api/dizi").catch(() => ({}));
  ic.innerHTML = `<div class="bolum-baslik">Yeni bölümü çıkan diziler <small>TVmaze takvimi · IMDb puanı 6.8+ ve 5 bin+ oy · 3 gün</small></div>` +
    ((d.diziler || []).map((x, i) => `<a class="dizi" href="${kac(x.imdb)}" target="_blank" rel="noopener" style="--i:${i}">
      ${x.resim ? `<img loading="lazy" src="${kac(x.resim)}" alt="">` : "<div></div>"}
      <div><b>${kac(x.ad)}</b> <span class="soluk">${kac(x.bolum)}${x.bolum_ad ? " · " + kac(x.bolum_ad) : ""}</span>
        <div class="soluk" style="font-size:13px">${gunSaat(x.ts)} · ${kac(x.kanal || "")} · ${(x.turler || []).join(", ")}</div>
        <p class="k-ozet" style="margin:4px 0 0">${kac(x.ozet || "")}</p></div>
      <span class="imdb">IMDb<b>★ ${x.imdb_puan}</b><small>${Math.round(x.imdb_oy / 1000)}B oy</small></span></a>`).join("") || '<div class="bos">Liste hazırlanıyor (IMDb verisi ilk açılışta indirilir)…</div>');
  $("#nobet").innerHTML = "";
}

// ---------- maclar ----------
function macSatir(m) {
  const canli = m.durum === "in", bitti = m.durum === "post";
  const orta = canli || bitti ? `${m.ev.skor ?? ""} - ${m.dep.skor ?? ""}<small>${canli ? "CANLI · " + kac(m.detay || "") : "Bitti"}</small>` : `${saat(m.ts)}<small>başlamadı</small>`;
  const t = (x, s) => `<div class="takim ${s}">${x.logo ? `<img loading="lazy" src="${kac(x.logo)}" alt="">` : ""}<span>${kac(x.ad)}</span></div>`;
  return `<a class="mac" ${m.link ? `href="${kac(m.link)}" target="_blank" rel="noopener"` : ""}>${t(m.ev, "")}<div class="ortada ${canli ? "canli" : ""}">${orta}</div>${t(m.dep, "dep")}</a>`;
}
async function macSayfa(ic, hs) {
  ic.innerHTML = '<div class="iskelet"></div><div class="iskelet"></div>';
  const d = await api(`/api/maclar?hafta_sonu=${hs ? 1 : 0}`);
  const hakem = d.hakem?.length ? `<div class="hakem"><b>Hakemlik görevlerin</b>${d.hakem.map(m => `<div style="margin-top:6px">${kac(m.tarih)} ${kac(m.saat)} · ${kac(m.ev)} – ${kac(m.dep)}<div class="soluk">${kac(m.salon)} · ${kac(m.gorev)}</div></div>`).join("")}</div>`
    : `<div class="hakem"><b>Hakemlik</b><div class="soluk" style="margin-top:4px">Bu dönem atanmış maçın yok — bültenler saatte bir taranıyor.</div></div>`;
  ic.innerHTML = hakem + (d.gunler || []).map(g => `<div class="gun">${kac(g.gun)}</div>` + (g.ligler.length ? g.ligler.map(l => `<div class="lig"><h3>${kac(l.lig)}<span class="soluk">${l.maclar.length} maç</span></h3>${l.maclar.map(macSatir).join("")}</div>`).join("") : '<p class="bos">Bu gün maç yok</p>')).join("");
  $("#nobet").innerHTML = "";
}

// ---------- uygulamalar ----------
async function uygulamaSayfa(ic) {
  ic.innerHTML = '<div class="iskelet"></div>';
  const d = await api("/api/uygulamalar").catch(() => ({ gruplar: [] }));
  ic.innerHTML = d.gruplar.map(g => `<div class="bolum-baslik">${kac(g.ad)} <small>${g.ogeler.filter(o => o.acik).length}/${g.ogeler.length} çalışıyor</small></div>
    <div class="uyg-izgara">${g.ogeler.map((o, i) => `<a class="uyg" href="${kac(o.href)}" target="_blank" rel="noopener" style="--i:${i}">
      <span class="uyg-ikon">${o.ikon ? `<img loading="lazy" src="${kac(o.ikon)}" alt="" ${o.icon?.startsWith("mdi-") ? 'class="mdi"' : ""}>` : kac([...o.ad][0])}<i class="${o.acik ? "acik" : "kapali"}"></i></span>
      <b>${kac(o.ad)}</b><small>${kac(o.description || "")}</small></a>`).join("")}</div>`).join("") || '<div class="bos">Servis listesi okunamadı</div>';
  $("#nobet").innerHTML = "";
}

// ---------- sunucu ----------
async function sunucuSayfa(ic) {
  const [d, st, kl] = await Promise.all([api("/api/durum"), api("/api/istatistik").catch(() => ({})), api("/api/kaynaklar").catch(() => [])]);
  const dk = ts => ts ? Math.max(0, Math.round((Date.now() / 1000 - ts) / 60)) + " dk önce" : "—";
  const kaynakTablo = `<div class="kutu" style="margin:16px"><h2>Kaynaklar <small class="soluk" style="font-size:13px;font-weight:500">canlı · önemliler 1 dk, diğerleri 3 dk, YouTube 5 dk'da bir kontrol</small></h2>
    <div class="tablo"><div class="t-bas"><span>Kaynak</span><span>Son kontrol</span><span>Son yeni haber</span><span>Gecikme</span></div>
    ${kl.map(x => `<div class="${x.hata ? "t-hata" : ""}"><span>${x.hata ? "! " : ""}${kac(x.ad)}</span><span>${dk(x.son_kontrol)}</span><span>${dk(x.son_yeni)}${x.yeni_sayi ? ` · ${x.yeni_sayi}` : ""}</span>
      <span title="${x.olcum} haberde ölçüldü">${x.hata ? kac(x.hata) : x.gecikme_dk != null ? "~" + x.gecikme_dk + " dk" : "ölçülüyor"}</span></div>`).join("")}</div></div>`;
  ic.innerHTML = `<div class="kutu" style="margin:16px"><h2><span class="nokta ${d.durum === "IYI" ? "" : "kotu"}"></span>${d.durum === "IYI" ? "Her şey yolunda" : "Sorun var"}</h2>
    ${(d.sorunlar || []).map(s => `<div class="oge"><b>! ${kac(s)}</b></div>`).join("")}
    ${(d.bildirimler || []).map(b => `<div class="oge"><b>${kac(b.metin)}</b><small>${kac(b.zaman)} · ${kac(b.seviye)}</small></div>`).join("")}</div>
    <div class="kutu" style="margin:16px"><h2>FLUGEL Akış</h2><div class="oge"><b>${st.kaynak || "?"} kaynak · ${st.toplam || 0} gönderi</b>
      <small>${st.cevrilen || 0} haber Türkçeye çevrildi · ${st.puanlanan || 0} haber AI tarafından puanlandı</small></div></div>
    ${kaynakTablo}
    <div class="kutu" style="margin:16px"><a class="oge" href="#/uygulamalar"><b>Tüm uygulamalar →</b><small>Jellyfin, Immich, Nextcloud ve diğerleri, canlı durumlarıyla</small></a>
    <a class="oge" href="http://<IP>:3011/durum" target="_blank"><b>Ayrıntılı durum sayfası →</b><small>AI analizi ve günlük özet</small></a></div>`;
  $("#nobet").innerHTML = "";
}

// ---------- ayarlar: takip kelimeleri, bildirim, uygulama ----------
async function ayarSayfa(ic) {
  const kelimeler = await api("/api/takip").catch(() => []);
  const bildirim = !("Notification" in window) ? "Bu tarayıcı desteklemiyor" : Notification.permission === "granted" ? "Açık ✓"
    : !isSecureContext ? "Bildirim için uygulamayı https (Tailscale) adresinden aç" : "Kapalı";
  ic.innerHTML = `<div class="kutu" style="margin:16px"><h2>Takip ettiğin kelimeler</h2>
    <div class="oge"><small>Yeni bir haberde bu kelimeler geçince: uygulamada uyarı + bildirim + Telegram'a mesaj.</small></div>
    <div class="ciplar">${kelimeler.map(k => `<span class="cip">${kac(k)}<button data-takip-sil="${kac(k)}">✕</button></span>`).join("")}</div>
    <form class="ara" id="takip-form" style="margin:8px 16px 16px"><input placeholder="ör. Silksong, RTX 5090, One Piece" maxlength="40"><button>Ekle</button></form></div>
    <div class="kutu" style="margin:16px"><h2>Bildirimler</h2><div class="oge"><b>${bildirim}</b>
      ${"Notification" in window && Notification.permission !== "granted" && isSecureContext ? '<button class="ai-buyuk" style="width:auto;padding:8px 18px;margin-top:8px;font-size:14px" data-bildirim-ac>Bildirimlere izin ver</button>' : ""}</div></div>
    <div class="kutu" style="margin:16px"><h2>Telefon</h2>
      <a class="oge" href="/indir/FLUGEL.apk"><b>Android uygulamasını indir (APK)</b><small>Sadece Tailscale ağında çalışır · ek izin istemez, yalnızca bu sayfayı açar</small></a>
      <div class="oge"><b>iPhone / diğer</b><small>https://flugelserver.<tailnet>.ts.net:8443 adresini aç → Paylaş → Ana ekrana ekle</small></div></div>`;
  $("#takip-form").onsubmit = async e => { e.preventDefault(); const v = $("input", e.target).value.trim(); if (v) { await api("/api/takip", { kelime: v }); ayarSayfa(ic); } };
  $("#nobet").innerHTML = "";
}

// ---------- sag sutun ----------
async function sagSutun() {
  if (getComputedStyle($(".sag")).display === "none") return;
  api("/api/durum").then(d => $("#kutu-sunucu").innerHTML = `<a class="oge" href="#/sunucu"><b><span class="nokta ${d.durum === "IYI" ? "" : "kotu"}"></span>flugelserver ${d.durum === "IYI" ? "sağlıklı" : "· sorun var"}</b><small>${d.sorunlar?.length ? kac(d.sorunlar[0]) : "Tüm servisler çalışıyor"}</small></a>`);
  animeAl().then(d => {
    const l = d.anime.filter(a => a.sonraki).slice(0, 4);
    $("#kutu-anime").innerHTML = `<h2>Sıradaki bölümler</h2>` + l.map(a => `<a class="oge" href="${kac(a.izle)}" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:center">
      <img src="${kac(a.kapak)}" style="width:38px;height:54px;object-fit:cover;border-radius:6px" alt=""><span><b>${kac(a.ad)}</b><small>${a.sonraki.episode}. bölüm <span data-geri="${a.sonraki.airingAt}">· ${kalan(a.sonraki.airingAt)}</span></small></span></a>`).join("");
  }).catch(() => {});
  api("/api/akis?k=one&n=5").then(l => { if (l.length) $("#kutu-one").innerHTML = `<h2>▲ Kaçırma</h2>` + l.slice(0, 4).map(o => `<a class="oge" href="${kac(o.link)}" target="_blank" rel="noopener"><small>${kac(o.kaynak)} · ${once(o.ts)}</small><b>${kac(o.baslik_goster)}</b></a>`).join(""); });
  api("/api/gundemde").then(l => $("#kutu-gundemde").innerHTML = `<h2>Gündemde</h2>` + l.slice(0, 7).map((g, i) => `<div class="oge"><small>${i + 1} · son 12 saatte</small><b>${kac(g.konu)}</b><small>${g.sayi} haber</small></div>`).join(""));
  api("/api/maclar?hafta_sonu=1").then(d => {
    const l = (d.gunler || []).flatMap(g => g.ligler.filter(x => ["Süper Lig", "NBA", "Şampiyonlar Ligi", "Premier Lig"].includes(x.lig)).flatMap(x => x.maclar.slice(0, 3).map(m => ({ ...m, lig: x.lig, gun: g.gun })))).slice(0, 5);
    $("#kutu-mac").innerHTML = `<h2>Hafta sonu</h2>` + l.map(m => `<a class="oge" href="#/maclar"><small>${kac(m.gun)} · ${kac(m.lig)}</small><b>${kac(m.ev.ad)} – ${kac(m.dep.ad)}</b><small>${saat(m.ts)}</small></a>`).join("");
  });
}

// ---------- tiklamalar ----------
document.addEventListener("click", async e => {
  const k = e.target.closest("article.kart, .vid");
  const v = e.target.closest("[data-video]");
  if (v && v.dataset.video) {
    e.preventDefault();
    $("#video-iframe").src = `https://www.youtube-nocookie.com/embed/${v.dataset.video}?autoplay=1&rel=0`;
    $("#video").hidden = false;
    if (k) api("/api/okundu", { id: k.dataset.id });
    return;
  }
  if (e.target.closest("[data-menu-ac]")) { e.preventDefault(); $("#tam-menu").hidden = !$("#tam-menu").hidden; return; }
  if (e.target.closest("[data-video-kapat]") || e.target.id === "video") { $("#video").hidden = true; $("#video-iframe").src = ""; return; }
  if (e.target.closest("[data-oku]") && k) { k.classList.add("okundu"); api("/api/okundu", { id: k.dataset.id }); return; }
  if (e.target.closest("[data-kaydet]") && k) {
    const b = e.target.closest("[data-kaydet]"); b.classList.toggle("aktif");
    api("/api/kaydet", { id: k.dataset.id, deger: b.classList.contains("aktif") }); return;
  }
  if (e.target.closest("[data-kume]") && k) {
    const l = $(".kume-liste", k);
    if (l.hidden) l.innerHTML = (await api(`/api/kume?id=${k.dataset.id}`)).map(x => `<a href="${kac(x.link)}" target="_blank" rel="noopener"><b>${kac(x.kaynak)}</b> ${kac(x.baslik)}</a>`).join("");
    l.hidden = !l.hidden; return;
  }
  if (e.target.closest("[data-paylas]") && k) {
    const link = $("[data-oku]", k)?.href; navigator.clipboard?.writeText(link);
    const b = e.target.closest("[data-paylas]"); b.style.color = "var(--yesil)"; setTimeout(() => (b.style.color = ""), 1200); return;
  }
  if (e.target.closest("[data-ozetle]") && k) {
    aiAc(); aiGonder(`Bu haberi 3-4 maddede özetle ve neden önemli olduğunu söyle:\n"${$(".k-baslik", k).textContent}"`, { link: $("[data-oku]", k)?.href }); return;
  }
  const sil = e.target.closest("[data-takip-sil]");
  if (sil) { await api(`/api/takip?kelime=${encodeURIComponent(sil.dataset.takipSil)}`, null, "DELETE"); return ayarSayfa($("#icerik")); }
  if (e.target.closest("[data-bildirim-ac]")) { await Notification.requestPermission(); return ayarSayfa($("#icerik")); }
  if (e.target.closest("[data-ai-ac]")) return aiAc();
  if (e.target.closest("[data-ai-kapat]")) return ($("#ai").hidden = true);
  const oneri = e.target.closest("#ai-oneriler button");
  if (oneri) return aiGonder(oneri.textContent, { genel: true });
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { $("#video").hidden = true; $("#video-iframe").src = ""; $("#ai").hidden = true; $("#tam-menu").hidden = true; } });

// ---------- AI ----------
let aiGecmis = [];
function aiAc() { $("#ai").hidden = false; setTimeout(() => $("#ai-girdi").focus(), 50); }
function msj(sinif, metin) {
  const d = document.createElement("div"); d.className = "msj " + sinif; d.textContent = metin;
  $("#ai-mesajlar").appendChild(d); $("#ai-mesajlar").scrollTop = 1e9; return d;
}
async function aiGonder(metin, ek = {}) {
  if (!metin.trim()) return;
  $("#ai-oneriler").hidden = true;
  msj("ben", metin.length > 300 ? metin.slice(0, 300) + "…" : metin);
  aiGecmis.push({ role: "user", content: metin });
  const cevap = msj("ai yaziyor", "");
  try {
    const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesajlar: aiGecmis, genel: ek.genel ?? !ek.link, link: ek.link }) });
    const okuyucu = r.body.getReader(), coz = new TextDecoder();
    for (;;) {
      const { value, done } = await okuyucu.read();
      if (done) break;
      cevap.textContent += coz.decode(value, { stream: true });
      $("#ai-mesajlar").scrollTop = 1e9;
    }
  } catch (err) { cevap.textContent = "! Bağlantı hatası: " + err; }
  cevap.classList.remove("yaziyor");
  aiGecmis.push({ role: "assistant", content: cevap.textContent });
}
$("#ai-form").onsubmit = e => { e.preventDefault(); const t = $("#ai-girdi"); aiGonder(t.value); t.value = ""; };
$("#ai-girdi").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#ai-form").requestSubmit(); } });

// ---------- yonlendirme ----------
function yonlendir() { sayfaAc(location.hash.replace(/^#\//, "") || "ana"); }
window.addEventListener("hashchange", yonlendir);
menuKur(); yonlendir(); sagSutun(); setInterval(sagSutun, 300000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
