/* =========================================================
   SANA — onglet DOLPHin de l'administration
   Intègre le composant <dolphin-studio> (dépôt yassine1158/dolphin, copié dans
   assets/vendor/dolphin.js). La marque est construite à partir du contenu du site ;
   les clés restent dans le coffre chiffré de l'admin (aucune seconde phrase secrète).
   ========================================================= */

const DOLPHIN_SRC = "assets/vendor/dolphin.js";
const OLD_POSTS_KEY = "sana-ai-posts"; // anciennes publications de l'onglet IA, reprises une fois

let dolphinEl = null;
let dolphinBrandJson = "";
let dolphinUnlock = null; // mot de passe pour lequel le composant a été créé
let dolphinLoading = null;

const loadDolphin = () => dolphinLoading ??= new Promise((resolve, reject) => {
  if (window.Dolphin) return resolve(window.Dolphin);
  const s = document.createElement("script");
  s.src = `${DOLPHIN_SRC}?v=${Math.floor(Date.now() / 60000)}`;
  s.onload = () => resolve(window.Dolphin);
  s.onerror = () => { dolphinLoading = null; reject(new Error("dolphin.js")); };
  document.head.appendChild(s);
});

const waPretty = p => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("225") ? "+225 " + d.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ") : p; };

// La marque DOLPHin est déduite du contenu du site : produits, disponibilités, contact.
function sanaBrand() {
  const c = data.company;
  const products = [];
  const add = (o, name) => {
    if (!o || o.visible === false || !name) return;
    const details = [o.desc, ...(o.items || [])].filter(Boolean).join(" ; ").slice(0, 600);
    products.push({ name, status: o.status === "available" ? "available" : "soon", ...(details ? { details } : {}) });
  };
  add(data.hatching, data.hatching?.title);
  (data.chickens?.offers || []).forEach(o => add(o, o.title));
  add(data.eggs, data.eggs?.title);
  add(data.feed, data.feed?.title);
  return {
    id: "sana",
    name: c.name || "SANA",
    fullName: c.fullName || undefined,
    location: c.address || undefined,
    audience: "éleveurs de Côte d'Ivoire : particuliers, fermes et couvoirs",
    language: "fr",
    contact: { whatsapp: waPretty(c.whatsapp || c.phone), callToAction: "Commande sur WhatsApp" },
    footerLines: ["Commande sur WhatsApp", "Retrait ou livraison"],
    products,
    colors: { primary: "#0b3f2f", accent: "#f3811d", light: "#f4f7f2" },
    logoUrl: "assets/img/logo-sana.svg",
    logoOnDarkUrl: "assets/img/logo-sana-white.svg",
    rules: {
      hidePrices: true,
      neverMention: ["les formules, ingrédients et pourcentages des aliments : c'est le secret de fabrication de SANA"],
    },
  };
}

// Reprend une seule fois les publications de l'ancien onglet IA dans le format DOLPHin.
function migrateOldPosts() {
  const NEW_KEY = "dolphin:sana:posts:sana";
  try {
    const old = JSON.parse(localStorage.getItem(OLD_POSTS_KEY) || "null");
    if (!Array.isArray(old) || !old.length || localStorage.getItem(NEW_KEY)) return;
    const now = new Date().toISOString();
    const posts = old.map(p => ({
      id: String(p.id), createdAt: now, tag: p.tag || "", title: p.title || "", subtitle: p.subtitle || "",
      points: Array.isArray(p.points) ? p.points : [], style: p.style === "num" ? "steps" : "checks",
      theme: p.theme === "orange" ? "accent" : p.theme === "light" ? "light" : "dark",
      caption: p.caption || "", hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
      scheduledAt: new Date(p.when || Date.now()).toISOString(),
      status: ["scheduled", "published"].includes(p.status) ? p.status : "draft",
      ...(p.fbId ? { externalId: String(p.fbId) } : {}),
    }));
    localStorage.setItem(NEW_KEY, JSON.stringify(posts));
    localStorage.removeItem(OLD_POSTS_KEY);
  } catch (e) { /* stockage indisponible : on repart de zéro */ }
}

TABS.ia = () => `
  <h2 class="ai-title"><img src="assets/img/dolphin-mark.svg" alt="" width="40" height="40"><span>DOLPH<b>in</b></span><span class="help">· studio IA</span></h2>
  <p class="intro">DOLPHin écrit vos publications Facebook et Instagram à partir du contenu du site (produits disponibles ou « bientôt »), dessine l'affiche aux couleurs SANA, puis la publie ou la programme sur votre page. Rien n'est publié sans votre clic. Les prix, quantités et formules ne sont jamais mentionnés.</p>
  <div id="dolphinHost"><p class="intro">Chargement de DOLPHin…</p></div>`;

async function mountDolphin() {
  if (tab !== "ia") return;
  const host = $("#dolphinHost");
  if (!host) return;
  let Dolphin;
  try { Dolphin = await loadDolphin(); } catch (e) {
    host.innerHTML = `<p class="token-state missing">DOLPHin n'a pas pu se charger. Vérifiez votre connexion internet puis rouvrez l'onglet.</p>`;
    return;
  }
  if (tab !== "ia" || !host.isConnected) return;

  const brand = sanaBrand();
  const brandJson = JSON.stringify(brand);
  const stale = !dolphinEl || dolphinUnlock !== vaultPass || dolphinBrandJson !== brandJson;
  if (stale) {
    migrateOldPosts();
    dolphinEl?.remove();
    dolphinEl = document.createElement("dolphin-studio");
    dolphinBrandJson = brandJson;
    dolphinUnlock = vaultPass;
    dolphinEl.config = {
      mode: "direct",
      brand,
      model: "claude-opus-5-5",
      secrets: { claudeKey: secrets.claudeKey || "", metaPageId: secrets.fbPage || "", metaToken: secrets.fbToken || "" },
      // DOLPHin signale les nouvelles clés : elles rejoignent le coffre de l'admin
      onSecretsChange: async next => {
        secrets.claudeKey = next.claudeKey || "";
        secrets.fbPage = next.metaPageId || "";
        secrets.fbToken = next.metaToken || "";
        await sealVault(vaultPass, allSecrets());
      },
    };
  }
  host.replaceChildren(dolphinEl); // garde le même composant d'un affichage à l'autre
}
AFTER_RENDER.push(() => { void mountDolphin(); });
