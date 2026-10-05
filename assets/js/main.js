/* =========================================================
   SANA — Site vitrine
   Tout le contenu vient de data/content.js (modifiable depuis admin.html).
   ========================================================= */

const DRAFT_KEY = "sana-draft";
const PREVIEW_KEY = "sana-preview";

// Complète un contenu ancien avec les champs ajoutés depuis
function withDefaults(obj, def) {
  for (const k in def) {
    if (obj[k] === undefined) obj[k] = JSON.parse(JSON.stringify(def[k]));
    else if (def[k] && typeof def[k] === "object" && !Array.isArray(def[k])) withDefaults(obj[k], def[k]);
  }
  return obj;
}

// Brouillon de l'admin : visible uniquement sur l'appareil qui l'a créé
function loadContent() {
  try {
    if (localStorage.getItem(PREVIEW_KEY) === "1") {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (draft) { document.getElementById("previewBar").hidden = false; return withDefaults(draft, window.SANA_CONTENT); }
    }
  } catch (e) { /* stockage indisponible */ }
  return window.SANA_CONTENT;
}
const C = loadContent();

const $ = (s, el = document) => el.querySelector(s);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n, d = 1) => round(n, d).toLocaleString("fr-FR", { maximumFractionDigits: d });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

// ---------------------------------------------------------
// Textes simples
// ---------------------------------------------------------
document.querySelectorAll("[data-c]").forEach(el => { el.textContent = get(C, el.dataset.c) ?? ""; });
$("#aboutText").innerHTML = C.about.paragraphs.map(p => `<p>${esc(p)}</p>`).join("");
$("#telLink").href = `tel:${C.company.phone.replace(/[^\d+]/g, "")}`;
$("#mailLink").href = `mailto:${C.company.email}`;
$("#qty").min = C.feed.minKg;
$("#footTel").href = $("#telLink").href;
$("#footMail").href = $("#mailLink").href;
const M = C.marketing;

// ---------------------------------------------------------
// Référencement (Google, partage sur les réseaux)
// ---------------------------------------------------------
function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = value;
}
document.title = M.seo.title;
setMeta("name", "description", M.seo.description);
setMeta("property", "og:title", M.seo.title);
setMeta("property", "og:description", M.seo.description);
$("#ldjson").textContent = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: `${C.company.name} — ${C.company.fullName}`,
  description: M.seo.description,
  url: M.seo.siteUrl || location.href.split("#")[0],
  logo: new URL("assets/img/logo-sana.png", M.seo.siteUrl || location.href).href,
  image: new URL("assets/img/og-image.png", M.seo.siteUrl || location.href).href,
  telephone: C.company.phone,
  email: C.company.email,
  address: { "@type": "PostalAddress", streetAddress: C.company.address, addressLocality: "Yamoussoukro", addressCountry: "CI" },
  openingHours: C.company.hours,
  sameAs: Object.values(M.social).filter(Boolean),
});

// ---------------------------------------------------------
// Suivi des campagnes (liens ?utm_source=facebook&utm_campaign=…)
// ---------------------------------------------------------
const UTM_KEY = "sana-utm";
(() => {
  const q = new URLSearchParams(location.search);
  const utm = ["utm_source", "utm_medium", "utm_campaign"].map(k => q.get(k)).filter(Boolean);
  try { if (utm.length) sessionStorage.setItem(UTM_KEY, utm.join(" / ")); } catch (e) {}
})();
function campaign() { try { return sessionStorage.getItem(UTM_KEY) || ""; } catch (e) { return ""; } }

// ---------------------------------------------------------
// Mesure d'audience (activée seulement si les identifiants sont renseignés)
// ---------------------------------------------------------
function loadScript(src) { const s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }
if (/^G-[A-Z0-9]+$/i.test(M.analytics.ga4)) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", M.analytics.ga4);
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${M.analytics.ga4}`);
}
if (/^\d{6,20}$/.test(M.analytics.metaPixel)) {
  const f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
  f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
  if (!window._fbq) window._fbq = f;
  fbq("init", M.analytics.metaPixel);
  fbq("track", "PageView");
  loadScript("https://connect.facebook.net/en_US/fbevents.js");
}
// Événements : contact WhatsApp, demande de devis, formule composée
function track(event, params = {}) {
  if (window.gtag) gtag("event", event, params);
  if (window.fbq) fbq(event === "generate_lead" ? "track" : "trackCustom", event === "generate_lead" ? "Lead" : event, params);
}

// ---------------------------------------------------------
// Bandeau promotionnel
// ---------------------------------------------------------
if (M.promo.visible && M.promo.text) {
  $("#promoBar").hidden = false;
  $("#promoText").textContent = M.promo.text;
  if (M.promo.linkText) { $("#promoLink").textContent = M.promo.linkText; $("#promoLink").href = M.promo.link || "#contact"; }
}

// ---------------------------------------------------------
// Réseaux sociaux
// ---------------------------------------------------------
const SOCIAL = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const socialsHtml = Object.entries(SOCIAL).filter(([k]) => M.social[k])
  .map(([k, label]) => `<a href="${esc(M.social[k])}" target="_blank" rel="noopener" aria-label="${label}" title="${label}"><svg><use href="#i-${k}"/></svg></a>`).join("");
document.querySelectorAll("[data-socials]").forEach(el => { el.innerHTML = socialsHtml; el.hidden = !socialsHtml; });

// ---------------------------------------------------------
// Sections éditables : atouts, étapes, avis, questions
// ---------------------------------------------------------
$("#features").innerHTML = C.about.features.map(f =>
  `<li><svg class="ico-lg"><use href="#i-${esc(f.icon)}"/></svg><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join("");
$("#steps").innerHTML = C.steps.map((st, i) =>
  `<li><span class="step-n">${i + 1}</span><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p></li>`).join("");

const reviews = (C.testimonials || []).filter(t => t.text);
if (reviews.length) {
  $("#avis").hidden = false;
  $("#testimonials").innerHTML = reviews.map(t => `
    <figure class="review">
      <svg class="ico-lg"><use href="#i-quote"/></svg>
      <blockquote>${esc(t.text)}</blockquote>
      <figcaption><strong>${esc(t.name)}</strong>${t.role ? `<span>${esc(t.role)}</span>` : ""}</figcaption>
    </figure>`).join("");
}

const faq = (C.faq || []).filter(f => f.q && f.a);
$("#faq").hidden = !faq.length;
$("#faqList").innerHTML = faq.map((f, i) => `
  <details class="faq-item"${i === 0 ? " open" : ""}>
    <summary><span>${esc(f.q)}</span><svg class="ico"><use href="#i-plus"/></svg></summary>
    <p>${esc(f.a)}</p>
  </details>`).join("");

// Liens WhatsApp directs (bandeau d'appel, bouton flottant)
function waLink(text) {
  const src = campaign();
  const body = text + (src ? `\n\n(Source : ${src})` : "");
  return `https://wa.me/${C.company.whatsapp}?text=${encodeURIComponent(body)}`;
}
$("#ctaWa").href = waLink(`Bonjour ${C.company.name}, je souhaite un devis.`);

// ---------------------------------------------------------
// Produits
// ---------------------------------------------------------
const MEDIA = { chick: "media-amber", chicken: "media-green", drumstick: "media-orange" };

const isSoon = x => x && x.status === "soon";
// Bouton « Être prévenu » : message WhatsApp pré-rempli pour un produit pas encore lancé
const notifyBtn = name => `<a href="${waLink(`Bonjour ${C.company.name}, prévenez-moi quand ce produit sera disponible : ${name}.`)}" target="_blank" rel="noopener" class="btn btn-ghost" data-notify="${esc(name)}">Être prévenu</a>`;

function card({ icon, media, title, usage, desc, items, price, tag, btn, main, soon }) {
  return `
    <article class="product${main ? " product-main" : ""}${soon ? " is-soon" : ""}">
      <div class="product-media ${media}"><svg><use href="#i-${esc(icon)}"/></svg>${soon ? `<span class="tag tag-soon">Bientôt</span>` : tag ? `<span class="tag">${esc(tag)}</span>` : ""}</div>
      <div class="product-body">
        ${usage ? `<span class="usage">${esc(usage)}</span>` : ""}
        <h3>${esc(title)}</h3>
        <p>${esc(desc)}</p>
        <ul class="checklist">${(items || []).filter(Boolean).map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        ${price ? `<p class="price">${esc(price)}</p>` : ""}
        ${btn}
      </div>
    </article>`;
}

// Produit phare disponible : œufs à couver
const H = C.hatching;
if (H && H.visible !== false) {
  $("#hatchingCard").innerHTML = `
    <article class="feature-product">
      <div class="fp-media"><svg><use href="#i-egg"/></svg>${isSoon(H) ? `<span class="tag tag-soon">Bientôt</span>` : `<span class="tag tag-live">Disponible</span>`}</div>
      <div class="fp-body">
        ${H.usage ? `<span class="usage">${esc(H.usage)}</span>` : ""}
        <h3>${esc(H.title)}</h3>
        <p>${esc(H.desc)}</p>
        <ul class="checklist">${(H.items || []).filter(Boolean).map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        ${H.price ? `<p class="price">${esc(H.price)}</p>` : ""}
        <div class="fp-actions">
          ${isSoon(H) ? notifyBtn(H.title) : `<a href="${waLink(`Bonjour ${C.company.name}, je souhaite commander des œufs à couver.`)}" target="_blank" rel="noopener" class="btn btn-accent btn-lg" data-wa-order="1"><svg class="ico"><use href="#i-wa"/></svg> Commander sur WhatsApp</a>
          <a href="#contact" class="btn btn-outline" data-product="${esc(H.title)}">Formulaire de commande</a>`}
        </div>
      </div>
    </article>`;
} else {
  $("#disponible").hidden = true;
}

const offers = C.chickens.offers.filter(o => o.visible !== false);
$("#chickenOffers").innerHTML = offers.map(o => card({
  icon: o.icon, media: MEDIA[o.icon] || "media-green", title: o.title, usage: o.usage, desc: o.desc,
  items: o.items, price: o.price, soon: isSoon(o),
  btn: isSoon(o) ? notifyBtn(o.title) : `<a href="#contact" class="btn btn-outline" data-product="${esc("Poulets — " + o.title)}">Commander</a>`,
})).join("");

let other = "";
if (C.eggs.visible !== false) other += card({
  icon: "egg", media: "media-amber", title: C.eggs.title, desc: C.eggs.desc, items: C.eggs.items, price: C.eggs.price, soon: isSoon(C.eggs),
  btn: isSoon(C.eggs) ? notifyBtn(C.eggs.title) : `<a href="#contact" class="btn btn-outline" data-product="Œufs">Demander un devis</a>`,
});
other += card({
  icon: "sack", media: "media-orange", title: C.feed.title, desc: C.feed.desc, tag: "Sur mesure", main: !isSoon(C.feed), soon: isSoon(C.feed),
  items: [C.species.map(s => s.name).join(", "), ...C.feed.items],
  btn: isSoon(C.feed) ? `<a href="#composition" class="btn btn-ghost">Être prévenu au lancement</a>` : `<a href="#composition" class="btn btn-primary">Demander mon aliment</a>`,
});
$("#otherProducts").innerHTML = other;

// Liste des produits du formulaire de commande (produits disponibles d'abord)
const lbl = (name, soon) => soon ? `${name} (bientôt)` : name;
$("#produitSelect").innerHTML = ["— Choisir —",
  ...(H && H.visible !== false ? [lbl(H.title, isSoon(H))] : []),
  ...offers.map(o => lbl("Poulets — " + o.title, isSoon(o))),
  ...(C.eggs.visible !== false ? [lbl("Œufs", isSoon(C.eggs))] : []),
  lbl("Aliment sur mesure", isSoon(C.feed)), "Plusieurs produits"]
  .map((p, i) => `<option${i === 0 ? ' value=""' : ""}>${esc(p)}</option>`).join("");

document.addEventListener("click", e => {
  const b = e.target.closest("[data-product]");
  if (b) $("#produitSelect").value = b.dataset.product;
});

// ---------------------------------------------------------
// Menu mobile
// ---------------------------------------------------------
const toggle = $("#navToggle");
const links = $("#navLinks");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
links.addEventListener("click", e => {
  if (e.target.tagName === "A") { links.classList.remove("open"); toggle.setAttribute("aria-expanded", false); }
});

// ---------------------------------------------------------
// Demande d'aliment sur mesure (aucune formule n'est affichée : SANA l'établit)
// ---------------------------------------------------------
let species = C.species[0];
const stageSel = $("#stage");
const stagesOf = s => s.stages || s.formulas || [];

$("#form").innerHTML = C.feed.forms.map(f => `<option${f === "Granulés" ? " selected" : ""}>${esc(f)}</option>`).join("");
$("#qty").value = Math.max(C.feed.minKg, 500);

$("#speciesTabs").innerHTML = C.species.map((s, i) => `
  <button type="button" role="tab" class="species-tab" data-sp="${esc(s.id)}" aria-selected="${i === 0}">
    <svg class="ico-lg"><use href="#i-${esc(s.icon)}"/></svg><span>${esc(s.name)}</span>
  </button>`).join("");
$("#heroChips").innerHTML = C.species.map((s, i) => `
  <span class="hv-chip" style="--k:${i};--n:${C.species.length}"><svg class="ico-lg"><use href="#i-${esc(s.icon)}"/></svg>${esc(s.name)}</span>`).join("");
$("#speciesStrip").innerHTML = C.species.map(s => `
  <a href="#composition" class="strip-item" data-sp="${esc(s.id)}"><svg class="ico-lg"><use href="#i-${esc(s.icon)}"/></svg><span>${esc(s.name)}</span></a>`).join("");
$("#speciesStrip").addEventListener("click", e => {
  const a = e.target.closest("[data-sp]");
  if (a) selectSpecies(a.dataset.sp);
});
$("#speciesTabs").addEventListener("click", e => {
  const b = e.target.closest(".species-tab");
  if (b) selectSpecies(b.dataset.sp);
});

function selectSpecies(id) {
  species = C.species.find(s => s.id === id) || C.species[0];
  document.querySelectorAll(".species-tab").forEach(b => b.setAttribute("aria-selected", b.dataset.sp === species.id));
  $("#reqIcon").setAttribute("href", `#i-${species.icon}`);
  stageSel.innerHTML = stagesOf(species).map(f => `<option>${esc(f.label)}</option>`).join("")
    + `<option value="">Autre / à définir avec vous</option>`;
  updateSummary();
}

function request() {
  return {
    species: species.name,
    stage: stageSel.value || "À définir avec SANA",
    form: $("#form").value,
    qty: Math.max(0, parseInt($("#qty").value, 10) || 0),
    freq: $("#freq").value,
    heads: $("#heads").value.trim(),
    notes: $("#needs").value.trim(),
  };
}

function updateSummary() {
  const r = request();
  $("#reqTitle").textContent = r.species;
  $("#reqList").innerHTML = [
    ["Aliment", r.stage],
    ["Présentation", r.form],
    ["Quantité", r.qty ? `${r.qty.toLocaleString("fr-FR")} kg` : "—"],
    ["Fréquence", r.freq],
    ...(r.heads ? [["Animaux", r.heads]] : []),
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  const low = r.qty && r.qty < C.feed.minKg;
  $("#reqMsg").textContent = low ? `La commande minimum est de ${C.feed.minKg} kg.` : "";
}
["#stage", "#form", "#qty", "#freq", "#heads", "#needs"].forEach(id => $(id).addEventListener("input", updateSummary));

$("#sendRequest").addEventListener("click", () => {
  const r = request();
  if (!r.qty || r.qty < C.feed.minKg) {
    $("#reqMsg").textContent = `Indiquez une quantité d'au moins ${C.feed.minKg} kg.`;
    $("#qty").focus();
    return;
  }
  track("feed_request", { species: r.species, stage: r.stage });
  $("#produitSelect").value = lbl("Aliment sur mesure", isSoon(C.feed));
  $("#details").value =
`${isSoon(C.feed) ? "Pré-inscription : prévenez-moi au lancement de l'aliment sur mesure" : "Demande d'aliment sur mesure"}
Espèce : ${r.species}
Aliment : ${r.stage}
Présentation : ${r.form}
Quantité : ${r.qty} kg (${r.freq.toLowerCase()})${r.heads ? `\nNombre d'animaux : ${r.heads}` : ""}${r.notes ? `\n\nBesoins particuliers : ${r.notes}` : ""}`;
  $("#contact").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => $("#f-nom").focus({ preventScroll: true }), 600);
});

selectSpecies(C.species[0].id);

// Aliment pas encore lancé : on recueille les demandes pour prévenir les clients
if (isSoon(C.feed)) {
  $("#feedSoon").hidden = false;
  $("#sendRequest").textContent = "Être prévenu au lancement";
  document.querySelector(".req-promise").innerHTML = "<li>Les aliments SANA arrivent bientôt</li><li>Laissez votre demande : nous vous contactons au lancement</li><li>Nos formules restent confidentielles</li>";
  document.querySelector(".strip-label").textContent = "Bientôt : aliments pour";
}

// ---------------------------------------------------------
// Formulaire de commande (WhatsApp / e-mail)
// ---------------------------------------------------------
const form = $("#orderForm");
const msg = $("#formMsg");
let channel = "whatsapp";
form.querySelectorAll("button[type=submit]").forEach(b =>
  b.addEventListener("click", () => { channel = b.dataset.channel; }));

form.addEventListener("submit", e => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll("[required]").forEach(f => {
    const bad = !f.value.trim();
    f.classList.toggle("invalid", bad);
    if (bad) valid = false;
  });
  if (!valid) {
    msg.className = "form-msg error";
    msg.textContent = "Merci de remplir les champs obligatoires (*).";
    return;
  }
  const d = Object.fromEntries(new FormData(form));
  const body =
`Bonjour ${C.company.name},

Nom : ${d.nom}
Téléphone : ${d.tel}
Ville : ${d.ville || "-"}
Produit : ${d.produit}

${d.details}${campaign() ? `\n\n(Source : ${campaign()})` : ""}`;
  track("generate_lead", { channel, product: d.produit });

  if (channel === "whatsapp") {
    window.open(`https://wa.me/${C.company.whatsapp}?text=${encodeURIComponent(body)}`, "_blank", "noopener");
  } else {
    location.href = `mailto:${C.company.email}?subject=${encodeURIComponent("Commande — " + d.produit)}&body=${encodeURIComponent(body)}`;
  }
  msg.className = "form-msg success";
  msg.textContent = "Merci ! Votre demande est prête à être envoyée. Nous vous répondons sous 24 h.";
});

// ---------------------------------------------------------
// Divers
// ---------------------------------------------------------
$("#year").textContent = new Date().getFullYear();
$("#waFloat").href = waLink(`Bonjour ${C.company.name}, `);
document.querySelectorAll("#waFloat, #ctaWa").forEach(a => a.addEventListener("click", () => track("whatsapp_click", { from: a.id })));
$("#waFloat").target = "_blank";
$("#waFloat").rel = "noopener";
$("#exitPreview").addEventListener("click", () => {
  try { localStorage.removeItem(PREVIEW_KEY); } catch (e) {}
  location.reload();
});
