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

// Nutriments calculés (clé -> libellé, unité, décimales, tolérance d'écart)
const NUTRIENTS = {
  cp:  { label: "Protéines brutes", unit: " %",       dec: 1, tol: 1 },
  em:  { label: "Énergie (EM)",     unit: " kcal/kg", dec: 0, tol: 100 },
  ufl: { label: "Énergie (UFL)",    unit: " UFL/kg",  dec: 2, tol: 0.05 },
  mg:  { label: "Matières grasses", unit: " %",       dec: 1, tol: 1.5 },
  cb:  { label: "Cellulose brute",  unit: " %",       dec: 1, tol: 1.5 },
  ca:  { label: "Calcium",          unit: " %",       dec: 2, tol: 0.2 },
  p:   { label: "Phosphore",        unit: " %",       dec: 2, tol: 0.1 },
};

const $ = (s, el = document) => el.querySelector(s);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n, d = 1) => round(n, d).toLocaleString("fr-FR", { maximumFractionDigits: d });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const ING = Object.fromEntries(C.ingredients.map(i => [i.id, i]));

// ---------------------------------------------------------
// Textes simples
// ---------------------------------------------------------
document.querySelectorAll("[data-c]").forEach(el => { el.textContent = get(C, el.dataset.c) ?? ""; });
$("#aboutText").innerHTML = C.about.paragraphs.map(p => `<p>${esc(p)}</p>`).join("");
$("#telLink").href = `tel:${C.company.phone.replace(/[^\d+]/g, "")}`;
$("#mailLink").href = `mailto:${C.company.email}`;
$("#factSpecies").textContent = C.species.length;
$("#factMin").textContent = `${C.feed.minKg} kg`;
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

function card({ icon, media, title, usage, desc, items, price, tag, btn, main }) {
  return `
    <article class="product${main ? " product-main" : ""}">
      <div class="product-media ${media}"><svg><use href="#i-${esc(icon)}"/></svg>${tag ? `<span class="tag">${esc(tag)}</span>` : ""}</div>
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

const offers = C.chickens.offers.filter(o => o.visible !== false);
$("#chickenOffers").innerHTML = offers.map(o => card({
  icon: o.icon, media: MEDIA[o.icon] || "media-green", title: o.title, usage: o.usage, desc: o.desc,
  items: o.items, price: o.price,
  btn: `<a href="#contact" class="btn btn-outline" data-product="${esc("Poulets — " + o.title)}">Commander</a>`,
})).join("");

let other = "";
if (C.eggs.visible !== false) other += card({
  icon: "egg", media: "media-amber", title: C.eggs.title, desc: C.eggs.desc, items: C.eggs.items, price: C.eggs.price,
  btn: `<a href="#contact" class="btn btn-outline" data-product="Œufs">Demander un devis</a>`,
});
other += card({
  icon: "sack", media: "media-orange", title: C.feed.title, desc: C.feed.desc, tag: "Sur mesure", main: true,
  items: [C.species.map(s => s.name).join(", "), ...C.feed.items],
  btn: `<a href="#composition" class="btn btn-primary">Composer ma formule</a>`,
});
$("#otherProducts").innerHTML = other;

// Liste des produits du formulaire de commande
$("#produitSelect").innerHTML = ["— Choisir —", ...offers.map(o => "Poulets — " + o.title),
  ...(C.eggs.visible !== false ? ["Œufs"] : []), "Aliment sur mesure", "Plusieurs produits"]
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
// Composition sur mesure
// ---------------------------------------------------------
const state = {};
let species = C.species[0];
const presetSel = $("#preset");
const ingBox = $("#ingredients");

$("#form").innerHTML = C.feed.forms.map(f => `<option${f === "Granulés" ? " selected" : ""}>${esc(f)}</option>`).join("");

$("#speciesTabs").innerHTML = C.species.map((s, i) => `
  <button type="button" role="tab" class="species-tab" data-sp="${esc(s.id)}" aria-selected="${i === 0}">
    <svg class="ico-lg"><use href="#i-${esc(s.icon)}"/></svg><span>${esc(s.name)}</span>
  </button>`).join("");
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
  presetSel.innerHTML = species.formulas.map(f => `<option value="${esc(f.id)}">${esc(f.label)}</option>`).join("");
  const def = species.formulas.find(f => f.id === "croissance");
  if (def) presetSel.value = def.id;
  renderIngredients();
  loadPreset();
}

function formula() { return species.formulas.find(f => f.id === presetSel.value) || species.formulas[0]; }
function ingList() { return species.ingredients.map(id => ING[id]).filter(Boolean); }

function renderIngredients() {
  ingBox.innerHTML = ingList().map(i => `
    <div class="ing" data-id="${esc(i.id)}" data-cat="${esc(i.cat)}">
      <div class="ing-name"><i class="dot dot-${esc(i.cat)}"></i><span>${esc(i.name)}<small>${esc(i.info)}</small></span></div>
      <input type="range" min="0" max="${i.max}" step="0.1" aria-label="${esc(i.name)}">
      <div class="ing-num"><input type="number" min="0" max="100" step="0.1" aria-label="${esc(i.name)} en %"><span>%</span></div>
    </div>`).join("");

  ingBox.querySelectorAll(".ing").forEach(row => {
    const id = row.dataset.id;
    const range = $("input[type=range]", row);
    const num = $("input[type=number]", row);
    range.addEventListener("input", () => { state[id] = +range.value; num.value = range.value; paint(range); update(); });
    num.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, parseFloat(num.value) || 0));
      state[id] = v; range.value = v; paint(range); update();
    });
  });
}

// remplissage coloré de la piste du curseur
function paint(range) {
  range.style.setProperty("--p", `${Math.min(100, (range.value / range.max) * 100)}%`);
}

function loadPreset() {
  Object.keys(state).forEach(k => delete state[k]);
  ingList().forEach(i => { state[i.id] = +(formula().mix[i.id] || 0); });
  syncInputs();
  update();
}

function syncInputs() {
  ingBox.querySelectorAll(".ing").forEach(row => {
    const v = state[row.dataset.id] || 0;
    const range = $("input[type=range]", row);
    range.value = v;
    paint(range);
    $("input[type=number]", row).value = round(v, 1);
  });
}

const total = () => Object.values(state).reduce((s, v) => s + v, 0);

function computeNutrients() {
  const t = total() || 1;
  const res = Object.fromEntries(Object.keys(NUTRIENTS).map(k => [k, 0]));
  Object.entries(state).forEach(([id, v]) => {
    Object.keys(res).forEach(k => { res[k] += (v / t) * (+ING[id][k] || 0); });
  });
  return res;
}

function update() {
  const t = round(total(), 1);
  const ok = Math.abs(t - 100) < 0.05;
  $("#totalVal").textContent = `${fmt(t)} %`;
  $("#totalBar").style.width = `${Math.min(t, 100)}%`;
  $("#totalBox").classList.toggle("bad", !ok);
  $("#totalMsg").textContent = ok ? "Formule complète"
    : t < 100 ? `Il manque ${fmt(100 - t)} %` : `Dépassement de ${fmt(t - 100)} %`;

  const res = computeNutrients();
  const target = formula().target || {};
  $("#nutri").innerHTML = species.nutrients.map(k => {
    const n = NUTRIENTS[k];
    const v = res[k];
    const tg = target[k];
    let cls = "", tgTxt = "";
    if (tg !== undefined && tg !== null && tg !== "") {
      cls = Math.abs(v - tg) <= n.tol ? "ok" : "warn";
      tgTxt = `<span class="target">Recommandé : ${fmt(tg, n.dec)}${n.unit} · ${cls === "ok" ? "conforme" : "à ajuster"}</span>`;
    }
    return `<div class="nutri-item"><span>${n.label}</span><span class="val ${cls}">${fmt(v, n.dec)}${n.unit}</span>${tgTxt}</div>`;
  }).join("");
}

$("#resetBtn").addEventListener("click", loadPreset);
presetSel.addEventListener("change", loadPreset);
$("#normalizeBtn").addEventListener("click", () => {
  const t = total();
  if (!t) return;
  Object.keys(state).forEach(id => { state[id] = round(state[id] * 100 / t, 1); });
  // corrige l'arrondi sur l'ingrédient principal
  const main = Object.keys(state).reduce((a, b) => (state[a] >= state[b] ? a : b));
  state[main] = round(state[main] + 100 - total(), 1);
  syncInputs(); update();
});

$("#useFormula").addEventListener("click", () => {
  const t = round(total(), 1);
  if (Math.abs(t - 100) >= 0.05) {
    $("#totalMsg").textContent = `Le total doit faire 100 % avant de commander (actuellement ${fmt(t)} %).`;
    return;
  }
  const res = computeNutrients();
  const qty = parseInt($("#qty").value, 10) || 0;
  const lines = Object.entries(state).filter(([, v]) => v > 0)
    .map(([id, v]) => `- ${ING[id].name} : ${fmt(v)} %`);
  const vals = species.nutrients.map(k => `${NUTRIENTS[k].label.toLowerCase()} ${fmt(res[k], NUTRIENTS[k].dec)}${NUTRIENTS[k].unit}`);
  track("formula_composed", { species: species.name, formula: formula().label });
  $("#produitSelect").value = "Aliment sur mesure";
  $("#details").value =
`Espèce : ${species.name}
Formule : ${formula().label} (${$("#form").value})
Quantité : ${qty} kg

Composition :
${lines.join("\n")}

Valeurs estimées : ${vals.join(", ")}.`;
  $("#contact").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => $("#f-nom").focus({ preventScroll: true }), 600);
});

selectSpecies(C.species[0].id);

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
