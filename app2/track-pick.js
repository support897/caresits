// Caresitters app2 — "Who are you?" then "What are you looking for?"
// Asked once, straight after the one sign-up (Google, Apple or email).
// The answer picks one of four separate tracks (tracks.js). A person who
// already has a family can still choose Stay connected from here.
import { WHO_CARDS, LOOKING_CARDS } from "./tracks.js";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// Resolves { track } or { role: "communicate" }.
export function pickTrack() {
  return new Promise((resolve) => {
    const wrap = el("div", "trackOverlay");
    wrap.id = "trackOverlay";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "trackTitle");
    const card = el("div", "trackCard");
    wrap.append(card);
    const bunny = el("img"); bunny.src = "bunny/bunny-hello.png"; bunny.alt = "The Caresitters bunny says hello";
    const finish = (value) => { wrap.remove(); resolve(value); };

    const stepWho = () => {
      card.replaceChildren(bunny);
      const h = el("h2", null, "Who are you?"); h.id = "trackTitle";
      card.append(h, el("p", null, "Hi! I'm Bun. Tell me who you are and I will set things up."));
      const list = el("div", "trackChoices");
      for (const c of WHO_CARDS) {
        const b = el("button"); b.type = "button"; b.dataset.who = c.id;
        b.append(el("b", null, c.title), el("span", null, c.body));
        b.addEventListener("click", () => stepLooking(c.id));
        list.append(b);
      }
      card.append(list);
      const later = el("button", "quietBtn", "I already have a family and want to stay connected");
      later.type = "button"; later.dataset.who = "communicate";
      later.addEventListener("click", () => finish({ role: "communicate" }));
      card.append(later);
    };

    const stepLooking = (who) => {
      card.replaceChildren(bunny);
      const h = el("h2", null, who === "family" ? "What are you looking for?" : "What do you do?"); h.id = "trackTitle";
      card.append(h);
      const list = el("div", "trackChoices");
      for (const c of LOOKING_CARDS[who]) {
        const b = el("button"); b.type = "button"; b.dataset.track = c.track;
        b.append(el("b", null, c.title), el("span", null, c.body));
        b.addEventListener("click", () => finish({ track: c.track }));
        list.append(b);
      }
      card.append(list);
      const back = el("button", "quietBtn", "Back"); back.type = "button";
      back.addEventListener("click", stepWho);
      card.append(back);
    };

    stepWho();
    document.body.append(wrap);
    wrap.querySelector("button")?.focus();
  });
}
