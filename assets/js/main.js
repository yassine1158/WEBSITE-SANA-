/* =========================================================
   SANA — Site vitrine
   ========================================================= */

// ---- Coordonnées de la société (à personnaliser) ----
const CONTACT = {
  whatsapp: "21600000000",      // numéro au format international, sans "+"
  email: "contact@sana.tn",
};

// ---- Matières premières (valeurs nutritionnelles indicatives / kg) ----
// cp = protéines brutes %, em = énergie métabolisable kcal/kg,
// ca = calcium %, p = phosphore %, cb = cellulose brute %
const INGREDIENTS = [
  { id: "mais",     name: "Maïs",                   info: "Source d'énergie",      cat: "energy", cp: 8.5, em: 3350, ca: 0.02, p: 0.08, cb: 2.2, max: 75 },
  { id: "soja",     name: "Tourteau de soja 44",    info: "Source de protéines",   cat: "protein", cp: 44,  em: 2250, ca: 0.30, p: 0.20, cb: 6.0, max: 45 },
  { id: "son",      name: "Son de blé",             info: "Fibres",                cat: "fiber", cp: 15.5,em: 1300, ca: 0.12, p: 0.30, cb: 10,  max: 20 },
  { id: "orge",     name: "Orge",                   info: "Céréale complémentaire",cat: "energy", cp: 11,  em: 2650, ca: 0.05, p: 0.12, cb: 5.0, max: 30 },
  { id: "huile",    name: "Huile végétale",         info: "Énergie concentrée",    cat: "energy", cp: 0,   em: 8800, ca: 0,    p: 0,    cb: 0,   max: 6 },
  { id: "calcaire", name: "Carbonate de calcium",   info: "Calcium (coquille, os)",cat: "mineral", cp: 0,   em: 0,    ca: 38,   p: 0,    cb: 0,   max: 12 },
  { id: "phos",     name: "Phosphate bicalcique",   info: "Phosphore & calcium",   cat: "mineral", cp: 0,   em: 0,    ca: 23,   p: 18,   cb: 0,   max: 3 },
  { id: "cmv",      name: "CMV (prémix)",           info: "Vitamines & minéraux",  cat: "mineral", cp: 0,   em: 0,    ca: 0,    p: 0,    cb: 0,   max: 3 },
  { id: "sel",      name: "Sel",                    info: "Sodium",                cat: "mineral", cp: 0,   em: 0,    ca: 0,    p: 0,    cb: 0,   max: 1 },
];

// ---- Formules de base (en %) + objectifs nutritionnels ----
const PRESETS = {
  demarrage:  { label: "Poulet de chair — Démarrage",
    mix: { mais: 55, soja: 38, son: 0, orge: 0, huile: 2.5, calcaire: 1.2, phos: 1.8, cmv: 1, sel: 0.5 },
    target: { cp: 22, em: 2950, ca: 1.0, p: 0.45 } },
  croissance: { label: "Poulet de chair — Croissance",
    mix: { mais: 60, soja: 33, son: 0, orge: 0, huile: 3, calcaire: 1.2, phos: 1.3, cmv: 1, sel: 0.5 },
    target: { cp: 20, em: 3050, ca: 0.9, p: 0.40 } },
  finition:   { label: "Poulet de chair — Finition",
    mix: { mais: 64.7, soja: 28, son: 0, orge: 0, huile: 3.5, calcaire: 1.2, phos: 1.1, cmv: 1, sel: 0.5 },
    target: { cp: 18, em: 3150, ca: 0.85, p: 0.35 } },
  pondeuse:   { label: "Poules pondeuses — Ponte",
    mix: { mais: 58, soja: 24, son: 5, orge: 0, huile: 1, calcaire: 9, phos: 1.5, cmv: 1, sel: 0.5 },
    target: { cp: 16.5, em: 2700, ca: 3.8, p: 0.38 } },
  fermier:    { label: "Poulet fermier",
    mix: { mais: 55, soja: 22, son: 10, orge: 8, huile: 1.5, calcaire: 1.3, phos: 1, cmv: 0.7, sel: 0.5 },
    target: { cp: 17, em: 2850, ca: 0.9, p: 0.35 } },
};

const NUTRIENTS = [
  { key: "cp", label: "Protéines brutes", unit: " %",        dec: 1, tol: 1 },
  { key: "em", label: "Énergie (EM)",     unit: " kcal/kg", dec: 0, tol: 100 },
  { key: "ca", label: "Calcium",          unit: " %",        dec: 2, tol: 0.2 },
  { key: "p",  label: "Phosphore",        unit: " %",        dec: 2, tol: 0.1 },
  { key: "cb", label: "Cellulose brute",  unit: " %",        dec: 1 },
];

const $ = (s, el = document) => el.querySelector(s);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n, d = 1) => round(n, d).toLocaleString("fr-FR", { maximumFractionDigits: d });

// ---------------------------------------------------------
// Menu mobile
// ---------------------------------------------------------
const toggle = $(".nav-toggle");
const links = $(".nav-links");
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
const presetSel = $("#preset");
const ingBox = $("#ingredients");

function renderIngredients() {
  ingBox.innerHTML = INGREDIENTS.map(i => `
    <div class="ing" data-id="${i.id}" data-cat="${i.cat}">
      <div class="ing-name"><i class="dot dot-${i.cat}"></i><span>${i.name}<small>${i.info}</small></span></div>
      <input type="range" min="0" max="${i.max}" step="0.1" aria-label="${i.name}">
      <div class="ing-num"><input type="number" min="0" max="100" step="0.1" aria-label="${i.name} en %"><span>%</span></div>
    </div>`).join("");

  ingBox.querySelectorAll(".ing").forEach(row => {
    const id = row.dataset.id;
    const range = $("input[type=range]", row);
    const num = $("input[type=number]", row);
    range.addEventListener("input", () => { state[id] = +range.value; num.value = range.value; paint(range); update(); });
    num.addEventListener("input", () => {
      let v = Math.max(0, Math.min(100, parseFloat(num.value) || 0));
      state[id] = v; range.value = v; paint(range); update();
    });
  });
}

// remplissage coloré de la piste du curseur
function paint(range) {
  range.style.setProperty("--p", `${(range.value / range.max) * 100}%`);
}

function loadPreset(key) {
  Object.assign(state, PRESETS[key].mix);
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

function total() {
  return INGREDIENTS.reduce((s, i) => s + (state[i.id] || 0), 0);
}

function computeNutrients() {
  const t = total() || 1;
  const res = { cp: 0, em: 0, ca: 0, p: 0, cb: 0 };
  INGREDIENTS.forEach(i => {
    const share = (state[i.id] || 0) / t;
    NUTRIENTS.forEach(n => { res[n.key] += share * i[n.key]; });
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
    : t < 100 ? `Il manque ${round(100 - t, 1)} %` : `Dépassement de ${round(t - 100, 1)} %`;

  const res = computeNutrients();
  const target = PRESETS[presetSel.value].target;
  $("#nutri").innerHTML = NUTRIENTS.map(n => {
    const v = res[n.key];
    const tg = target[n.key];
    let cls = "", tgTxt = "";
    if (tg !== undefined) {
      cls = Math.abs(v - tg) <= n.tol ? "ok" : "warn";
      tgTxt = `<span class="target">Recommandé : ${fmt(tg, n.dec)}${n.unit} ${cls === "ok" ? "· conforme" : "· à ajuster"}</span>`;
    }
    return `<div class="nutri-item"><span>${n.label}</span><span class="val ${cls}">${fmt(v, n.dec)}${n.unit}</span>${tgTxt}</div>`;
  }).join("");
}

$("#resetBtn").addEventListener("click", () => loadPreset(presetSel.value));
$("#normalizeBtn").addEventListener("click", () => {
  const t = total();
  if (!t) return;
  INGREDIENTS.forEach(i => { state[i.id] = round((state[i.id] || 0) * 100 / t, 1); });
  // corrige l'arrondi sur l'ingrédient principal
  const diff = round(100 - total(), 1);
  const main = INGREDIENTS.reduce((a, b) => (state[a.id] >= state[b.id] ? a : b));
  state[main.id] = round(state[main.id] + diff, 1);
  syncInputs(); update();
});
presetSel.addEventListener("change", () => loadPreset(presetSel.value));

$("#useFormula").addEventListener("click", () => {
  const t = round(total(), 1);
  if (Math.abs(t - 100) >= 0.05) {
    alert(`Le total de la formule doit être égal à 100 % (actuellement ${t} %).`);
    return;
  }
  const res = computeNutrients();
  const qty = parseInt($("#qty").value, 10) || 0;
  const lines = INGREDIENTS.filter(i => state[i.id] > 0)
    .map(i => `- ${i.name} : ${round(state[i.id], 1)} %`);
  const text =
`Formule : ${PRESETS[presetSel.value].label} (${$("#form").value})
Quantité : ${qty} kg

Composition :
${lines.join("\n")}

Valeurs estimées : protéines ${round(res.cp, 1)} %, énergie ${round(res.em, 0)} kcal/kg, calcium ${round(res.ca, 2)} %, phosphore ${round(res.p, 2)} %.`;
  $("#produitSelect").value = "Aliment sur mesure";
  $("#details").value = text;
  $("#contact").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => $("#orderForm [name=nom]").focus({ preventScroll: true }), 600);
});

renderIngredients();
loadPreset(presetSel.value);

// ---------------------------------------------------------
// Boutons "Demander un devis" -> pré-sélection du produit
// ---------------------------------------------------------
document.querySelectorAll("[data-product]").forEach(btn => {
  btn.addEventListener("click", () => { $("#produitSelect").value = btn.dataset.product; });
});

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
`Bonjour SANA,

Nom : ${d.nom}
Téléphone : ${d.tel}
Ville : ${d.ville || "-"}
Produit : ${d.produit}

${d.details}`;

  if (channel === "whatsapp") {
    window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(body)}`, "_blank", "noopener");
  } else {
    location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Commande — " + d.produit)}&body=${encodeURIComponent(body)}`;
  }
  msg.className = "form-msg success";
  msg.textContent = "Merci ! Votre demande est prête à être envoyée. Nous vous répondons sous 24h.";
});

// ---------------------------------------------------------
// Divers
// ---------------------------------------------------------
$("#year").textContent = new Date().getFullYear();
$("#waFloat").href = `https://wa.me/${CONTACT.whatsapp}`;
$("#waFloat").target = "_blank";
$("#waFloat").rel = "noopener";
