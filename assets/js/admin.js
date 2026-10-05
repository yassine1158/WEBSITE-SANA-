/* =========================================================
   SANA — Administration du contenu
   Modifie data/content.js : brouillon local, aperçu, puis publication sur GitHub.
   ========================================================= */

const DRAFT_KEY = "sana-draft";
const PREVIEW_KEY = "sana-preview";
const GH_KEY = "sana-github";
const TAB_KEY = "sana-admin-tab";

const NUTRIENTS = {
  cp: "Protéines brutes (%)", em: "Énergie EM (kcal/kg)", ufl: "Énergie UFL (/kg)",
  mg: "Matières grasses (%)", cb: "Cellulose brute (%)", ca: "Calcium (%)", p: "Phosphore (%)",
};
const ICONS = { chick: "Poussin", chicken: "Poule", drumstick: "Cuisse", cow: "Vache", sheep: "Mouton", pig: "Porc", rabbit: "Lapin", fish: "Poisson" };
const FEATURE_ICONS = { flask: "Fiole", shield: "Bouclier", truck: "Camion", chat: "Message", sack: "Sac", egg: "Œuf", chicken: "Poule", cow: "Vache", clock: "Horloge", pin: "Lieu" };
const CATS = { energy: "Énergie", protein: "Protéines", fiber: "Fibres", mineral: "Minéraux & additifs" };

const $ = (s, el = document) => el.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const slug = s => (String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x") + "-" + Math.random().toString(36).slice(2, 6);

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// Complète un contenu ancien avec les champs ajoutés depuis
function withDefaults(obj, def) {
  for (const k in def) {
    if (obj[k] === undefined) obj[k] = clone(def[k]);
    else if (def[k] && typeof def[k] === "object" && !Array.isArray(def[k])) withDefaults(obj[k], def[k]);
  }
  return obj;
}

// Les formules sont confidentielles : aucun pourcentage ni valeur nutritionnelle n'est conservé ou publié
function sanitize(d) {
  delete d.ingredients;
  (d.species || []).forEach(sp => {
    sp.stages = (sp.stages || sp.formulas || []).map(st => ({ id: st.id || "", label: st.label || "" }));
    delete sp.formulas; delete sp.ingredients; delete sp.nutrients;
  });
  return d;
}

let published = sanitize(clone(window.SANA_CONTENT));
let data = (() => { try { const d = JSON.parse(store.get(DRAFT_KEY)); return d ? sanitize(withDefaults(d, published)) : clone(published); } catch (e) { return clone(published); } })();
let tab = store.get(TAB_KEY) || "societe";
let ghMemory = null; // jeton déchiffré, gardé en mémoire tant que l'admin est déverrouillée
let vaultPass = null;

// ---------------------------------------------------------
// Accès aux valeurs par chemin ("chickens.offers.0.title")
// ---------------------------------------------------------
const getP = path => path.split(".").reduce((o, k) => (o == null ? o : o[k]), data);
function setP(path, v) {
  const keys = path.split(".");
  const last = keys.pop();
  const obj = keys.reduce((o, k) => (o[k] ??= {}), data);
  obj[last] = v;
}
function delP(path) {
  const keys = path.split(".");
  const last = keys.pop();
  const obj = keys.reduce((o, k) => (o == null ? o : o[k]), data);
  if (obj) delete obj[last];
}

// ---------------------------------------------------------
// Champs de formulaire
// ---------------------------------------------------------
const help = h => (h ? `<em class="help">${h}</em>` : "");
const F = {
  text: (label, path, o = {}) => `<label class="field ${o.cls || ""}"><span>${label}</span>${help(o.help)}<input data-path="${path}" value="${esc(getP(path))}" placeholder="${esc(o.ph || "")}"></label>`,
  area: (label, path, o = {}) => `<label class="field ${o.cls || ""}"><span>${label}</span>${help(o.help)}<textarea data-path="${path}" rows="${o.rows || 3}">${esc(getP(path))}</textarea></label>`,
  lines: (label, path, o = {}) => `<label class="field ${o.cls || ""}"><span>${label}</span>${help(o.help || "Un élément par ligne.")}<textarea data-path="${path}" data-type="lines" rows="${o.rows || 4}">${esc((getP(path) || []).join("\n"))}</textarea></label>`,
  num: (label, path, o = {}) => `<label class="field ${o.cls || ""}"><span>${label}</span>${help(o.help)}<input type="number" step="any" data-path="${path}" data-type="number" ${o.optional ? 'data-optional="1"' : ""} value="${getP(path) ?? ""}"></label>`,
  bool: (label, path) => `<label class="check"><input type="checkbox" data-path="${path}" data-type="bool" ${getP(path) !== false ? "checked" : ""}><span>${label}</span></label>`,
  select: (label, path, options, o = {}) => `<label class="field ${o.cls || ""}"><span>${label}</span><select data-path="${path}" ${o.rerender ? 'data-rerender="1"' : ""}>${Object.entries(options).map(([v, t]) => `<option value="${v}" ${getP(path) === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`,
};
const card = (title, body, tools = "") => `<section class="a-card"><header><h3>${title}</h3><div class="tools">${tools}</div></header>${body}</section>`;
const btn = (label, act, attrs = "", cls = "btn-ghost") => `<button type="button" class="btn ${cls} btn-sm" data-act="${act}" ${attrs}>${label}</button>`;
const del = (act, attrs) => `<button type="button" class="btn btn-danger btn-sm" data-act="${act}" data-confirm="1" ${attrs}>Supprimer</button>`;

// Liste d'éléments éditables (atouts, étapes, avis, questions)
function list(path, title, fields, blank, addLabel) {
  const arr = getP(path) || [];
  return arr.map((it, i) => card(esc(title(it, i)), fields(`${path}.${i}`),
    `${i > 0 ? btn("↑", "move-item", `data-list="${path}" data-i="${i}" data-d="-1" aria-label="Monter"`) : ""}
     ${i < arr.length - 1 ? btn("↓", "move-item", `data-list="${path}" data-i="${i}" data-d="1" aria-label="Descendre"`) : ""}
     ${del("del-item", `data-list="${path}" data-i="${i}"`)}`)).join("")
    + btn(addLabel, "add-item", `data-list="${path}" data-blank="${esc(JSON.stringify(blank))}"`, "btn-primary");
}

// ---------------------------------------------------------
// Onglets
// ---------------------------------------------------------
const TABS = {
  societe: () => `
    <h2>Société &amp; contact</h2>
    <p class="intro">Ces informations apparaissent dans l'en-tête, la section contact et le pied de page.</p>
    ${card("Identité", `<div class="grid-2">
      ${F.text("Nom court", "company.name")}
      ${F.text("Nom complet", "company.fullName")}</div>`)}
    ${card("Coordonnées", `<div class="grid-2">
      ${F.text("Téléphone affiché", "company.phone", { ph: "+225 07 00 00 00 00" })}
      ${F.text("Numéro WhatsApp", "company.whatsapp", { help: "Format international sans + ni espaces, ex. : 2250700000000.", ph: "225…" })}
      ${F.text("E-mail", "company.email")}
      ${F.text("Horaires", "company.hours")}</div>
      ${F.text("Adresse", "company.address")}`)}`,

  accueil: () => `
    <h2>Accueil</h2>
    ${card("Bandeau principal", `
      ${F.text("Titre", "hero.title")}
      ${F.text("Suite du titre (en orange)", "hero.highlight")}
      ${F.area("Texte d'introduction", "hero.lead", { rows: 4 })}`)}
    ${card("La société", `
      ${F.text("Titre", "about.title")}
      ${F.lines("Paragraphes", "about.paragraphs", { help: "Un paragraphe par ligne.", rows: 6 })}`)}
    <h3 class="group">Atouts (section « La société »)</h3>
    ${list("about.features", f => f.title || "Nouvel atout", b => `
      <div class="grid-2">${F.text("Titre", b + ".title")}${F.select("Icône", b + ".icon", FEATURE_ICONS)}</div>
      ${F.area("Texte", b + ".text", { rows: 2 })}`, { icon: "flask", title: "", text: "" }, "+ Ajouter un atout")}
    <h3 class="group">Étapes de commande</h3>
    ${list("steps", (st, i) => `Étape ${i + 1} — ${st.title || ""}`, b => `
      ${F.text("Titre", b + ".title")}${F.area("Texte", b + ".text", { rows: 2 })}`, { title: "", text: "" }, "+ Ajouter une étape")}`,

  marketing: () => {
    const base = data.marketing.seo.siteUrl || "https://votre-site/";
    return `
    <h2>Marketing</h2>
    <p class="intro">Promotions, réseaux sociaux, mesure d'audience et référencement Google.</p>
    ${card("Bandeau promotionnel", `
      ${F.bool("Afficher le bandeau en haut du site", "marketing.promo.visible")}
      ${F.text("Message", "marketing.promo.text", { ph: "Ex. : livraison offerte dès 1 tonne" })}
      <div class="grid-2">${F.text("Texte du lien (optionnel)", "marketing.promo.linkText")}${F.text("Lien", "marketing.promo.link", { help: "#composition, #poulets, #contact ou une adresse complète." })}</div>`)}
    ${card("Bandeau d'appel WhatsApp", `
      ${F.text("Titre", "marketing.cta.title")}
      ${F.area("Texte", "marketing.cta.text", { rows: 2 })}
      ${F.text("Bouton", "marketing.cta.button")}`)}
    ${card("Réseaux sociaux", `
      <p class="intro">Collez l'adresse complète de chaque page. Les icônes apparaissent seulement pour les réseaux renseignés.</p>
      <div class="grid-2">
        ${F.text("Facebook", "marketing.social.facebook", { ph: "https://facebook.com/…" })}
        ${F.text("Instagram", "marketing.social.instagram", { ph: "https://instagram.com/…" })}
        ${F.text("TikTok", "marketing.social.tiktok", { ph: "https://tiktok.com/@…" })}
        ${F.text("YouTube", "marketing.social.youtube", { ph: "https://youtube.com/@…" })}
      </div>`)}
    ${card("Mesure d'audience", `
      <p class="intro">Renseignez vos identifiants pour suivre les visites et les demandes de devis (événements : <em>whatsapp_click</em>, <em>generate_lead</em> / <em>Lead</em>, <em>feed_request</em>).</p>
      <div class="grid-2">
        ${F.text("Google Analytics 4 (ID de mesure)", "marketing.analytics.ga4", { ph: "G-XXXXXXXXXX" })}
        ${F.text("Pixel Meta (Facebook / Instagram)", "marketing.analytics.metaPixel", { ph: "123456789012345" })}
      </div>`)}
    ${card("Référencement Google", `
      ${F.text("Titre de la page", "marketing.seo.title", { help: "Environ 60 caractères. C'est le titre affiché dans Google." })}
      ${F.area("Description", "marketing.seo.description", { rows: 3, help: "Environ 155 caractères, affichée sous le titre dans Google." })}
      ${F.text("Adresse du site", "marketing.seo.siteUrl", { ph: "https://www.sana.ci/" })}`)}
    ${card("Créer un lien de campagne", `
      <p class="intro">Utilisez ce lien dans vos publicités : chaque demande WhatsApp reçue indiquera la campagne d'origine.</p>
      <div class="grid-2">
        <label class="field"><span>Source</span><select id="utm-source"><option>facebook</option><option>instagram</option><option>tiktok</option><option>google</option><option>whatsapp</option><option>affiche</option></select></label>
        <label class="field"><span>Nom de la campagne</span><input id="utm-campaign" placeholder="Ex. : aliment-bovins-octobre"></label>
      </div>
      <label class="field"><span>Lien à utiliser</span><input id="utm-out" readonly data-base="${esc(base)}"></label>
      <div class="row">${btn("Copier le lien", "copy-utm", "", "btn-primary")}</div>`)}`;
  },

  avis: () => `
    <h2>Avis &amp; questions fréquentes</h2>
    <p class="intro">Ajoutez de vrais avis de vos clients (avec leur accord). La section Avis n'apparaît sur le site que s'il y a au moins un avis.</p>
    <h3 class="group">Avis clients</h3>
    ${list("testimonials", t => t.name || "Nouvel avis", b => `
      <div class="grid-2">${F.text("Nom du client", b + ".name")}${F.text("Activité / ville", b + ".role", { ph: "Éleveur de volailles, Yamoussoukro" })}</div>
      ${F.area("Avis", b + ".text", { rows: 3 })}`, { name: "", role: "", text: "" }, "+ Ajouter un avis")}
    <h3 class="group">Questions fréquentes</h3>
    ${list("faq", f => f.q || "Nouvelle question", b => `
      ${F.text("Question", b + ".q")}${F.area("Réponse", b + ".a", { rows: 3 })}`, { q: "", a: "" }, "+ Ajouter une question")}`,

  poulets: () => `
    <h2>Poulets</h2>
    <p class="intro">Les offres de poulets : poussins, élevage, abattage… Ajoutez, masquez ou réordonnez-les librement.</p>
    ${card("Section", `${F.text("Titre", "chickens.title")}${F.area("Introduction", "chickens.intro", { rows: 2 })}`)}
    ${data.chickens.offers.map((o, i) => card(esc(o.title || "Nouvelle offre"), `
      ${F.bool("Afficher sur le site", `chickens.offers.${i}.visible`)}
      <div class="grid-2">
        ${F.text("Nom de l'offre", `chickens.offers.${i}.title`)}
        ${F.text("Usage (étiquette)", `chickens.offers.${i}.usage`, { ph: "Pour l'abattage" })}
        ${F.text("Prix (optionnel)", `chickens.offers.${i}.price`, { ph: "Ex. : à partir de 3 000 FCFA / pièce" })}
        ${F.select("Icône", `chickens.offers.${i}.icon`, { chick: "Poussin", chicken: "Poule", drumstick: "Cuisse" })}
      </div>
      ${F.area("Description", `chickens.offers.${i}.desc`, { rows: 2 })}
      ${F.lines("Points forts", `chickens.offers.${i}.items`)}`,
      `${i > 0 ? btn("↑", "move-offer", `data-i="${i}" data-d="-1" aria-label="Monter"`) : ""}
       ${i < data.chickens.offers.length - 1 ? btn("↓", "move-offer", `data-i="${i}" data-d="1" aria-label="Descendre"`) : ""}
       ${del("del-offer", `data-i="${i}"`)}`)).join("")}
    ${btn("+ Ajouter une offre de poulets", "add-offer", "", "btn-primary")}`,

  oeufs: () => `
    <h2>Œufs</h2>
    ${card("Carte Œufs", `
      ${F.bool("Afficher sur le site", "eggs.visible")}
      <div class="grid-2">${F.text("Titre", "eggs.title")}${F.text("Prix (optionnel)", "eggs.price", { ph: "Ex. : 2 500 FCFA le plateau" })}</div>
      ${F.area("Description", "eggs.desc", { rows: 2 })}
      ${F.lines("Points forts", "eggs.items")}`)}`,

  aliments: () => `
    <h2>Aliments</h2>
    ${card("Carte Aliments", `
      <div class="grid-2">${F.text("Titre", "feed.title")}${F.num("Commande minimum (kg)", "feed.minKg")}</div>
      ${F.area("Description", "feed.desc", { rows: 2 })}
      ${F.lines("Points forts", "feed.items", { help: "Un élément par ligne. La liste des espèces est ajoutée automatiquement." })}
      ${F.lines("Présentations proposées", "feed.forms", { help: "Une par ligne : Farine, Granulés…" })}`)}`,

  especes: () => `
    <h2>Espèces &amp; stades</h2>
    <p class="intro">Les espèces et les types d'aliment que le client peut choisir dans « Aliment sur mesure ». Aucune formule n'est enregistrée ni affichée sur le site : vous envoyez la formule au client avec votre devis.</p>
    ${data.species.map((sp, si) => card(esc(sp.name || "Nouvelle espèce"), `
      <div class="grid-2">${F.text("Nom", `species.${si}.name`)}${F.select("Icône", `species.${si}.icon`, ICONS)}</div>
      <p class="sub">Types d'aliment / stades proposés</p>
      <div class="stages">${(sp.stages || []).map((st, i, arr) => `
        <div class="stage-row">
          <input data-path="species.${si}.stages.${i}.label" value="${esc(st.label)}" aria-label="Stade ${i + 1}" placeholder="Ex. : Poules pondeuses — Ponte">
          ${i > 0 ? btn("↑", "move-item", `data-list="species.${si}.stages" data-i="${i}" data-d="-1" aria-label="Monter"`) : ""}
          ${i < arr.length - 1 ? btn("↓", "move-item", `data-list="species.${si}.stages" data-i="${i}" data-d="1" aria-label="Descendre"`) : ""}
          ${del("del-item", `data-list="species.${si}.stages" data-i="${i}"`)}
        </div>`).join("")}
      </div>
      ${btn("+ Ajouter un stade", "add-item", `data-list="species.${si}.stages" data-blank="${esc(JSON.stringify({ id: "", label: "" }))}"`)}`,
      `${si > 0 ? btn("↑", "move-item", `data-list="species" data-i="${si}" data-d="-1" aria-label="Monter"`) : ""}
       ${si < data.species.length - 1 ? btn("↓", "move-item", `data-list="species" data-i="${si}" data-d="1" aria-label="Descendre"`) : ""}
       ${del("del-species", `data-sp="${si}"`)}`)).join("")}
    ${btn("+ Ajouter une espèce", "add-species", "", "btn-primary")}`,

  publication: () => {
    const gh = ghSettings();
    const issues = validate();
    return `
    <h2>Publication</h2>
    ${card("État", `
      <p>${isDirty() ? "Vous avez des modifications <strong>non publiées</strong>. Elles sont enregistrées sur cet appareil." : "Le contenu est identique à la version publiée."}</p>
      ${issues.length ? `<ul class="issues">${issues.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <div class="row">${btn("Publier maintenant", "publish", "", "btn-accent")}
        ${isDirty() ? del("discard", "").replace("Supprimer", "Annuler mes modifications") : ""}</div>`)}
    ${card("Connexion GitHub", `
      <p class="intro">Le site est hébergé sur GitHub. La publication utilise un jeton d'accès GitHub (« fine-grained token ») limité à ce dépôt, avec la permission <em>Contents : Read and write</em>. Il est enregistré chiffré par votre mot de passe.</p>
      <p class="token-state ${gh.token ? "ok" : "missing"}">${gh.token ? "Jeton enregistré sur cet appareil (chiffré)." : "Aucun jeton : la publication est impossible tant qu'il n'est pas ajouté."}</p>
      <label class="field"><span>${gh.token ? "Remplacer le jeton" : "Jeton d'accès"}</span><input id="gh-token" type="password" autocomplete="off" placeholder="github_pat_…"></label>
      <details class="adv"><summary>Réglages avancés</summary>
      <div class="grid-2">
        <label class="field"><span>Propriétaire</span><input id="gh-owner" value="${esc(gh.owner)}"></label>
        <label class="field"><span>Dépôt</span><input id="gh-repo" value="${esc(gh.repo)}"></label>
        <label class="field"><span>Branche publiée</span><input id="gh-branch" value="${esc(gh.branch)}"></label>
        <label class="field"><span>Fichier de contenu</span><input id="gh-path" value="${esc(gh.path)}"></label>
      </div></details>
      <div class="row">${btn("Enregistrer", "save-gh", "", "btn-primary")}</div>`)}
    ${card("Mot de passe de l'administration", `
      <div class="grid-2">
        <label class="field"><span>Nouveau mot de passe</span><input id="pw-new" type="password" autocomplete="new-password" minlength="8"></label>
        <label class="field"><span>Confirmer</span><input id="pw-confirm" type="password" autocomplete="new-password" minlength="8"></label>
      </div>
      <div class="row">${btn("Changer le mot de passe", "change-pw", "", "btn-primary")}</div>`)}
    ${card("Sauvegarde", `
      <p class="intro">Téléchargez une copie du contenu, ou rechargez une copie précédente.</p>
      <div class="row">${btn("Télécharger une copie", "export")}${btn("Importer une copie", "import")}</div>`)}`;
  },
};

// ---------------------------------------------------------
// Rendu
// ---------------------------------------------------------
function render() {
  if (!TABS[tab]) tab = "societe";
  document.querySelectorAll("#adminNav button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  $("#panel").innerHTML = TABS[tab]();
  updateTotals();
  updateUtm();
  updateStatus();
}

function updateUtm() {
  const out = $("#utm-out");
  if (!out) return;
  const camp = slugPlain($("#utm-campaign").value) || "campagne";
  const u = new URL(data.marketing.seo.siteUrl || out.dataset.base, location.href);
  u.searchParams.set("utm_source", $("#utm-source").value);
  u.searchParams.set("utm_campaign", camp);
  out.value = u.href;
}
const slugPlain = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function updateTotals() {}

const isDirty = () => JSON.stringify(data) !== JSON.stringify(published);
function updateStatus() {
  const s = $("#status");
  const dirty = isDirty();
  s.textContent = dirty ? "Modifications non publiées" : "À jour";
  s.className = "status " + (dirty ? "dirty" : "ok");
}

// Version en ligne au moment où le brouillon a commencé : sert à prévenir si elle a changé depuis
const BASE_KEY = "sana-draft-base";
function save() {
  if (isDirty()) {
    store.set(DRAFT_KEY, JSON.stringify(data));
    if (!store.get(BASE_KEY)) store.set(BASE_KEY, JSON.stringify(published));
  } else {
    store.del(DRAFT_KEY);
    store.del(BASE_KEY);
  }
  updateStatus();
}

function warnStaleDraft() {
  if (!store.get(DRAFT_KEY) || !isDirty()) return;
  const now = JSON.stringify(published);
  if (store.get(BASE_KEY) === now) return;
  store.set(BASE_KEY, now);
  toast("Attention : la version en ligne a changé depuis votre brouillon. Si vous publiez, votre brouillon la remplacera. Vérifiez vos modifications, ou annulez-les dans « Publication » pour repartir de la version en ligne.", "error");
}

let toastTimer;
function toast(text, type = "info") {
  const t = $("#toast");
  t.textContent = text;
  t.className = `toast ${type}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, type === "error" ? 9000 : 5000);
}

function validate() {
  const out = [];
  if (!data.species.length) out.push("Ajoutez au moins une espèce.");
  data.species.forEach(sp => {
    if (!sp.name.trim()) out.push("Une espèce n'a pas de nom.");
    if (!(sp.stages || []).some(st => st.label.trim())) out.push(`${sp.name || "Une espèce"} : ajoutez au moins un type d'aliment.`);
  });
  return out;
}

// ---------------------------------------------------------
// Saisie
// ---------------------------------------------------------
function onEdit(e) {
  const el = e.target;
  if (el.id === "utm-campaign" || el.id === "utm-source") return updateUtm();
  const path = el.dataset.path;
  if (!path) return;
  let v;
  switch (el.dataset.type) {
    case "number": v = el.value === "" ? null : parseFloat(el.value.replace(",", ".")); break;
    case "lines": v = el.value.split("\n").map(x => x.trim()).filter(Boolean); break;
    case "bool": v = el.checked; break;
    default: v = el.value;
  }
  if (v === null || Number.isNaN(v)) { if (el.dataset.optional) delP(path); else setP(path, 0); }
  else setP(path, v);
  save();
  updateTotals();
  if (el.dataset.rerender && e.type === "change") render();
}

// ---------------------------------------------------------
// Actions
// ---------------------------------------------------------
const ACTIONS = {
  "add-offer": () => data.chickens.offers.push({ id: slug("offre"), icon: "chicken", title: "Nouvelle offre", usage: "", desc: "", items: [], price: "", visible: true }),
  "del-offer": b => data.chickens.offers.splice(+b.dataset.i, 1),
  "move-offer": b => {
    const i = +b.dataset.i, j = i + +b.dataset.d, a = data.chickens.offers;
    [a[i], a[j]] = [a[j], a[i]];
  },
  "add-species": () => data.species.push({ id: slug("espece"), name: "Nouvelle espèce", icon: "cow", stages: [{ id: "", label: "" }] }),
  "del-species": b => data.species.splice(+b.dataset.sp, 1),
  "add-item": b => (getP(b.dataset.list) || (setP(b.dataset.list, []), getP(b.dataset.list))).push(JSON.parse(b.dataset.blank)),
  "del-item": b => getP(b.dataset.list).splice(+b.dataset.i, 1),
  "move-item": b => {
    const a = getP(b.dataset.list), i = +b.dataset.i, j = i + +b.dataset.d;
    [a[i], a[j]] = [a[j], a[i]];
  },
  "copy-utm": () => {
    const out = $("#utm-out");
    navigator.clipboard?.writeText(out.value).then(() => toast("Lien copié.", "success"), () => { out.select(); toast("Sélectionné : copiez avec Ctrl+C."); });
    return false;
  },
  discard: () => { data = clone(published); store.del(PREVIEW_KEY); store.del(BASE_KEY); toast("Modifications annulées."); },
  "save-gh": () => { readGhForm().then(() => { render(); toast("Connexion enregistrée.", "success"); }); return false; },
  "change-pw": () => {
    const a = $("#pw-new").value, b = $("#pw-confirm").value;
    if (a.length < 8) { toast("Le mot de passe doit contenir au moins 8 caractères.", "error"); return false; }
    if (a !== b) { toast("Les deux mots de passe ne sont pas identiques.", "error"); return false; }
    sealVault(a, { token: ghMemory || "" }).then(() => { vaultPass = a; render(); toast("Mot de passe changé.", "success"); });
    return false;
  },
  export: () => {
    const blob = new Blob([serialize()], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content.js";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return false;
  },
  import: () => { $("#importFile").click(); return false; },
  publish: () => { publish(); return false; },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.tagName === "INPUT") return;
  // suppression en deux clics
  if (b.dataset.confirm && !b.dataset.armed) {
    b.dataset.armed = "1";
    b.dataset.label = b.textContent;
    b.textContent = "Confirmer ?";
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = b.dataset.label; } }, 3000);
    return;
  }
  const res = ACTIONS[b.dataset.act]?.(b);
  if (res !== false) { save(); render(); }
});

$("#panel").addEventListener("input", onEdit);
$("#panel").addEventListener("change", onEdit);

$("#adminNav").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  tab = b.dataset.tab;
  store.set(TAB_KEY, tab);
  render();
  window.scrollTo({ top: 0 });
});

// Aperçu : le site lit le brouillon sur cet appareil
$("#previewBtn").addEventListener("click", () => {
  store.set(DRAFT_KEY, JSON.stringify(data));
  store.set(PREVIEW_KEY, "1");
});

$("#importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const txt = (await file.text()).trim().replace(/^window\.SANA_CONTENT\s*=\s*/, "").replace(/;\s*$/, "");
    const obj = JSON.parse(txt);
    if (!obj.company || !Array.isArray(obj.species)) throw new Error("format");
    data = sanitize(withDefaults(obj, published));
    save(); render();
    toast("Copie importée. Vérifiez puis publiez.", "success");
  } catch (err) {
    toast("Ce fichier n'est pas une copie valide du contenu SANA.", "error");
  }
});

// ---------------------------------------------------------
// Publication GitHub
// ---------------------------------------------------------
function ghSettings() {
  let s = {};
  try { s = JSON.parse(store.get(GH_KEY)) || {}; } catch (e) {}
  return {
    owner: s.owner || "yassine1158", repo: s.repo || "WEBSITE-SANA-", branch: s.branch || "main",
    path: s.path || "data/content.js", token: ghMemory || "",
  };
}
async function readGhForm() {
  if (!$("#gh-owner")) return ghSettings();
  const s = {
    owner: $("#gh-owner").value.trim(), repo: $("#gh-repo").value.trim(), branch: $("#gh-branch").value.trim(),
    path: $("#gh-path").value.trim(),
  };
  store.set(GH_KEY, JSON.stringify(s));
  const token = $("#gh-token").value.trim();
  if (token && token !== ghMemory) {
    ghMemory = token;
    await sealVault(vaultPass, { token });
  }
  return ghSettings();
}

const serialize = () => `window.SANA_CONTENT = ${JSON.stringify(sanitize(data), null, 2)};\n`;
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

let publishing = false;
async function publish() {
  if (publishing) return;
  const issues = validate();
  if (issues.length) {
    tab = "publication"; render();
    toast("Corrigez les points signalés avant de publier.", "error");
    return;
  }
  const gh = await readGhForm();
  if (!gh.token) {
    tab = "publication"; render();
    toast("Ajoutez votre jeton GitHub dans « Connexion GitHub » pour publier.", "error");
    $("#gh-token")?.focus();
    return;
  }
  publishing = true;
  toast("Publication en cours…");
  const url = `https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/contents/${gh.path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = { Authorization: `Bearer ${gh.token}`, Accept: "application/vnd.github+json" };
  try {
    let sha;
    const cur = await fetch(`${url}?ref=${encodeURIComponent(gh.branch)}`, { headers, cache: "no-store" });
    if (cur.ok) sha = (await cur.json()).sha;
    else if (cur.status !== 404) throw cur;
    const put = await fetch(url, {
      method: "PUT", headers,
      body: JSON.stringify({ message: "Mise à jour du contenu depuis l'administration", content: b64(serialize()), branch: gh.branch, sha }),
    });
    if (!put.ok) throw put;
    published = clone(data);
    store.del(DRAFT_KEY);
    store.del(BASE_KEY);
    store.del(PREVIEW_KEY);
    render();
    toast("Publié. Le site sera à jour d'ici une à deux minutes : actualisez ensuite la page du site.", "success");
  } catch (err) {
    const code = err && err.status;
    const why = code === 401 ? "le jeton est invalide ou expiré."
      : code === 403 || code === 404 ? "le jeton n'a pas accès à ce dépôt ou à cette branche (permission Contents : Read and write)."
      : code === 409 || code === 422 ? "le fichier a changé entre-temps. Réessayez."
      : "connexion à GitHub impossible. Vérifiez votre connexion internet.";
    toast(`Échec de la publication : ${why} Vos modifications restent enregistrées sur cet appareil.`, "error");
  } finally {
    publishing = false;
  }
}

window.addEventListener("beforeunload", e => {
  if (isDirty()) store.set(DRAFT_KEY, JSON.stringify(data));
});

// ---------------------------------------------------------
// Mot de passe : le jeton GitHub est chiffré (AES-GCM, clé PBKDF2) sur l'appareil
// ---------------------------------------------------------
const VAULT_KEY = "sana-vault";
const LOCK_AFTER_MS = 30 * 60 * 1000;
const toB64 = u8 => { let b = ""; u8.forEach(c => { b += String.fromCharCode(c); }); return btoa(b); };
const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function sealVault(pass, secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(secret))));
  store.set(VAULT_KEY, JSON.stringify({ v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) }));
}
async function openVault(pass) {
  const v = JSON.parse(store.get(VAULT_KEY));
  const key = await deriveKey(pass, fromB64(v.salt));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(v.iv) }, key, fromB64(v.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
const hasVault = () => !!store.get(VAULT_KEY);

// jeton laissé en clair par une ancienne version : repris puis effacé
function legacyToken() {
  try { return (JSON.parse(store.get(GH_KEY)) || {}).token || ""; } catch (e) { return ""; }
}
function dropLegacyToken() {
  try { const s = JSON.parse(store.get(GH_KEY)) || {}; delete s.token; delete s.remember; store.set(GH_KEY, JSON.stringify(s)); } catch (e) {}
}

function showLock() {
  ghMemory = null;
  vaultPass = null;
  document.body.classList.add("locked");
  const setup = !hasVault();
  $("#lockTitle").textContent = setup ? "Créer votre accès" : "Administration";
  $("#lockIntro").textContent = setup
    ? "Première connexion sur cet appareil : choisissez un mot de passe (8 caractères minimum) et collez votre jeton GitHub."
    : "Entrez votre mot de passe pour accéder à l'administration.";
  $("#lockFields").innerHTML = setup ? `
    <label class="field"><span>Mot de passe</span><input type="password" id="lk-pass" autocomplete="new-password" minlength="8" required></label>
    <label class="field"><span>Confirmer le mot de passe</span><input type="password" id="lk-pass2" autocomplete="new-password" minlength="8" required></label>
    <label class="field"><span>Jeton GitHub</span><em class="help">Commence par github_pat_. Vous pourrez aussi l'ajouter plus tard dans « Publication ».</em><input type="password" id="lk-token" autocomplete="off" placeholder="github_pat_…" value="${esc(legacyToken())}"></label>`
    : `<label class="field"><span>Mot de passe</span><input type="password" id="lk-pass" autocomplete="current-password" required></label>`;
  $("#lockSubmit").textContent = setup ? "Créer l'accès" : "Se connecter";
  $("#lockReset").hidden = setup;
  $("#lockMsg").textContent = "";
  setTimeout(() => $("#lk-pass")?.focus(), 50);
}

function unlock(pass, token) {
  vaultPass = pass;
  ghMemory = token || "";
  document.body.classList.remove("locked");
  render();
  warnStaleDraft();
  bumpIdle();
}

$("#lockForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#lockMsg");
  const pass = $("#lk-pass").value;
  const submit = $("#lockSubmit");
  if (!window.crypto?.subtle) { msg.textContent = "Ce navigateur ne permet pas le chiffrement. Ouvrez l'administration en https."; return; }
  submit.disabled = true;
  try {
    if (!hasVault()) {
      if (pass.length < 8) { msg.textContent = "Le mot de passe doit contenir au moins 8 caractères."; return; }
      if (pass !== $("#lk-pass2").value) { msg.textContent = "Les deux mots de passe ne sont pas identiques."; return; }
      const token = $("#lk-token").value.trim();
      await sealVault(pass, { token });
      dropLegacyToken();
      unlock(pass, token);
    } else {
      msg.textContent = "Vérification…";
      const secret = await openVault(pass);
      unlock(pass, secret.token);
    }
  } catch (err) {
    msg.textContent = "Mot de passe incorrect.";
    $("#lk-pass").select();
  } finally {
    submit.disabled = false;
  }
});

// mot de passe oublié : on efface l'accès (le brouillon est conservé) et on recommence
$("#lockReset").addEventListener("click", e => {
  const b = e.currentTarget;
  if (!b.dataset.armed) {
    b.dataset.armed = "1";
    b.textContent = "Confirmer : effacer l'accès de cet appareil (il faudra recoller le jeton GitHub)";
    setTimeout(() => { delete b.dataset.armed; b.textContent = "Mot de passe oublié ?"; }, 5000);
    return;
  }
  delete b.dataset.armed;
  b.textContent = "Mot de passe oublié ?";
  store.del(VAULT_KEY);
  showLock();
});

$("#lockBtn").addEventListener("click", showLock);

// verrouillage automatique après 30 minutes sans activité
let idleTimer;
function bumpIdle() {
  clearTimeout(idleTimer);
  if (!document.body.classList.contains("locked")) idleTimer = setTimeout(showLock, LOCK_AFTER_MS);
}
["click", "keydown", "input"].forEach(ev => document.addEventListener(ev, bumpIdle, { passive: true }));

showLock();
