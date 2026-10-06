/* =========================================================
   SANA — Studio IA (administration)
   Claude écrit les publications, l'admin dessine l'affiche aux couleurs SANA,
   puis la publie ou la programme sur la page Facebook.
   Les clés (Claude, Facebook) sont chiffrées avec le mot de passe de l'admin.
   ========================================================= */

const AI_POSTS_KEY = "sana-ai-posts";
const AI_PREFS_KEY = "sana-ai-prefs";
const FB_VERSION = "v23.0";
const USD_FCFA = 600; // ordre de grandeur, pour l'estimation du coût

const AI_MODELS = {
  "claude-opus-5-5": { label: "Claude Opus 5.5 (meilleure qualité)", in: 4, out: 20 },
  "claude-sonnet-5-5": { label: "Claude Sonnet 5.5 (deux fois moins cher)", in: 2, out: 10 },
};
const AI_SUBJECTS = {
  mix: "Un peu de tout (vente, conseils, confiance, bientôt)",
  oeufs: "Vendre nos œufs à couver",
  conseils: "Conseils d'incubation et d'élevage",
  confiance: "Confiance : coulisses et sérieux de SANA",
  bientot: "Annoncer les produits qui arrivent bientôt",
};
const AI_TONES = {
  chaleureux: "Chaleureux et proche des éleveurs",
  pro: "Professionnel et rassurant",
  energique: "Énergique, envie d'agir",
};
const THEMES = { dark: "Vert forêt", light: "Clair", orange: "Orange" };
const STYLES = { checks: "Coches ✓", num: "Étapes 1, 2, 3" };

const aiStore = {
  get(k, d) { try { return JSON.parse(store.get(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { store.set(k, JSON.stringify(v)); },
};
let aiPosts = aiStore.get(AI_POSTS_KEY, []);
const savePosts = () => aiStore.set(AI_POSTS_KEY, aiPosts);
const prefs = () => {
  const tomorrow = new Date(Date.now() + 864e5);
  return {
    model: "claude-opus-5-5", subject: "mix", tone: "chaleureux", count: 5, hour: "19:00", notes: "",
    start: localDate(tomorrow), ...aiStore.get(AI_PREFS_KEY, {}),
  };
};
let aiBusy = "";

function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const fmtPhone = p => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("225") ? "+225 " + d.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ") : p; };
const fcfa = usd => Math.max(1, Math.round(usd * USD_FCFA)).toLocaleString("fr-FR") + " FCFA";
const fullCaption = p => [p.caption.trim(), (p.hashtags || []).map(h => "#" + h.replace(/^#/, "")).join(" ")].filter(Boolean).join("\n\n");

// ---------------------------------------------------------
// Onglet
// ---------------------------------------------------------
TABS.ia = () => {
  const pf = prefs();
  const hasKey = !!secrets.claudeKey, hasFb = !!(secrets.fbPage && secrets.fbToken);
  const m = AI_MODELS[pf.model] || AI_MODELS["claude-opus-5-5"];
  const perPost = (3000 * m.in + 1500 * m.out) / 1e6;
  const opt = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(typeof t === "string" ? t : t.label)}</option>`).join("");
  return `
    <h2>Studio IA</h2>
    <p class="intro">L'IA écrit vos publications Facebook et Instagram, l'affiche est dessinée automatiquement aux couleurs SANA, puis vous publiez ou programmez sur votre page Facebook. Rien n'est publié sans votre clic.</p>

    ${card("1. Connexions", `
      <p class="token-state ${hasKey ? "ok" : "missing"}">${hasKey ? "Clé Claude enregistrée (chiffrée)." : "Aucune clé Claude : la génération est impossible."}</p>
      <label class="field"><span>${hasKey ? "Remplacer la clé Claude" : "Clé API Claude"}</span><em class="help">Créez-la sur console.anthropic.com → API Keys. Ajoutez un petit crédit (5 $ suffisent pour des centaines de publications) et une limite de dépense.</em><input id="ai-key" type="password" autocomplete="off" placeholder="sk-ant-…"></label>
      <p class="token-state ${hasFb ? "ok" : "missing"}">${hasFb ? "Page Facebook connectée (jeton chiffré)." : "Page Facebook non connectée : vous pourrez quand même télécharger les affiches."}</p>
      <div class="grid-2">
        <label class="field"><span>ID de la page Facebook</span><input id="fb-page" value="${esc(secrets.fbPage || "")}" placeholder="Ex. : 1029384756"></label>
        <label class="field"><span>${secrets.fbToken ? "Remplacer le jeton de la page" : "Jeton d'accès de la page"}</span><input id="fb-token" type="password" autocomplete="off" placeholder="EAAG…"></label>
      </div>
      <details class="adv"><summary>Comment obtenir l'ID et le jeton de la page ?</summary>
        <ol class="ai-steps">
          <li>Allez sur <strong>developers.facebook.com</strong> → « Mes applications » → créez une application (type « Entreprise »).</li>
          <li>Ouvrez <strong>Outils → Explorateur de l'API Graph</strong>, choisissez votre application.</li>
          <li>Ajoutez les autorisations <em>pages_show_list</em>, <em>pages_read_engagement</em> et <em>pages_manage_posts</em>, puis « Generate Access Token » et acceptez pour la page SANA.</li>
          <li>Dans « Jeton utilisateur », choisissez la <strong>page SANA</strong> : le jeton affiché est le jeton de la page. Pour qu'il n'expire pas, passez-le dans l'<strong>outil de débogage des jetons</strong> → « Prolonger le jeton d'accès », puis refaites l'étape 4.</li>
          <li>L'ID de la page se trouve sur Facebook : page SANA → « À propos » → « Transparence de la page », ou dans l'explorateur avec la requête <em>me/accounts</em>.</li>
        </ol>
      </details>
      <div class="row">${btn("Enregistrer", "ai-save-keys", "", "btn-primary")}${btn("Tester les connexions", "ai-test")}</div>`)}

    ${card("2. Créer avec l'IA", `
      <div class="grid-2">
        <label class="field"><span>Sujet</span><select id="ai-subject">${opt(AI_SUBJECTS, pf.subject)}</select></label>
        <label class="field"><span>Ton</span><select id="ai-tone">${opt(AI_TONES, pf.tone)}</select></label>
        <label class="field"><span>Nombre de publications</span><input id="ai-count" type="number" min="1" max="10" value="${pf.count}"></label>
        <label class="field"><span>Modèle</span><select id="ai-model">${opt(AI_MODELS, pf.model)}</select></label>
        <label class="field"><span>Première publication le</span><input id="ai-start" type="date" value="${esc(pf.start)}"></label>
        <label class="field"><span>Heure (une publication par jour)</span><input id="ai-hour" type="time" value="${esc(pf.hour)}"></label>
      </div>
      <label class="field"><span>Idée ou consigne (optionnel)</span><em class="help">Ex. : « nouvelle fournée cette semaine », « insister sur la livraison à Yamoussoukro », « parler de la Tabaski ».</em><textarea id="ai-notes" rows="2">${esc(pf.notes)}</textarea></label>
      <p class="help">Coût estimé : environ ${fcfa(perPost)} par publication, payé sur votre compte Claude (console.anthropic.com). Les prix, quantités et formules ne sont jamais mentionnés : ils se donnent sur WhatsApp.</p>
      <div class="row">${btn(aiBusy === "gen" ? "Génération en cours…" : "✦ Générer les publications", "ai-generate", aiBusy ? "disabled" : "", "btn-accent")}</div>`)}

    <h3 class="group">3. Vos publications${aiPosts.length ? ` (${aiPosts.length})` : ""}</h3>
    ${aiPosts.length ? `<div class="row ai-bulk">${hasFb ? btn("Programmer toutes les publications", "ai-schedule-all", aiBusy ? "disabled" : "", "btn-primary") : ""}${del("ai-clear", "").replace("Supprimer", "Tout effacer")}</div>` : `<p class="intro">Aucune publication pour l'instant : cliquez sur « Générer les publications ».</p>`}
    ${aiPosts.map((p, i) => postCard(p, i, hasFb)).join("")}`;
};

const STATE = {
  draft: ["Brouillon", ""],
  scheduled: ["Programmée sur Facebook", "ok"],
  published: ["Publiée sur Facebook", "ok"],
};
function postCard(p, i, hasFb) {
  const f = (k, label, extra = "") => `<label class="field"><span>${label}</span><input data-ai="${p.id}.${k}" value="${esc(p[k])}" ${extra}></label>`;
  const sel = (k, label, o) => `<label class="field"><span>${label}</span><select data-ai="${p.id}.${k}">${Object.entries(o).map(([v, t]) => `<option value="${v}" ${p[k] === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  const [stTxt, stCls] = STATE[p.status] || STATE.draft;
  const done = p.status !== "draft";
  return card(`Publication ${i + 1} — ${esc(p.title)}`, `
    <div class="ai-post">
      <div class="ai-visual"><canvas width="1080" height="1350" data-poster="${p.id}" aria-label="Affiche : ${esc(p.title)}"></canvas></div>
      <div class="ai-fields">
        <div class="grid-2">${f("tag", "Étiquette")}${sel("theme", "Couleurs", THEMES)}</div>
        ${f("title", "Titre de l'affiche")}
        ${f("subtitle", "Sous-titre")}
        <div class="grid-2"><label class="field"><span>Points (un par ligne)</span><textarea data-ai="${p.id}.points" rows="4">${esc(p.points.join("\n"))}</textarea></label>${sel("style", "Présentation", STYLES)}</div>
        <label class="field"><span>Texte de la publication</span><textarea data-ai="${p.id}.caption" rows="6">${esc(p.caption)}</textarea></label>
        <label class="field"><span>Hashtags</span><input data-ai="${p.id}.hashtags" value="${esc(p.hashtags.map(h => "#" + h).join(" "))}"></label>
        <div class="grid-2"><label class="field"><span>Date et heure</span><input type="datetime-local" data-ai="${p.id}.when" value="${esc(p.when)}" ${done ? "disabled" : ""}></label>
          <p class="token-state ai-state ${stCls}">${stTxt}${p.error ? `<br><span class="ai-err">${esc(p.error)}</span>` : ""}</p></div>
        <div class="row">
          ${btn("Télécharger l'affiche", "ai-dl", `data-id="${p.id}"`)}
          ${btn("Copier le texte", "ai-copy", `data-id="${p.id}"`)}
          ${hasFb && !done ? btn("Programmer", "ai-schedule", `data-id="${p.id}" ${aiBusy ? "disabled" : ""}`, "btn-primary") : ""}
          ${hasFb && !done ? btn("Publier maintenant", "ai-post", `data-id="${p.id}" ${aiBusy ? "disabled" : ""}`, "btn-accent") : ""}
        </div>
      </div>
    </div>`, del("ai-del", `data-id="${p.id}"`));
}

// ---------------------------------------------------------
// Affiche : dessin sur canvas (1080 × 1350, format Facebook / Instagram)
// ---------------------------------------------------------
const PAL = {
  dark: { bg: "#0b3f2f", fg: "#ffffff", acc: "#ffa124", glow: ["rgba(64,130,39,.6)", "rgba(243,129,29,.28)"], tagBg: "rgba(255,255,255,.12)", tagFg: "#ffa124", tagLine: "rgba(255,161,36,.5)", mkBg: "#ffa124", mkFg: "#0b3f2f", bar: "#f3811d", logo: "assets/img/logo-sana-white.svg", wm: .09 },
  light: { bg: "#f4f7f2", fg: "#0b3f2f", acc: "#f3811d", glow: ["rgba(255,161,36,.22)", "rgba(64,130,39,.16)"], tagBg: "#ffffff", tagFg: "#d96c0c", tagLine: "#f3811d", mkBg: "#0b3f2f", mkFg: "#ffffff", bar: "#0b3f2f", logo: "assets/img/logo-sana.svg", wm: .07 },
  orange: { bg: "#f3811d", fg: "#ffffff", acc: "#0b3f2f", glow: ["rgba(255,200,90,.55)", "rgba(11,63,47,.35)"], tagBg: "#0b3f2f", tagFg: "#ffffff", tagLine: "", mkBg: "#ffffff", mkFg: "#f3811d", bar: "#0b3f2f", logo: "assets/img/logo-sana.svg", logoPlate: true, wm: .09 },
};
const DISPLAY = '"Outfit", "Segoe UI", sans-serif', BODY = '"Source Sans 3", "Segoe UI", sans-serif';
const imgCache = {};
const loadImg = src => imgCache[src] ??= new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
let fontsReady;
const ensureFonts = () => fontsReady ??= Promise.all(["800 80px", "700 40px", "600 30px"].map(w => document.fonts.load(`${w} Outfit`).catch(() => {})).concat(document.fonts.load('700 40px "Source Sans 3"').catch(() => {})));

function wrap(ctx, text, maxW) {
  const out = [];
  String(text || "").split("\n").forEach(par => {
    let line = "";
    par.split(/\s+/).filter(Boolean).forEach(w => {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
  });
  return out;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1350);
}

async function drawPoster(cv, p) {
  await ensureFonts();
  const T = PAL[p.theme] || PAL.dark;
  const [logo, wm] = await Promise.all([loadImg(T.logo), loadImg("assets/img/emblem-sana.svg")]);
  const ctx = cv.getContext("2d"), W = 1080, H = 1350, X = 80, MAXW = W - 2 * X, BAR = 170;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  glow(ctx, W * .92, H * .08, 640, T.glow[0]);
  glow(ctx, 0, H, 560, T.glow[1]);
  if (wm) { ctx.globalAlpha = T.wm; ctx.drawImage(wm, W - 550, H - BAR - 860, 720, 820); ctx.globalAlpha = 1; }

  // logo + étiquette
  const lh = 118, lw = logo ? lh * logo.width / logo.height : 0;
  if (T.logoPlate) { ctx.fillStyle = "#fff"; roundRect(ctx, X - 20, 60, lw + 40, lh + 24, 26); ctx.fill(); }
  if (logo) ctx.drawImage(logo, X, 72, lw, lh);
  if (p.tag) {
    ctx.font = `700 26px ${DISPLAY}`;
    const tag = p.tag.toUpperCase().split("").join(String.fromCharCode(8202));
    const tw = Math.min(ctx.measureText(tag).width + 52, W - X - lw - 120);
    const tx = W - X - tw, ty = 72 + lh / 2 - 30;
    ctx.fillStyle = T.tagBg; roundRect(ctx, tx, ty, tw, 60, 30); ctx.fill();
    if (T.tagLine) { ctx.strokeStyle = T.tagLine; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = T.tagFg; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillText(tag, tx + tw / 2, ty + 31, tw - 40);
    ctx.textAlign = "left";
  }

  // contenu : on réduit la taille jusqu'à ce que tout tienne au-dessus de la barre
  const points = (p.points || []).filter(Boolean).slice(0, 6);
  const top = 290, bottom = H - BAR - 50;
  let s = 1, L;
  for (; s >= .6; s -= .04) {
    L = {};
    ctx.font = `800 ${88 * s}px ${DISPLAY}`; L.title = wrap(ctx, p.title, MAXW);
    ctx.font = `700 ${50 * s}px ${DISPLAY}`; L.sub = wrap(ctx, p.subtitle, MAXW);
    ctx.font = `700 ${40 * s}px ${BODY}`; L.pts = points.map(t => wrap(ctx, t, MAXW - 96 * s));
    L.rows = L.pts.map(l => Math.max(68 * s, l.length * 48 * s));
    const h = L.h = L.title.length * 94 * s + (L.sub.length ? 20 * s + L.sub.length * 60 * s : 0)
      + (L.rows.length ? 48 * s + L.rows.reduce((a, r) => a + r + 26 * s, 0) - 26 * s : 0);
    if (top + h <= bottom) break;
  }
  ctx.textBaseline = "top";
  let y = top + Math.max(0, (bottom - top - L.h) * .4);
  ctx.fillStyle = T.fg; ctx.font = `800 ${88 * s}px ${DISPLAY}`;
  L.title.forEach(l => { ctx.fillText(l, X, y); y += 94 * s; });
  if (L.sub.length) {
    y += 20 * s;
    ctx.fillStyle = T.acc; ctx.font = `700 ${50 * s}px ${DISPLAY}`;
    L.sub.forEach(l => { ctx.fillText(l, X, y); y += 60 * s; });
  }
  if (L.rows.length) y += 48 * s;
  L.pts.forEach((lines, i) => {
    const r = 34 * s, rowH = L.rows[i], cy = y + rowH / 2;
    ctx.fillStyle = T.mkBg; ctx.beginPath(); ctx.arc(X + r, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.mkFg; ctx.strokeStyle = T.mkFg; ctx.textBaseline = "middle";
    if (p.style === "num") {
      ctx.font = `800 ${34 * s}px ${DISPLAY}`; ctx.textAlign = "center";
      ctx.fillText(String(i + 1), X + r, cy + 2 * s); ctx.textAlign = "left";
    } else {
      ctx.lineWidth = 5 * s; ctx.lineCap = ctx.lineJoin = "round"; ctx.beginPath();
      ctx.moveTo(X + r - 14 * s, cy + 1 * s); ctx.lineTo(X + r - 4 * s, cy + 11 * s); ctx.lineTo(X + r + 15 * s, cy - 10 * s); ctx.stroke();
    }
    ctx.fillStyle = T.fg; ctx.font = `700 ${40 * s}px ${BODY}`;
    lines.forEach((l, j) => ctx.fillText(l, X + 96 * s, cy + (j - (lines.length - 1) / 2) * 48 * s));
    y += rowH + 26 * s;
  });

  // barre WhatsApp
  const by = H - BAR;
  ctx.fillStyle = T.bar; ctx.fillRect(0, by, W, BAR);
  const cx = X + 38, cyb = by + BAR / 2;
  ctx.fillStyle = "#25d366"; ctx.beginPath(); ctx.arc(cx, cyb, 38, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cyb - 1, 19, Math.PI * .75, Math.PI * 2.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 14, cyb + 12); ctx.lineTo(cx - 20, cyb + 21); ctx.lineTo(cx - 8, cyb + 17); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = .85; ctx.font = `700 24px ${BODY}`; ctx.fillText("WHATSAPP", X + 98, cyb - 14); ctx.globalAlpha = 1;
  ctx.font = `800 42px ${DISPLAY}`; ctx.fillText(fmtPhone(data.company.whatsapp || data.company.phone), X + 98, cyb + 30, 560);
  ctx.textAlign = "right"; ctx.font = `700 26px ${DISPLAY}`;
  ctx.fillText("Commande sur WhatsApp", W - X, cyb - 6); ctx.fillText("Retrait ou livraison", W - X, cyb + 32);
  ctx.textAlign = "left";
}

const posterBlob = async p => {
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
  await drawPoster(cv, p);
  return new Promise(res => cv.toBlob(res, "image/png"));
};
function drawAll() {
  if (tab !== "ia") return;
  document.querySelectorAll("canvas[data-poster]").forEach(cv => { const p = aiPosts.find(x => x.id === cv.dataset.poster); if (p) drawPoster(cv, p); });
}
AFTER_RENDER.push(drawAll);

// ---------------------------------------------------------
// Génération avec Claude
// ---------------------------------------------------------
const POST_SCHEMA = {
  type: "object", additionalProperties: false, required: ["posts"],
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["tag", "title", "subtitle", "points", "style", "theme", "caption", "hashtags"],
        properties: {
          tag: { type: "string", description: "Étiquette courte en haut de l'affiche, 1 à 3 mots (ex. : Disponible, Conseil SANA, Bientôt)." },
          title: { type: "string", description: "Titre de l'affiche, 45 caractères maximum, percutant." },
          subtitle: { type: "string", description: "Phrase courte sous le titre, 60 caractères maximum. Chaîne vide si inutile." },
          points: { type: "array", items: { type: "string" }, description: "2 à 4 points courts pour l'affiche, 38 caractères maximum chacun." },
          style: { type: "string", enum: ["checks", "num"], description: "num pour des étapes ou des conseils dans l'ordre, checks sinon." },
          theme: { type: "string", enum: ["dark", "light", "orange"], description: "Couleurs de l'affiche ; alterner d'une publication à l'autre." },
          caption: { type: "string", description: "Texte de la publication Facebook / Instagram : 3 à 7 lignes courtes, quelques émojis, se termine par l'appel à écrire sur WhatsApp avec le numéro." },
          hashtags: { type: "array", items: { type: "string" }, description: "3 à 6 hashtags sans le #." },
        },
      },
    },
  },
};

function systemPrompt() {
  const c = data.company;
  const items = [];
  const add = (name, o) => { if (o && o.visible !== false) items.push(`${name} : ${o.status === "available" ? "DISPONIBLE maintenant" : "bientôt (pas encore en vente)"}`); };
  add(data.hatching.title, data.hatching);
  (data.chickens.offers || []).forEach(o => add(o.title, o));
  add(data.eggs.title, data.eggs);
  add(data.feed.title, data.feed);
  return `Tu es le responsable des réseaux sociaux de ${c.name} (${c.fullName}), entreprise basée à ${c.address}.
Tu écris des publications Facebook et Instagram en français simple, adapté aux éleveurs de Côte d'Ivoire.

Produits et état actuel :
${items.map(x => "- " + x).join("\n")}
Détails des œufs à couver : ${data.hatching.desc} ${(data.hatching.items || []).join(" ; ")}.

Contact : WhatsApp ${fmtPhone(c.whatsapp)}. Retrait ou livraison à convenir.

Règles strictes :
- Ne vends que ce qui est DISPONIBLE. Les produits « bientôt » s'annoncent seulement : « bientôt », « soyez prévenu en premier ».
- Ne donne jamais de prix, de quantité minimum, d'unité de vente ni de délai : ces informations se donnent sur WhatsApp.
- Ne parle jamais de formule, d'ingrédients ou de pourcentages des aliments : c'est le secret de l'entreprise.
- N'invente aucun chiffre ni promesse (taux d'éclosion, race, vaccins, promotions, récompenses) qui ne figure pas ci-dessus.
- Les conseils techniques doivent être exacts et prudents.
- Écris toujours « ${c.fullName} » exactement ainsi si tu écris le nom complet.
- Chaque publication est différente des autres (angle, titre, couleurs).`;
}

let sdkLoading;
const loadSdk = () => sdkLoading ??= new Promise((res, rej) => {
  if (window.Anthropic) return res(window.Anthropic);
  const s = document.createElement("script");
  s.src = "assets/vendor/anthropic-sdk.js";
  s.onload = () => res(window.Anthropic);
  s.onerror = () => { sdkLoading = null; rej(new Error("sdk")); };
  document.head.appendChild(s);
});

function readPrefs() {
  const pf = {
    subject: $("#ai-subject").value, tone: $("#ai-tone").value, model: $("#ai-model").value,
    count: Math.min(10, Math.max(1, parseInt($("#ai-count").value, 10) || 1)),
    start: $("#ai-start").value, hour: $("#ai-hour").value || "19:00", notes: $("#ai-notes").value.trim(),
  };
  aiStore.set(AI_PREFS_KEY, pf);
  return pf;
}

function claudeError(err) {
  const st = err && err.status, msg = String(err && err.message || "");
  if (st === 401) return "la clé Claude est invalide.";
  if (st === 403) return "cette clé n'a pas accès à ce modèle.";
  if (/credit balance/i.test(msg)) return "le crédit de votre compte Claude est épuisé : rechargez sur console.anthropic.com → Billing.";
  if (st === 429) return "trop de demandes ou limite de dépense atteinte. Réessayez dans une minute ou vérifiez vos limites.";
  if (st === 529 || st >= 500) return "le service Claude est surchargé. Réessayez dans quelques minutes.";
  if (err && err.message === "sdk") return "impossible de charger le module IA. Vérifiez votre connexion internet.";
  return "connexion au service Claude impossible. Vérifiez votre connexion internet.";
}

async function generate() {
  const pf = readPrefs();
  if (!secrets.claudeKey) { toast("Ajoutez d'abord votre clé Claude dans « 1. Connexions ».", "error"); $("#ai-key")?.focus(); return; }
  aiBusy = "gen"; render();
  toast("L'IA écrit vos publications… (environ une minute)");
  try {
    const Anthropic = await loadSdk();
    const client = new Anthropic({ apiKey: secrets.claudeKey, dangerouslyAllowBrowser: true });
    const recent = aiPosts.slice(-15).map(p => "- " + p.title).join("\n");
    const user = `Écris ${pf.count} publication(s).
Sujet : ${AI_SUBJECTS[pf.subject]}.
Ton : ${AI_TONES[pf.tone]}.
${pf.notes ? `Consigne du gérant : ${pf.notes}\n` : ""}${recent ? `Titres déjà utilisés, à ne pas répéter :\n${recent}\n` : ""}Elles seront publiées une par jour, dans l'ordre.`;
    const stream = client.messages.stream({
      model: pf.model,
      max_tokens: 16000,
      system: systemPrompt(),
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: POST_SCHEMA } },
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("refusal");
    if (msg.stop_reason === "max_tokens") throw new Error("max_tokens");
    const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
    const out = JSON.parse(text).posts || [];
    const [hh, mm] = pf.hour.split(":").map(Number);
    const start = pf.start ? new Date(pf.start + "T00:00") : new Date(Date.now() + 864e5);
    out.forEach((p, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); d.setHours(hh || 0, mm || 0, 0, 0);
      aiPosts.push({
        id: "p" + Date.now().toString(36) + i, tag: p.tag || "", title: p.title || "", subtitle: p.subtitle || "",
        points: (p.points || []).slice(0, 6), style: p.style === "num" ? "num" : "checks", theme: PAL[p.theme] ? p.theme : "dark",
        caption: p.caption || "", hashtags: (p.hashtags || []).map(h => String(h).replace(/^#/, "").replace(/\s+/g, "")),
        when: `${localDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, status: "draft",
      });
    });
    savePosts();
    const m = AI_MODELS[pf.model] || AI_MODELS["claude-opus-5-5"];
    const u = msg.usage || {};
    const cost = ((u.input_tokens || 0) * m.in + (u.output_tokens || 0) * m.out) / 1e6;
    aiBusy = ""; render();
    toast(`${out.length} publication(s) prête(s). Coût de cette génération : environ ${fcfa(cost)}. Relisez et modifiez si besoin avant de publier.`, "success");
  } catch (err) {
    aiBusy = ""; render();
    const why = err.message === "refusal" ? "l'IA a refusé cette demande ; reformulez la consigne."
      : err.message === "max_tokens" ? "réponse trop longue ; demandez moins de publications."
      : err instanceof SyntaxError ? "réponse inattendue de l'IA ; réessayez."
      : claudeError(err);
    toast("Échec de la génération : " + why, "error");
  }
}

// ---------------------------------------------------------
// Facebook (API Graph)
// ---------------------------------------------------------
function fbError(e) {
  const code = e && e.code;
  if (code === 190) return "le jeton de la page est invalide ou expiré.";
  if (code === 200 || code === 10 || code === 3) return "le jeton n'a pas la permission pages_manage_posts pour cette page.";
  if (code === 100 && /scheduled/i.test(e.message || "")) return "la date doit être entre 10 minutes et 30 jours à partir de maintenant.";
  if (code === 100) return "l'ID de la page est incorrect ou la page n'est pas accessible avec ce jeton.";
  if (code === 368 || code === 4 || code === 32) return "Facebook limite temporairement les publications. Réessayez plus tard.";
  return (e && e.message) ? "Facebook a répondu : " + e.message : "connexion à Facebook impossible.";
}
async function fbPhoto(p, when) {
  const fd = new FormData();
  fd.append("source", await posterBlob(p), "sana.png");
  fd.append("message", fullCaption(p));
  fd.append("access_token", secrets.fbToken);
  if (when) {
    fd.append("published", "false");
    fd.append("unpublished_content_type", "SCHEDULED");
    fd.append("scheduled_publish_time", String(Math.floor(when / 1000)));
  }
  let r, j;
  try { r = await fetch(`https://graph.facebook.com/${FB_VERSION}/${encodeURIComponent(secrets.fbPage)}/photos`, { method: "POST", body: fd }); j = await r.json(); }
  catch (e) { throw {}; }
  if (!r.ok || j.error) throw j.error || {};
  return j.post_id || j.id;
}
async function sendToFacebook(ids, schedule) {
  let ok = 0;
  aiBusy = "fb"; render();
  for (const id of ids) {
    const p = aiPosts.find(x => x.id === id);
    if (!p || p.status !== "draft") continue;
    let when = 0;
    if (schedule) {
      when = new Date(p.when).getTime();
      const left = when - Date.now();
      if (!when || left < 10 * 60e3 || left > 30 * 864e5) { p.error = "Choisissez une date entre 10 minutes et 30 jours à partir de maintenant."; continue; }
    }
    toast(`Envoi à Facebook : « ${p.title} »…`);
    try {
      p.fbId = await fbPhoto(p, when);
      p.status = schedule ? "scheduled" : "published";
      delete p.error; ok++;
    } catch (e) { p.error = "Échec : " + fbError(e); }
    savePosts();
  }
  aiBusy = ""; render();
  const failed = ids.length - ok;
  toast(failed ? `${ok} envoyée(s), ${failed} en échec : voyez le message sous chaque publication.` : schedule ? `${ok} publication(s) programmée(s). Vous les retrouvez dans Meta Business Suite → Planificateur.` : "Publié sur votre page Facebook.", failed ? "error" : "success");
}

// ---------------------------------------------------------
// Actions et saisie
// ---------------------------------------------------------
Object.assign(ACTIONS, {
  "ai-save-keys": () => {
    const key = $("#ai-key").value.trim(), page = $("#fb-page").value.trim(), tok = $("#fb-token").value.trim();
    if (key) secrets.claudeKey = key;
    secrets.fbPage = page;
    if (tok) secrets.fbToken = tok;
    sealVault(vaultPass, allSecrets()).then(() => { render(); toast("Connexions enregistrées (chiffrées sur cet appareil).", "success"); });
    return false;
  },
  "ai-test": () => {
    (async () => {
      const res = [];
      if (secrets.claudeKey) {
        try { const A = await loadSdk(); await new A({ apiKey: secrets.claudeKey, dangerouslyAllowBrowser: true }).models.retrieve(prefs().model); res.push("Claude : OK"); }
        catch (e) { res.push("Claude : " + claudeError(e)); }
      } else res.push("Claude : aucune clé");
      if (secrets.fbPage && secrets.fbToken) {
        try {
          const r = await fetch(`https://graph.facebook.com/${FB_VERSION}/${encodeURIComponent(secrets.fbPage)}?fields=name&access_token=${encodeURIComponent(secrets.fbToken)}`);
          const j = await r.json();
          if (!r.ok || j.error) throw j.error || {};
          res.push(`Facebook : OK (page « ${j.name} »)`);
        } catch (e) { res.push("Facebook : " + fbError(e)); }
      } else res.push("Facebook : non connecté");
      toast(res.join(" — "), res.every(x => /OK|aucune|non connecté/.test(x)) ? "success" : "error");
    })();
    return false;
  },
  "ai-generate": () => { if (!aiBusy) generate(); return false; },
  "ai-del": b => { aiPosts = aiPosts.filter(p => p.id !== b.dataset.id); savePosts(); },
  "ai-clear": () => { aiPosts = []; savePosts(); },
  "ai-dl": b => {
    const p = aiPosts.find(x => x.id === b.dataset.id);
    posterBlob(p).then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `SANA-${slugPlain(p.title).slice(0, 40) || "affiche"}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    return false;
  },
  "ai-copy": b => {
    const p = aiPosts.find(x => x.id === b.dataset.id);
    navigator.clipboard?.writeText(fullCaption(p)).then(() => toast("Texte copié : collez-le dans Facebook, Instagram ou TikTok.", "success"), () => toast("Copie impossible sur ce navigateur.", "error"));
    return false;
  },
  "ai-post": b => { sendToFacebook([b.dataset.id], false); return false; },
  "ai-schedule": b => { sendToFacebook([b.dataset.id], true); return false; },
  "ai-schedule-all": () => { sendToFacebook(aiPosts.filter(p => p.status === "draft").map(p => p.id), true); return false; },
});

let redrawTimer;
$("#panel").addEventListener("input", e => {
  const el = e.target;
  if (/^ai-(subject|tone|count|model|start|hour|notes)$/.test(el.id)) { readPrefs(); if (el.id === "ai-model") render(); return; }
  if (!el.dataset.ai) return;
  const [id, k] = el.dataset.ai.split(".");
  const p = aiPosts.find(x => x.id === id);
  if (!p) return;
  p[k] = k === "points" ? el.value.split("\n").map(x => x.trim()).filter(Boolean)
    : k === "hashtags" ? el.value.split(/[\s,]+/).map(x => x.replace(/^#/, "")).filter(Boolean)
    : el.value;
  savePosts();
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => { const cv = document.querySelector(`canvas[data-poster="${id}"]`); if (cv) drawPoster(cv, p); }, 150);
});
