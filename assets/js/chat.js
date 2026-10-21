/* =========================================================
   SANA — Assistant du site
   Répond aux visiteurs à partir de data/content.js (produits, FAQ, contacts),
   pose les bonnes questions, puis prépare la demande pour WhatsApp.
   Aucune donnée n'est envoyée ailleurs : le visiteur envoie lui-même le message.
   Chargé après main.js (utilise C, M, waLink, track, esc).
   ========================================================= */
(() => {
  const B = C.chatbot || {};
  if (B.visible === false) return;

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
  const isSoon = x => x && x.status === "soon";
  const H = C.hatching && C.hatching.visible !== false ? C.hatching : null;
  const chicks = C.chickens.offers.filter(o => o.visible !== false && o.status === "available");
  const wa = (text) => waLink(text);
  const hours = () => { const h = String(C.company.hours || ""); return h.charAt(0).toLowerCase() + h.slice(1); };

  // ---------- Heures d'ouverture (Côte d'Ivoire : UTC+0) ----------
  function isOpen() {
    const m = norm(C.company.hours).match(/(\d{1,2})\s*h.*?(\d{1,2})\s*h/);
    if (!m) return true;
    const d = new Date(), h = d.getUTCHours() + d.getUTCMinutes() / 60;
    const sunday = d.getUTCDay() === 0 && !/dimanche/.test(norm(C.company.hours));
    return !sunday && h >= +m[1] && h < +m[2];
  }

  // ---------- Interface ----------
  const root = document.createElement("div");
  root.className = "chat";
  root.innerHTML = `
    <button type="button" class="chat-launch" aria-expanded="false" aria-controls="chatPanel">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18l1.5-3.5A7 7 0 1 1 9 17.5z"/><path d="M9 11h6M9 8.5h4"/></svg>
      <span>Une question ?</span>
    </button>
    <section class="chat-panel" id="chatPanel" role="dialog" aria-label="${esc(B.name || "Assistant SANA")}" hidden>
      <header class="chat-head">
        <img src="assets/img/logo-sana-white.svg" alt="" width="46" height="30">
        <div><strong>${esc(B.name || "Assistant SANA")}</strong><span class="chat-status"></span></div>
        <button type="button" class="chat-close" aria-label="Fermer">×</button>
      </header>
      <div class="chat-log" aria-live="polite"></div>
      <div class="chat-chips"></div>
      <form class="chat-form" autocomplete="off">
        <input type="text" maxlength="300" placeholder="Écrivez votre question…" aria-label="Votre message">
        <button type="submit" aria-label="Envoyer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg></button>
      </form>
    </section>`;
  document.body.appendChild(root);
  const launch = root.querySelector(".chat-launch"), panel = root.querySelector(".chat-panel");
  const log = root.querySelector(".chat-log"), chips = root.querySelector(".chat-chips");
  const form = root.querySelector(".chat-form"), input = form.querySelector("input");
  root.querySelector(".chat-status").textContent = isOpen() ? "En ligne · réponse immédiate" : "Réponse immédiate · conseillers fermés";

  function say(html, who = "bot") {
    const p = document.createElement("div");
    p.className = `msg msg-${who}`;
    p.innerHTML = html;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }
  const userSay = text => say(esc(text), "me");
  function offer(list) {
    chips.innerHTML = "";
    list.forEach(([label, fn]) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label;
      b.addEventListener("click", () => { userSay(label); fn(); });
      chips.appendChild(b);
    });
  }
  const waBtn = (text, label, product) =>
    `<a class="msg-wa" href="${esc(wa(text))}" target="_blank" rel="noopener" data-chat-lead="${esc(product || "")}">${label || "Envoyer sur WhatsApp"}</a>`;

  // ---------- Menu ----------
  function menu(intro) {
    if (intro) say(intro);
    const items = [];
    chicks.forEach(o => items.push([o.title, () => product(o, "réserver")]));
    if (H) items.push([H.title, () => product(H, isSoon(H) ? null : "commander")]);
    items.push(["Aliments", feed]);
    items.push(["Devenir revendeur", reseller]);
    if ((C.faq || []).length) items.push(["Questions fréquentes", faq]);
    items.push(["Parler à un conseiller", human]);
    offer(items);
    mode = null;
  }

  // ---------- Questions guidées ----------
  let mode = null; // { steps, i, answers, done }
  function ask(steps, done) {
    mode = { steps, i: 0, answers: {}, done };
    next();
  }
  function next() {
    const s = mode.steps[mode.i];
    say(esc(s.q));
    offer((s.chips || []).map(c => [c, () => answer(c)]).concat([["Annuler", () => menu("D'accord. Que puis-je faire pour vous ?")]]));
    input.placeholder = s.ph || "Votre réponse…";
    input.focus({ preventScroll: true });
  }
  function answer(text) {
    const s = mode.steps[mode.i];
    mode.answers[s.key] = text.trim();
    mode.i++;
    if (mode.i < mode.steps.length) return next();
    const { answers, done } = mode;
    mode = null;
    input.placeholder = "Écrivez votre question…";
    done(answers);
  }
  const lines = (pairs) => pairs.filter(([, v]) => v).map(([k, v]) => `- ${k} : ${v}`).join("\n");
  function finish(intro, msg, product) {
    say(`${intro}<pre>${esc(msg)}</pre>${waBtn(msg, "Envoyer ma demande sur WhatsApp", product)}`
      + (isOpen() ? "" : `<small>Nos conseillers répondent ${esc(hours())}.</small>`));
    offer([["Autre question", () => menu("Que puis-je faire d'autre pour vous ?")]]);
  }

  function product(x, verb) {
    const items = (x.items || []).filter(Boolean).map(i => `<li>${esc(i)}</li>`).join("");
    say(`<strong>${esc(x.title)}</strong>${x.usage ? ` · ${esc(x.usage)}` : ""}<br>${esc(x.desc)}${items ? `<ul>${items}</ul>` : ""}${x.price ? `<p><strong>${esc(x.price)}</strong></p>` : ""}`);
    if (!verb) {
      say("Ce produit arrive bientôt. Voulez-vous être prévenu dès qu'il est disponible ?");
      return offer([["Oui, prévenez-moi", () => notify(x.title)], ["Menu", () => menu("Que puis-je faire pour vous ?")]]);
    }
    const isEgg = x === H;
    ask([
      { key: "qte", q: isEgg ? "Combien d'œufs (ou de plateaux) souhaitez-vous ?" : "Combien en souhaitez-vous ?", ph: "Ex. : 500" },
      { key: "date", q: "Pour quelle date ?", ph: "Ex. : dès que possible", chips: ["Dès que possible"] },
      { key: "ville", q: "Dans quelle ville êtes-vous ?", ph: "Ex. : Yamoussoukro" },
      { key: "nom", q: "Votre nom, pour préparer la demande ?", ph: "Nom et prénom" },
    ], a => finish("Merci ! Voici votre demande, prête à envoyer :",
      `Bonjour ${C.company.name}, je souhaite ${verb} : ${x.title}.\n` + lines([["Quantité", a.qte], ["Date", a.date], ["Ville", a.ville], ["Nom", a.nom]]) + "\n(Demande préparée avec l'assistant du site)", x.title));
  }

  function notify(title) {
    ask([
      { key: "ville", q: "Dans quelle ville êtes-vous ?", ph: "Ex. : Bouaké" },
      { key: "nom", q: "Votre nom ?", ph: "Nom et prénom" },
    ], a => finish("C'est noté. Envoyez ce message et nous vous prévenons à l'arrivée :",
      `Bonjour ${C.company.name}, prévenez-moi quand ce produit sera disponible : ${title}.\n` + lines([["Ville", a.ville], ["Nom", a.nom]]), title));
  }

  function feed() {
    const species = (C.species || []).map(s => s.name);
    say(isSoon(C.feed)
      ? `Nos <strong>aliments</strong> arrivent bientôt, pour : ${esc(species.join(", "))}. Nos formules sont établies par notre technicien et restent confidentielles.`
      : `Nos aliments sont fabriqués pour : ${esc(species.join(", "))}.`);
    ask([
      { key: "espece", q: "Pour quels animaux ?", chips: species.slice(0, 6) },
      { key: "nb", q: "Combien d'animaux environ ?", ph: "Ex. : 1 000 poulets" },
      { key: "ville", q: "Dans quelle ville ?", ph: "Ex. : Toumodi" },
      { key: "nom", q: "Votre nom ?", ph: "Nom et prénom" },
    ], a => finish(isSoon(C.feed) ? "Merci ! Envoyez ce message pour être prévenu en premier :" : "Merci ! Voici votre demande de devis :",
      `Bonjour ${C.company.name}, ${isSoon(C.feed) ? "prévenez-moi au lancement des aliments" : "je souhaite un devis d'aliment"}.\n` + lines([["Animaux", a.espece], ["Effectif", a.nb], ["Ville", a.ville], ["Nom", a.nom]]), "Aliment"));
  }

  function reseller() {
    say("Vous tenez une boutique, une pharmacie vétérinaire ou un dépôt ? Devenez revendeur SANA. Quelques questions :");
    ask([
      { key: "boutique", q: "Nom de votre boutique ou entreprise ?" },
      { key: "ville", q: "Dans quelle ville ?" },
      { key: "volume", q: "Quels produits et quels volumes par mois, environ ?", ph: "Ex. : 2 000 poussins par mois" },
      { key: "nom", q: "Votre nom ?", ph: "Nom et prénom" },
    ], a => finish("Merci ! Un commercial vous recontacte. Votre message :",
      `Bonjour ${C.company.name}, je souhaite devenir revendeur.\n` + lines([["Entreprise", a.boutique], ["Ville", a.ville], ["Volumes", a.volume], ["Nom", a.nom]]), "Revendeur"));
  }

  function faq() {
    say("Voici les questions qu'on nous pose le plus :");
    offer(C.faq.map(f => [f.q, () => { say(esc(f.a)); faqMore(); }]).concat([["Menu", () => menu("Que puis-je faire pour vous ?")]]));
  }
  const faqMore = () => offer([["Autre question", faq], ["Menu", () => menu("Que puis-je faire pour vous ?")]]);

  function human(reason) {
    const msg = `Bonjour ${C.company.name}, je souhaite parler à un conseiller.` + (reason ? `\n${reason}` : "");
    say(`Un conseiller vous répond sur WhatsApp${isOpen() ? "" : ` (${esc(hours())})`}. ${waBtn(msg, "Écrire à un conseiller", "Conseiller")}`);
    offer([["Menu", () => menu("Que puis-je faire d'autre pour vous ?")]]);
  }

  // ---------- Texte libre ----------
  function reply(text) {
    const t = norm(text);
    const has = re => re.test(t);
    if (has(/malad|mort|mortalit|meur|diarrh|tousse|sympt|traitement|soigner|veterin|fievre|paralys/)) {
      say("Pour toute question de santé de vos animaux, un conseiller doit voir votre situation : l'assistant ne donne pas de diagnostic.");
      return human(`Question santé : ${text}`);
    }
    if (has(/formule|composition|recette|ingredient|dosage/)) {
      say("Nos formules sont établies par notre technicien selon l'espèce, l'âge et vos objectifs. Elles restent confidentielles ; nous vous conseillons sur l'aliment adapté à vos animaux.");
      return offer([["Aliments", feed], ["Menu", () => menu()]]);
    }
    if (has(/poussin|chair|poulet/) && chicks.length) return product(chicks[0], "réserver");
    if (has(/oeuf|couv|incuba/) && H) return product(H, isSoon(H) ? null : "commander");
    if (has(/aliment|provende|nourriture|granule|sac/)) return feed();
    if (has(/revend|distribu|partenaire|boutique|grossiste|depot/)) return reseller();
    if (has(/prix|tarif|cout|combien.*(coute|fcfa)|fcfa|cher/)) {
      const priced = [H, ...chicks].filter(x => x && x.price);
      say(priced.length ? priced.map(x => `<strong>${esc(x.title)}</strong> : ${esc(x.price)}`).join("<br>") + "<br>Pour une quantité précise, nous confirmons sur WhatsApp."
        : "Nos prix dépendent du produit et de la quantité : nous vous les donnons directement sur WhatsApp.");
      return menu();
    }
    if (has(/livr|transport|retrait|recuper|expedi/)) {
      const info = [H, ...chicks].filter(Boolean).flatMap(x => (x.items || []).filter(i => /livr|transport|retrait/i.test(i)).map(i => `<strong>${esc(x.title)}</strong> : ${esc(i)}`));
      say(info.length ? info.join("<br>") : "Le retrait ou la livraison se décident ensemble, selon votre ville.");
      return menu();
    }
    if (has(/horaire|heure|ouvert|ferme|quand.*(appel|venir)/)) { say(`Nous répondons ${esc(hours())}.`); return menu(); }
    if (has(/adresse|ou (etes|se trouve)|situe|localis|venir vous voir|plan/)) { say(`Nous sommes à ${esc(C.company.address)}.`); return menu(); }
    if (has(/tel|numero|appel|joindre|contact|whatsapp/)) {
      say(`WhatsApp et téléphone : <a href="tel:${esc(C.company.phone.replace(/[^\d+]/g, ""))}">${esc(C.company.phone)}</a>.`);
      return human();
    }
    if (has(/^(bonjour|bonsoir|salut|hello|slt|bjr|cc|coucou)\b/)) return menu("Bonjour ! Que puis-je faire pour vous ?");
    if (has(/merci/)) return menu("Avec plaisir ! Autre chose ?");
    // FAQ : la question qui partage le plus de mots
    const words = t.split(/\W+/).filter(w => w.length > 3);
    let best = null, score = 0;
    (C.faq || []).forEach(f => {
      const q = norm(f.q + " " + f.a);
      const s = words.filter(w => q.includes(w)).length;
      if (s > score) { score = s; best = f; }
    });
    if (best && score >= 2) { say(`<strong>${esc(best.q)}</strong><br>${esc(best.a)}`); return faqMore(); }
    say("Je n'ai pas bien compris. Choisissez un sujet ci-dessous, ou posez votre question à un conseiller.");
    menu();
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    userSay(text);
    if (mode) answer(text); else reply(text);
  });

  // ---------- Ouverture / fermeture ----------
  let started = false;
  function open(state) {
    panel.hidden = !state;
    launch.setAttribute("aria-expanded", String(state));
    root.classList.toggle("is-open", state);
    if (state && !started) {
      started = true;
      track("chatbot_open");
      menu(esc(B.greeting || "Bonjour 👋 Je suis l'assistant de SANA. Comment puis-je vous aider ?"));
    }
    if (state) input.focus({ preventScroll: true }); else launch.focus({ preventScroll: true });
  }
  launch.addEventListener("click", () => open(panel.hidden));
  root.querySelector(".chat-close").addEventListener("click", () => open(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) open(false); });
  log.addEventListener("click", e => {
    const a = e.target.closest("[data-chat-lead]");
    if (a) track("generate_lead", { channel: "chatbot", product: a.dataset.chatLead });
  });
})();
