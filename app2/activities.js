// Caresitters app2 — the activity planner (the two homes
// build). A bank of activities by age band crossed with what
// the kids love. planDay makes three slots for a date;
// planWeek makes seven days. Both are deterministic: the same
// children on the same date always get the same plan, so the
// family and the carer see one plan, never two. No Math.random
// anywhere in the result path: a seeded pick, hashed from the
// date and the children, does the choosing.
//
// Titles and notes live in the language layer as act.<id>.t
// and act.<id>.n; this file holds structure only.

export const INTERESTS = [
  { id: "water", key: "homes.love.water" },
  { id: "drawing", key: "homes.love.drawing" },
  { id: "music", key: "homes.love.music" },
  { id: "park", key: "homes.love.park" },
  { id: "baking", key: "homes.love.baking" },
  { id: "story", key: "homes.love.story" },
  { id: "dancing", key: "homes.love.dancing" },
  { id: "blocks", key: "homes.love.blocks" },
  { id: "animals", key: "homes.love.animals" },
  { id: "sport", key: "homes.love.sport" },
];
export const INTEREST_IDS = INTERESTS.map((i) => i.id);

export const BANDS = ["0-1", "2-3", "4-5", "6-8", "9-12"];
export function bandForAge(ageYears) {
  if (ageYears == null || Number.isNaN(Number(ageYears))) return null;
  const a = Number(ageYears);
  if (a <= 1) return "0-1";
  if (a <= 3) return "2-3";
  if (a <= 5) return "4-5";
  if (a <= 8) return "6-8";
  return "9-12";
}

// The bank. bands: the age bands the activity fits. loves: the
// interests it answers. freeplay fits everyone and loves
// nothing in particular, so a plan always exists.
export const BANK = [
  { id: "swim", bands: ["2-3", "4-5", "6-8", "9-12"], loves: ["water"] },
  { id: "waterplay", bands: ["0-1", "2-3"], loves: ["water"] },
  { id: "draw", bands: ["2-3", "4-5", "6-8"], loves: ["drawing"] },
  { id: "paint", bands: ["4-5", "6-8", "9-12"], loves: ["drawing"] },
  { id: "musicshake", bands: ["0-1", "2-3"], loves: ["music"] },
  { id: "singalong", bands: ["2-3", "4-5"], loves: ["music", "story"] },
  { id: "bandjam", bands: ["6-8", "9-12"], loves: ["music"] },
  { id: "parkpicnic", bands: ["2-3", "4-5", "6-8"], loves: ["park"] },
  { id: "pramwalk", bands: ["0-1", "2-3"], loves: ["park"] },
  { id: "ballgames", bands: ["6-8", "9-12"], loves: ["park", "sport"] },
  { id: "bakemuffins", bands: ["4-5", "6-8", "9-12"], loves: ["baking"] },
  { id: "bakebiscuits", bands: ["2-3", "4-5"], loves: ["baking"] },
  { id: "storyblanket", bands: ["0-1", "2-3"], loves: ["story"] },
  { id: "storyvoices", bands: ["4-5", "6-8"], loves: ["story"] },
  { id: "danceparty", bands: ["2-3", "4-5", "6-8"], loves: ["dancing", "music"] },
  { id: "babybounce", bands: ["0-1"], loves: ["dancing", "music"] },
  { id: "blocktowers", bands: ["0-1", "2-3"], loves: ["blocks"] },
  { id: "blockcity", bands: ["4-5", "6-8"], loves: ["blocks"] },
  { id: "blockquest", bands: ["9-12"], loves: ["blocks"] },
  { id: "farmanimals", bands: ["2-3", "4-5"], loves: ["animals"] },
  { id: "petcare", bands: ["4-5", "6-8", "9-12"], loves: ["animals"] },
  { id: "birdwatch", bands: ["6-8", "9-12"], loves: ["animals", "park"] },
  { id: "obstacle", bands: ["4-5", "6-8"], loves: ["sport", "park"] },
  { id: "softplay", bands: ["0-1", "2-3"], loves: ["sport"] },
  { id: "gardendig", bands: ["2-3", "4-5"], loves: ["park"] },
  { id: "freeplay", bands: ["0-1", "2-3", "4-5", "6-8", "9-12"], loves: [] },
];
export const BANK_BY_ID = Object.fromEntries(BANK.map((e) => [e.id, e]));

// Repair, never drops: an old child record without the new
// fields keeps working. Unknown loves fall away; a bad age
// becomes no age, never a lost record.
export function normaliseChild(kid) {
  const k = kid && typeof kid === "object" ? kid : {};
  const age = Number(k.ageYears);
  const ageYears = k.ageYears != null && Number.isInteger(age) && age >= 0 && age <= 12 ? age : null;
  const loves = Array.isArray(k.loves) ? [...new Set(k.loves.filter((l) => INTEREST_IDS.includes(l)))] : [];
  return { ...k, ageYears, loves };
}
export const repairChild = normaliseChild;

function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const childSig = (kids) => kids.map((k) => `${k.id || k.name || ""}:${k.ageYears ?? ""}:${[...(k.loves || [])].sort().join(",")}`).join("|");

function fitKids(entry, kids) {
  return kids.filter((k) => {
    const band = bandForAge(k.ageYears);
    return band === null || entry.bands.includes(band);
  });
}
function scoreOf(entry, fits) {
  let loved = 0;
  for (const k of fits) for (const l of entry.loves) if ((k.loves || []).includes(l)) loved += 1;
  return loved * 10 + fits.length;
}

export const SLOT_TIMES = ["09:00", "11:00", "15:30"];

function pickForSlot(kids, dateISO, slotIndex, avoidIds) {
  const cands = [];
  for (const entry of BANK) {
    const fits = fitKids(entry, kids);
    if (fits.length) cands.push({ entry, fits, score: scoreOf(entry, fits) });
  }
  if (!cands.length) return null;
  const fresh = cands.filter((c) => !avoidIds.has(c.entry.id));
  const pool = fresh.length ? fresh : cands;
  const max = Math.max(...pool.map((c) => c.score));
  const top = pool.filter((c) => c.score >= max - 10);
  const rand = mulberry32(hashText(`${dateISO}|${childSig(kids)}|slot${slotIndex}`));
  const ranked = top.map((c) => ({ c, r: rand() })).sort((a, b) => b.r - a.r);
  const pick = ranked[0].c;
  return { time: SLOT_TIMES[slotIndex], id: pick.entry.id, bands: pick.entry.bands, loves: pick.entry.loves, kids: pick.fits.map((k) => ({ id: k.id || "", name: k.name || "" })) };
}

// planDay(children, dateISO, avoidBySlot): three slots. The
// optional avoidBySlot (an array of Sets, one per slot) carries
// the previous day's picks from planWeek; a title is never
// repeated on consecutive days for the same slot where the
// bank allows a fresh one. Within a day, a title is not used
// twice where the bank allows.
export function planDay(children, dateISO, avoidBySlot) {
  const kids = (Array.isArray(children) ? children : []).map(normaliseChild);
  if (!kids.length || !dateISO) return [];
  const usedToday = new Set();
  const out = [];
  for (let s = 0; s < SLOT_TIMES.length; s += 1) {
    const avoid = new Set([...(avoidBySlot?.[s] || []), ...usedToday]);
    const slot = pickForSlot(kids, dateISO, s, avoid);
    if (slot) { usedToday.add(slot.id); out.push(slot); }
  }
  return out;
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
export function mondayOfISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Monday is 0
  return addDaysISO(iso, -dow);
}

// planWeek(children, mondayISO): seven days, Monday first.
// Each day: {date, slots:[...]} in the planDay shape.
export function planWeek(children, mondayISO) {
  if (!mondayISO) return [];
  const out = [];
  let prev = null;
  for (let d = 0; d < 7; d += 1) {
    const date = addDaysISO(mondayISO, d);
    const avoid = prev ? prev.map((s) => new Set([s.id])) : undefined;
    const slots = planDay(children, date, avoid);
    out.push({ date, slots });
    prev = slots;
  }
  return out;
}


// Communicate's optional learning plan. A band list is deliberately
// separate from the legacy planner above so existing day plans stay stable.
export const LEARNING_AGE_BANDS = [
  { id: "0-6m", key: "learning.age.0-6m" },
  { id: "6-12m", key: "learning.age.6-12m" },
  { id: "1-2y", key: "learning.age.1-2y" },
  { id: "2-3y", key: "learning.age.2-3y" },
  { id: "3-5y", key: "learning.age.3-5y" },
  { id: "5-8y", key: "learning.age.5-8y" },
  { id: "8-12y", key: "learning.age.8-12y" },
];
export const LEARNING_BAND_IDS = LEARNING_AGE_BANDS.map((band) => band.id);
export const LEARNING_AREAS = [
  "language", "movement", "music", "art", "nature", "numbers",
  "feelings", "early-reading", "independence", "sensory-play",
];
export const LEARNING_STYLES = [
  "montessori", "waldorf", "reggio-emilia", "play-based", "forest-school",
  "charlotte-mason", "traditional", "screen-light", "no-preference",
];
const uniqueKnown = (values, allowed) => Array.isArray(values)
  ? [...new Set(values.filter((value) => allowed.includes(value)))].slice(0, 20)
  : [];

// A whole-year age from the existing family profile can only suggest a
// conservative band. Zero maps to the youngest band; families can change it.
export function learningBandForAge(ageYears) {
  const age = Number(ageYears);
  if (!Number.isInteger(age) || age < 0 || age > 12) return "";
  if (age === 0) return "0-6m";
  if (age === 1) return "1-2y";
  if (age === 2) return "2-3y";
  if (age <= 4) return "3-5y";
  if (age <= 8) return "5-8y";
  return "8-12y";
}

// Child names and IDs never travel into the public profile or the shared
// pair plan: only age bands and optional learning preferences are kept.
export function normaliseLearningPlan(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const children = Array.isArray(source.children)
    ? source.children.map((child) => ({ band: LEARNING_BAND_IDS.includes(child?.band) ? child.band : "" })).slice(0, 20)
    : [];
  return {
    children,
    areas: uniqueKnown(source.areas, LEARNING_AREAS),
    styles: uniqueKnown(source.styles, LEARNING_STYLES),
    languages: Array.isArray(source.languages)
      ? [...new Set(source.languages.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()))].slice(0, 20)
      : [],
    otherLanguage: typeof source.otherLanguage === "string" ? source.otherLanguage.trim().slice(0, 60) : "",
    step: Number.isInteger(source.step) ? Math.max(0, Math.min(2, source.step)) : 0,
    setupComplete: source.setupComplete === true,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
  };
}
export const normalizeLearningPlan = normaliseLearningPlan;

export function publicLearningPlan(raw) {
  const plan = normaliseLearningPlan(raw);
  return {
    children: plan.children,
    areas: plan.areas,
    styles: plan.styles,
    languages: plan.languages,
    otherLanguage: plan.otherLanguage,
    step: plan.step,
    setupComplete: plan.setupComplete,
    updatedAt: plan.updatedAt,
  };
}


// Original, age-banded play ideas for Communicate. Every row is a
// short activity written for one band; no idea leaks into another band.
const learningIdea = (id, title, titleEs, howTo, howToEs, area, materialsHome, minutes, styles) => ({
  id, title, titleEs, howTo, howToEs, bands: [], areas: [area], styles,
  languagesFriendly: true, materialsHome, minutes,
});
const LEARNING_SAFETY = {
  "0-6m": "Always supervise. Use a clear floor space; keep toys and fabric away from the face and never leave baby on a raised surface.",
  "6-12m": "Always supervise. Use large, baby-safe objects only; remove anything that can fit in the mouth.",
  "1-2y": "Always supervise. No small parts, loose cords, or food-sized items; use only large, safe materials.",
  "2-3y": "Always supervise. Watch closely for choking hazards; avoid small loose parts and keep water within an adult's reach.",
  "3-5y": "Always supervise. Choose child-safe supplies; an adult handles heat, sharp tools, and water.",
  "5-8y": "Always supervise. Use age-safe materials; an adult handles heat, sharp tools, and outdoor safety.",
  "8-12y": "Always supervise. Use age-safe materials; an adult handles heat, blades, and unfamiliar outdoor areas.",
};
const LEARNING_IDEAS = {
  "0-6m": [
    learningIdea("baby-voice-pause", "Voice and pause", "Voz y pausa", "Say hello slowly, then pause for a look, sound, or smile.", "Saluda despacio y haz una pausa para ver una mirada, un sonido o una sonrisa.", "language", "Your voice", 3, ["montessori", "play-based"]),
    learningIdea("baby-name-room", "Name the room", "Nombra la habitación", "Name one familiar thing nearby, wait, then name the next thing.", "Nombra algo familiar cercano, espera y luego nombra lo siguiente.", "language", "Familiar room objects", 3, ["montessori", "waldorf"]),
    learningIdea("baby-bold-picture", "Look at a bold picture", "Mira una imagen sencilla", "Hold one high-contrast picture at a comfortable distance and move it slowly.", "Sostén una imagen de alto contraste a una distancia cómoda y muévela despacio.", "sensory-play", "A large black-and-white picture", 3, ["montessori", "traditional"]),
    learningIdea("baby-copy-face", "Copy a gentle face", "Imita una cara amable", "Make one gentle face, pause, and copy any look or sound baby makes.", "Haz una expresión amable, espera e imita cualquier mirada o sonido del bebé.", "feelings", "Your face", 3, ["waldorf", "play-based"]),
    learningIdea("baby-soft-touch", "Feel a soft cloth", "Toca una tela suave", "Let baby touch one large, clean cloth while lying safely on the floor.", "Deja que el bebé toque una tela grande y limpia mientras está seguro en el suelo.", "sensory-play", "A large clean cotton cloth", 3, ["montessori", "reggio-emilia"]),
    learningIdea("baby-bicycle-legs", "Slow leg stretches", "Estira las piernas despacio", "With baby on their back, gently bend and straighten each leg, then pause.", "Con el bebé boca arriba, flexiona y estira suavemente cada pierna y haz una pausa.", "movement", "A clear floor mat", 3, ["montessori", "play-based"]),
    learningIdea("baby-reach-scarf", "Reach for a scarf", "Alcanza una tela", "Hold a large scarf within reach; let baby touch it and keep it away from the face.", "Sostén una tela grande al alcance; deja que el bebé la toque y mantenla lejos de la cara.", "movement", "A large lightweight scarf", 3, ["waldorf", "play-based"]),
    learningIdea("baby-hum-hush", "Hum, then listen", "Tararea y escucha", "Hum a short tune softly, pause, and hum again when baby looks or moves.", "Tararea una melodía suave, espera y vuelve a tararear cuando el bebé mire o se mueva.", "music", "Your voice", 3, ["waldorf", "play-based"]),
    learningIdea("baby-clap-echo", "A quiet clap echo", "Un eco de palmas suave", "Clap softly once, wait, and answer with another soft clap or a smile.", "Da una palmada suave, espera y responde con otra palmada o una sonrisa.", "music", "Your hands", 2, ["play-based", "traditional"]),
    learningIdea("baby-window-weather", "Talk about the sky", "Habla del cielo", "Hold baby securely by a closed window and describe the light or clouds.", "Sostén al bebé junto a una ventana cerrada y describe la luz o las nubes.", "nature", "A closed window", 3, ["waldorf", "forest-school"]),
    learningIdea("baby-turn-taking", "Take turns talking", "Hablen por turnos", "Speak in a short, gentle turn, then leave quiet time for baby to answer.", "Habla un momento con suavidad y deja silencio para que el bebé responda.", "language", "Your voice", 3, ["montessori", "play-based"]),
    learningIdea("baby-tummy-look", "Tummy-time look", "Mira durante el tiempo boca abajo", "When baby is awake, place them on a clear mat and stay close at floor level.", "Cuando esté despierto, coloca al bebé en una alfombra despejada y quédate cerca en el suelo.", "movement", "A firm floor mat", 2, ["montessori", "play-based"]),
    learningIdea("baby-cloth-warm-cool", "Warm or cool cloth", "Tela tibia o fresca", "Touch a clean, comfortably warm or cool cloth to baby's hand and name the feeling.", "Toca la mano del bebé con una tela limpia, tibia o fresca, y nombra la sensación.", "sensory-play", "A clean damp cloth", 2, ["montessori", "reggio-emilia"]),
    learningIdea("baby-hand-shadow", "Hand shadow", "Sombra de la mano", "Move your hand slowly to make a soft shadow on a wall; keep the room light gentle.", "Mueve la mano despacio para crear una sombra suave en la pared y mantén una luz tenue.", "art", "A softly lit wall", 3, ["waldorf", "reggio-emilia"]),
    learningIdea("baby-rhythm-story", "A tiny rhythm story", "Un cuento con ritmo", "Read two short lines with a gentle rhythm, then pause and smile.", "Lee dos frases cortas con ritmo suave, haz una pausa y sonríe.", "early-reading", "A board book", 3, ["traditional", "waldorf"]),
    learningIdea("baby-side-reach", "Reach to one side", "Alcanza hacia un lado", "Place a large baby-safe toy beside baby on the mat and invite a slow reach.", "Coloca un juguete grande y seguro junto al bebé e invítalo a alcanzarlo despacio.", "movement", "A large baby-safe toy", 3, ["montessori", "play-based"]),
    learningIdea("baby-soft-sound", "Listen for a soft sound", "Escucha un sonido suave", "Make a quiet sound with your voice, pause, and notice baby's response.", "Haz un sonido suave con la voz, espera y observa la respuesta del bebé.", "music", "Your voice", 2, ["waldorf", "montessori"]),
    learningIdea("baby-cuddle-song", "Cuddle and sing", "Abraza y canta", "Hold baby securely, sing one familiar line, and follow their cues.", "Sostén al bebé con seguridad, canta una frase conocida y sigue sus señales.", "feelings", "Your voice", 3, ["waldorf", "play-based"]),
  ],
  "6-12m": [
    learningIdea("infant-peek-cloth", "Peekaboo with a cloth", "Cucú con una tela", "Show a large cloth, hide your face briefly, then smile; never cover baby's face.", "Muestra una tela grande, esconde tu cara un instante y sonríe; nunca cubras la cara del bebé.", "feelings", "A large light cloth", 4, ["play-based", "waldorf"]),
    learningIdea("infant-block-basket", "Fill and empty a basket", "Llena y vacía una cesta", "Offer a few large soft blocks and help baby place them in, then take them out.", "Ofrece bloques blandos grandes y ayuda al bebé a meterlos y sacarlos.", "independence", "Large soft blocks and a basket", 5, ["montessori", "play-based"]),
    learningIdea("infant-texture-pair", "Touch two textures", "Toca dos texturas", "Let baby feel a large towel, then a smooth wooden spoon held by you.", "Deja que el bebé toque una toalla grande y luego una cuchara lisa sostenida por ti.", "sensory-play", "Large towel and wooden spoon", 4, ["reggio-emilia", "montessori"]),
    learningIdea("infant-roll-ball", "Roll a soft ball", "Rueda una pelota blanda", "Sit close on the floor and roll a large soft ball slowly toward baby.", "Siéntate cerca en el suelo y rueda despacio una pelota grande y blanda hacia el bebé.", "movement", "A large soft ball", 4, ["play-based", "montessori"]),
    learningIdea("infant-cup-stack", "Stack two big cups", "Apila dos vasos grandes", "Stack two large nesting cups and let baby knock them down safely.", "Apila dos vasos encajables grandes y deja que el bebé los tire con seguridad.", "numbers", "Two large nesting cups", 4, ["montessori", "play-based"]),
    learningIdea("infant-babble-copy", "Copy a babble", "Imita un balbuceo", "Copy baby's sound, pause, and answer with one simple word.", "Imita el sonido del bebé, espera y responde con una palabra sencilla.", "language", "Your voice", 3, ["montessori", "play-based"]),
    learningIdea("infant-point-book", "Point to a picture", "Señala una imagen", "Point to one big picture in a board book and name it together.", "Señala una imagen grande en un libro de cartón y nómbrala juntos.", "early-reading", "A board book", 4, ["traditional", "montessori"]),
    learningIdea("infant-shaker-beat", "Shake a baby-safe rattle", "Agita un sonajero seguro", "Use a sealed, age-rated baby rattle and pause after each gentle shake.", "Usa un sonajero sellado y apropiado para bebés; haz una pausa tras cada movimiento suave.", "music", "A baby-safe rattle", 3, ["play-based", "waldorf"]),
    learningIdea("infant-mirror-wave", "Wave in the mirror", "Saluda al espejo", "Sit with baby at a baby-safe mirror and wave slowly together.", "Siéntate con el bebé ante un espejo seguro y saluden juntos despacio.", "feelings", "A fixed baby-safe mirror", 4, ["montessori", "play-based"]),
    learningIdea("infant-pillow-reach", "Reach over a flat cushion", "Alcanza sobre un cojín bajo", "Place a flat cushion on the floor and invite baby to reach for a large toy.", "Pon un cojín bajo en el suelo e invita al bebé a alcanzar un juguete grande.", "movement", "A flat cushion and large toy", 4, ["play-based", "montessori"]),
    learningIdea("infant-leaf-look", "Look at a big leaf", "Mira una hoja grande", "Hold a large leaf yourself and name its color and shape for baby.", "Sostén tú una hoja grande y describe su color y forma al bebé.", "nature", "One large leaf held by an adult", 4, ["forest-school", "reggio-emilia"]),
    learningIdea("infant-clap-song", "Clap to a song", "Aplaude con una canción", "Sing a short song and clap slowly for baby to watch or copy.", "Canta una canción corta y aplaude despacio para que el bebé mire o imite.", "music", "Your hands and voice", 4, ["waldorf", "play-based"]),
    learningIdea("infant-nose-game", "Where is your nose?", "¿Dónde está tu nariz?", "Name a familiar face part and gently point to your own first.", "Nombra una parte conocida de la cara y señálala primero en la tuya.", "language", "Your face", 3, ["montessori", "play-based"]),
    learningIdea("infant-doll-care", "Care for a soft doll", "Cuida un muñeco blando", "Show how to cuddle a large soft doll and invite baby to pat it.", "Muestra cómo abrazar un muñeco grande y blando e invita al bebé a acariciarlo.", "feelings", "A large soft doll", 4, ["waldorf", "play-based"]),
    learningIdea("infant-ring-stack", "Stack large rings", "Apila anillos grandes", "Help baby place one large, baby-safe ring over a wide post.", "Ayuda al bebé a poner un anillo grande y seguro sobre un poste ancho.", "movement", "Large baby-safe stacking rings", 5, ["montessori", "play-based"]),
    learningIdea("infant-house-sounds", "Listen to home sounds", "Escucha sonidos de casa", "Pause to notice a safe everyday sound, then name what made it.", "Haz una pausa para escuchar un sonido cotidiano seguro y nombra su origen.", "language", "Everyday room sounds", 3, ["montessori", "waldorf"]),
    learningIdea("infant-high-low", "High and low humming", "Tararea agudo y grave", "Hum one high note and one low note softly; watch baby's face and pause.", "Tararea una nota aguda y otra grave con suavidad; observa al bebé y espera.", "music", "Your voice", 3, ["play-based", "waldorf"]),
    learningIdea("infant-window-birds", "Watch birds from indoors", "Mira pájaros desde dentro", "Hold baby securely by a closed window and look for birds together.", "Sostén al bebé junto a una ventana cerrada y busquen pájaros juntos.", "nature", "A closed window", 4, ["forest-school", "waldorf"]),
  ],
  "1-2y": [
    learningIdea("toddler-sock-sort", "Pair the big socks", "Empareja los calcetines", "Put two large socks on the floor and help your child find the matching pair.", "Pon dos calcetines grandes en el suelo y ayuda a encontrar el par.", "independence", "Two large clean socks", 5, ["montessori", "play-based"]),
    learningIdea("toddler-block-tower", "Build a block tower", "Construye una torre", "Take turns adding large blocks, then celebrate when the tower tips.", "Añadan bloques grandes por turnos y celebren cuando caiga la torre.", "movement", "Large blocks", 5, ["play-based", "reggio-emilia"]),
    learningIdea("toddler-stop-go", "Walk, stop, go", "Camina, para, sigue", "Walk together in a clear room; say go and stop while staying beside your child.", "Caminen juntos por una habitación despejada; di sigue y para a su lado.", "movement", "A clear floor", 5, ["play-based", "traditional"]),
    learningIdea("toddler-big-brush", "Paint with water", "Pinta con agua", "Use a large brush and a tiny bowl of water on a washable outdoor surface.", "Usa una brocha grande y un cuenco pequeño de agua sobre una superficie lavable.", "art", "Large brush and a little water", 6, ["reggio-emilia", "montessori"]),
    learningIdea("toddler-pot-drum", "Tap a pot drum", "Toca un tambor de olla", "Offer a wooden spoon and a cool, stable pot; tap softly and copy each other.", "Ofrece una cuchara de madera y una olla fría y estable; den golpecitos suaves por turnos.", "music", "Wooden spoon and stable pot", 5, ["play-based", "waldorf"]),
    learningIdea("toddler-big-leaves", "Find two big leaves", "Busca dos hojas grandes", "On a short walk, point out two large leaves and compare their colors.", "En un paseo corto, señala dos hojas grandes y comparen sus colores.", "nature", "Two large leaves held by an adult", 7, ["forest-school", "reggio-emilia"]),
    learningIdea("toddler-animal-book", "Make an animal sound", "Imita un sonido animal", "Choose a big animal picture, name it, and make its sound together.", "Elige una imagen grande de un animal, nómbralo e imiten su sonido.", "early-reading", "A board book", 5, ["traditional", "play-based"]),
    learningIdea("toddler-jumbo-crayon", "Make jumbo crayon lines", "Traza líneas con una cera grande", "Offer one large, washable toddler crayon and draw together on a large sheet.", "Ofrece una cera lavable grande y dibujen juntos en una hoja grande.", "art", "Jumbo toddler crayon and paper", 6, ["reggio-emilia", "play-based"]),
    learningIdea("toddler-sock-colors", "Sort socks by color", "Ordena calcetines por color", "Place a few large socks in two color groups and name each color.", "Pon varios calcetines grandes en dos grupos de color y nómbralos.", "numbers", "Three large socks", 5, ["montessori", "traditional"]),
    learningIdea("toddler-toy-tidy", "Put toys in a basket", "Guarda juguetes en una cesta", "Show how to place one large toy in a basket, then let your child try.", "Muestra cómo poner un juguete grande en una cesta y deja que lo intente.", "independence", "Large toys and a basket", 5, ["montessori", "play-based"]),
    learningIdea("toddler-more-stop", "Ask for more or stop", "Pide más o di basta", "During play, model the words more and stop and wait for your child's cue.", "Durante el juego, modela las palabras más y basta y espera una señal.", "language", "A favorite toy", 4, ["montessori", "play-based"]),
    learningIdea("toddler-pillow-path", "Step over a low pillow", "Pasa sobre un cojín bajo", "Place one flat cushion on the floor and hold hands while stepping over it.", "Pon un cojín plano en el suelo y den la mano al pasar por encima.", "movement", "One flat floor cushion", 5, ["play-based", "waldorf"]),
    learningIdea("toddler-mirror-feelings", "Show a happy face", "Muestra una cara alegre", "Look in a fixed mirror and name a feeling while making a gentle face.", "Mírense en un espejo fijo y nombra una emoción con una expresión amable.", "feelings", "A fixed mirror", 4, ["montessori", "play-based"]),
    learningIdea("toddler-count-cups", "Count two cups", "Cuenta dos vasos", "Set out two large cups and count them slowly together.", "Pon dos vasos grandes y cuéntenlos despacio juntos.", "numbers", "Two large cups", 4, ["montessori", "traditional"]),
    learningIdea("toddler-leaf-wipe", "Wipe a plant leaf", "Limpia una hoja de planta", "Hold a damp cloth and help wipe one sturdy plant leaf together.", "Sostén un paño húmedo y limpien juntos una hoja resistente.", "nature", "Damp cloth and a sturdy plant", 5, ["montessori", "forest-school"]),
    learningIdea("toddler-pretend-shop", "Pretend to shop", "Juega a la tienda", "Take turns choosing large safe household items and naming each one.", "Elijan por turnos objetos grandes y seguros de casa y nombren cada uno.", "language", "Large household items", 6, ["play-based", "waldorf"]),
    learningIdea("toddler-freeze-dance", "Dance and freeze", "Baila y quédate quieto", "Play a short song, dance together, and pause the music to freeze.", "Pon una canción corta, bailen juntos y pausen para quedarse quietos.", "music", "A short song", 5, ["play-based", "waldorf"]),
    learningIdea("toddler-soft-scarf", "Wave a soft scarf", "Mueve una tela suave", "Wave a large scarf slowly and invite your child to copy the movement.", "Mueve despacio una tela grande e invita a imitar el movimiento.", "sensory-play", "A large soft scarf", 4, ["waldorf", "play-based"]),
  ],
  "2-3y": [
    learningIdea("preschool-color-hunt", "Find a color at home", "Busca un color en casa", "Choose one color and find three large objects that match it.", "Elige un color y busquen tres objetos grandes que lo tengan.", "numbers", "Large household objects", 7, ["montessori", "play-based"]),
    learningIdea("preschool-play-shop", "Set up a pretend shop", "Prepara una tienda de juego", "Arrange a few large safe items and take turns asking for one by name.", "Coloca objetos grandes y seguros y pidan uno por su nombre por turnos.", "language", "Large safe household items", 8, ["play-based", "waldorf"]),
    learningIdea("preschool-shape-walk", "Spot a round shape", "Encuentra una forma redonda", "Look around one room for round objects and trace their shape in the air.", "Busquen objetos redondos en una habitación y dibujen su forma en el aire.", "numbers", "Room objects", 6, ["montessori", "traditional"]),
    learningIdea("preschool-story-order", "Tell a three-part story", "Cuenta una historia en tres partes", "Talk about what happened first, next, and last in a familiar story.", "Hablen de lo que pasó primero, después y al final de un cuento conocido.", "early-reading", "A familiar story", 7, ["traditional", "charlotte-mason"]),
    learningIdea("preschool-nature-listen", "Listen for two outdoor sounds", "Escucha dos sonidos de fuera", "Stand with an adult in a safe outdoor spot and name two sounds you hear.", "Quédate con un adulto en un lugar exterior seguro y nombra dos sonidos.", "nature", "A safe outdoor spot", 8, ["forest-school", "waldorf"]),
    learningIdea("preschool-plant-water", "Water a sturdy plant", "Riega una planta resistente", "Use a small cup with an adult and pour a little water onto a plant.", "Usa un vaso pequeño con un adulto y echa un poco de agua a una planta.", "independence", "Small cup and sturdy plant", 6, ["montessori", "forest-school"]),
    learningIdea("preschool-big-puzzle", "Finish a big-piece puzzle", "Completa un puzle de piezas grandes", "Choose a puzzle with large pieces and fit them together with a grown-up.", "Elige un puzle de piezas grandes y encájenlas con una persona adulta.", "numbers", "Large-piece puzzle", 8, ["montessori", "traditional"]),
    learningIdea("preschool-stop-song", "Make a stop-and-go song", "Crea una canción de parar y seguir", "Sing a simple tune and pause on a signal, then start again together.", "Canten una melodía sencilla, hagan una señal para parar y luego sigan.", "music", "Your voice", 6, ["play-based", "waldorf"]),
    learningIdea("preschool-feeling-pictures", "Match a feeling to a face", "Relaciona una emoción con una cara", "Draw two large simple faces and name how each one might feel.", "Dibuja dos caras sencillas y grandes y nombren cómo podrían sentirse.", "feelings", "Paper and large crayons", 8, ["reggio-emilia", "play-based"]),
    learningIdea("preschool-paper-collage", "Make a paper collage", "Haz un collage de papel", "Tear large paper pieces by hand and arrange them on a sheet with glue stick.", "Rompe trozos grandes de papel y pégalos en una hoja con barra adhesiva.", "art", "Large paper pieces and glue stick", 10, ["reggio-emilia", "play-based"]),
    learningIdea("preschool-step-count", "Count your steps", "Cuenta tus pasos", "Walk a short clear path and count each step out loud together.", "Caminen por un trayecto corto y despejado y cuenten los pasos en voz alta.", "numbers", "A clear path", 6, ["montessori", "play-based"]),
    learningIdea("preschool-sock-puppet", "Tell a sock puppet story", "Cuenta un cuento con un calcetín", "Use a clean sock as a puppet and take turns giving it a simple voice.", "Usa un calcetín limpio como títere y denle una voz sencilla por turnos.", "language", "One clean sock", 8, ["waldorf", "play-based"]),
    learningIdea("preschool-block-bridge", "Build a block bridge", "Construye un puente de bloques", "Place large blocks in two rows and bridge them with one wide block.", "Pon bloques grandes en dos filas y únelos con un bloque ancho.", "movement", "Large blocks", 8, ["montessori", "reggio-emilia"]),
    learningIdea("preschool-open-close", "Practice open and close", "Practica abrir y cerrar", "Choose a safe box with a simple lid and practice opening and closing it.", "Elige una caja segura con tapa sencilla y practiquen abrirla y cerrarla.", "independence", "A light safe box", 5, ["montessori", "traditional"]),
    learningIdea("preschool-before-after", "Put two steps in order", "Ordena dos pasos", "Talk through a familiar routine and say what comes before and after.", "Hablen de una rutina conocida y digan qué va antes y después.", "language", "A familiar routine", 6, ["charlotte-mason", "traditional"]),
    learningIdea("preschool-garden-find", "Find a large garden color", "Busca un color en el jardín", "With an adult, find one large natural item of a chosen color and leave it there.", "Con un adulto, encuentra algo natural grande del color elegido y déjalo en su sitio.", "nature", "A safe garden or park", 10, ["forest-school", "reggio-emilia"]),
    learningIdea("preschool-quiet-book", "Read a quiet picture book", "Lee un cuento ilustrado tranquilo", "Let your child choose a picture and tell you what they notice.", "Deja que elija una imagen y te cuente lo que observa.", "early-reading", "A picture book", 8, ["charlotte-mason", "traditional"]),
    learningIdea("preschool-breathing-feather", "Watch a feather float", "Mira flotar una pluma", "An adult holds a large clean feather and lets it drift slowly while you watch.", "Una persona adulta sostiene una pluma grande y limpia y la deja caer despacio.", "sensory-play", "A large clean feather held by an adult", 5, ["waldorf", "play-based"]),
  ],
  "3-5y": [
    learningIdea("early-years-name-letter", "Find the first letter", "Busca la primera letra", "Look for the first letter of your child's name on a book cover or label.", "Busquen la primera letra de su nombre en un libro o etiqueta.", "early-reading", "A book or large label", 8, ["montessori", "traditional"]),
    learningIdea("early-years-pattern-beads", "Make a big-object pattern", "Crea un patrón con objetos grandes", "Line up large blocks in two colors and continue the pattern together.", "Alinea bloques grandes de dos colores y continúen el patrón juntos.", "numbers", "Large colored blocks", 8, ["montessori", "traditional"]),
    learningIdea("early-years-shadow-draw", "Draw a shadow shape", "Dibuja la forma de una sombra", "Trace a large toy's shadow on paper, then color the outline.", "Repasa en papel la sombra de un juguete grande y colorea el contorno.", "art", "Large toy, paper, crayons", 10, ["reggio-emilia", "play-based"]),
    learningIdea("early-years-recipe-mix", "Mix a simple snack", "Mezcla un tentempié sencillo", "With an adult, stir soft ingredients in a bowl; an adult handles any cutting.", "Con una persona adulta, mezcla ingredientes blandos en un bol; esa persona corta.", "independence", "Bowl and soft snack ingredients", 12, ["montessori", "traditional"]),
    learningIdea("early-years-cloud-shapes", "Look for cloud shapes", "Busca formas en las nubes", "From a safe place with an adult, notice cloud shapes and describe them.", "Desde un lugar seguro con un adulto, observen las nubes y describan sus formas.", "nature", "A safe outdoor spot", 10, ["forest-school", "waldorf"]),
    learningIdea("early-years-emotion-puppet", "Give a puppet a feeling", "Dale una emoción a un títere", "Use a soft puppet to act out a feeling and talk about what might help.", "Usa un títere blando para representar una emoción y hablar de qué ayuda.", "feelings", "A soft puppet", 10, ["waldorf", "play-based"]),
    learningIdea("early-years-letter-sound", "Listen for a starting sound", "Escucha el sonido inicial", "Say a familiar word slowly and notice the sound it starts with.", "Di una palabra conocida despacio y escucha con qué sonido empieza.", "early-reading", "Your voice", 7, ["traditional", "charlotte-mason"]),
    learningIdea("early-years-leaf-rubbing", "Make a leaf rubbing", "Frota una hoja en papel", "Place a large leaf under paper and rub gently with a crayon.", "Pon una hoja grande bajo el papel y frota suavemente con una cera.", "art", "Large leaf, paper, crayon", 10, ["reggio-emilia", "forest-school"]),
    learningIdea("early-years-number-hop", "Hop to a number", "Salta hasta un número", "Write a few large numbers on paper and hop to the one you name.", "Escribe números grandes en papel y salta hasta el que nombres.", "movement", "Paper and crayons", 8, ["play-based", "traditional"]),
    learningIdea("early-years-song-instrument", "Make a home instrument", "Crea un instrumento casero", "Tap a wooden spoon gently on a stable pot and make a steady beat.", "Da golpecitos suaves con una cuchara de madera en una olla estable y crea un ritmo.", "music", "Wooden spoon and stable pot", 8, ["play-based", "reggio-emilia"]),
    learningIdea("early-years-garden-journal", "Draw one garden detail", "Dibuja un detalle del jardín", "Look closely at a plant with an adult and draw one detail you notice.", "Observa una planta con un adulto y dibuja un detalle que notes.", "nature", "Paper and crayons", 12, ["forest-school", "charlotte-mason"]),
    learningIdea("early-years-tidy-timer", "Tidy one small area", "Ordena un espacio pequeño", "Choose one shelf or basket and put each large item back in its place.", "Elige una balda o cesta y devuelve cada objeto grande a su lugar.", "independence", "A low shelf or basket", 8, ["montessori", "traditional"]),
    learningIdea("early-years-shape-hunt", "Build a shape hunt", "Busca formas", "Find one square, one circle, and one triangle in safe household objects.", "Encuentra un cuadrado, un círculo y un triángulo en objetos seguros de casa.", "numbers", "Safe household objects", 10, ["montessori", "play-based"]),
    learningIdea("early-years-story-ending", "Invent a new story ending", "Inventa otro final", "Read a familiar story and imagine one kind new ending together.", "Lean un cuento conocido e imaginen juntos un final amable diferente.", "early-reading", "A familiar storybook", 10, ["charlotte-mason", "waldorf"]),
    learningIdea("early-years-feeling-weather", "Match a feeling to weather", "Relaciona una emoción con el clima", "Ask which kind of weather matches a feeling and why.", "Pregunta qué clima se parece a una emoción y por qué.", "feelings", "A window or weather picture", 8, ["waldorf", "play-based"]),
    learningIdea("early-years-watercolor-wash", "Paint a color wash", "Pinta una mancha de color", "Use child-safe watercolor and a broad brush to paint one big color area.", "Usa acuarela infantil y una brocha ancha para pintar una zona grande de color.", "art", "Child-safe watercolor and broad brush", 12, ["reggio-emilia", "play-based"]),
    learningIdea("early-years-balance-line", "Walk a floor line", "Camina sobre una línea", "Place a strip of tape on the floor and walk along it with an adult nearby.", "Pon una cinta en el suelo y camina por la línea con un adulto cerca.", "movement", "Painter's tape", 8, ["play-based", "montessori"]),
    learningIdea("early-years-table-helper", "Set a simple place", "Prepara un puesto sencillo", "Set a napkin and a large spoon at one place, then check the arrangement.", "Pon una servilleta y una cuchara grande en un puesto y revisen cómo quedó.", "independence", "Napkin and large spoon", 7, ["montessori", "traditional"]),
  ],
  "5-8y": [
    learningIdea("school-age-word-hunt", "Find words that start alike", "Busca palabras que empiezan igual", "Choose a sound and find three familiar words that begin with it.", "Elige un sonido y busca tres palabras conocidas que empiecen igual.", "early-reading", "Books or room labels", 10, ["traditional", "charlotte-mason"]),
    learningIdea("school-age-number-shop", "Plan a pretend shop", "Planea una tienda imaginaria", "Give a few safe items pretend prices and add the cost of two together.", "Pon precios imaginarios a objetos seguros y suma el coste de dos.", "numbers", "Household items and paper", 12, ["play-based", "montessori"]),
    learningIdea("school-age-paper-bridge", "Build a paper bridge", "Construye un puente de papel", "Fold paper into a bridge and see how many large blocks it can hold.", "Dobla papel para hacer un puente y comprueba cuántos bloques grandes soporta.", "movement", "Paper and large blocks", 15, ["reggio-emilia", "play-based"]),
    learningIdea("school-age-still-life", "Draw a home still life", "Dibuja objetos de casa", "Arrange three safe objects and draw their shapes and shadows.", "Coloca tres objetos seguros y dibuja sus formas y sombras.", "art", "Paper, crayons, three objects", 15, ["reggio-emilia", "charlotte-mason"]),
    learningIdea("school-age-leaf-sort", "Sort leaves by shape", "Ordena hojas por forma", "With an adult, compare fallen leaves and group them by shape, then return them.", "Con un adulto, compara hojas caídas, agrúpalas por forma y devuélvelas.", "nature", "Fallen leaves", 15, ["forest-school", "montessori"]),
    learningIdea("school-age-mood-map", "Make a feelings map", "Crea un mapa de emociones", "Draw a simple map of places that help you feel calm, safe, or cheerful.", "Dibuja un mapa sencillo de lugares que te hacen sentir calma, seguridad o alegría.", "feelings", "Paper and pencils", 12, ["reggio-emilia", "play-based"]),
    learningIdea("school-age-read-aloud", "Take turns reading", "Lean por turnos", "Read a page each and pause to predict what might happen next.", "Lean una página cada uno y hagan una pausa para imaginar qué pasará.", "early-reading", "A chosen book", 15, ["traditional", "charlotte-mason"]),
    learningIdea("school-age-watercolor-weather", "Paint today's weather", "Pinta el clima de hoy", "Choose colors that match today's weather and paint a small scene.", "Elige colores que representen el clima de hoy y pinta una escena.", "art", "Paper and child-safe paints", 15, ["reggio-emilia", "play-based"]),
    learningIdea("school-age-multiplication-move", "Make a movement times table", "Crea una tabla con movimientos", "Pick a number and do a safe movement that many times while counting.", "Elige un número y repite un movimiento seguro esa cantidad mientras cuentas.", "movement", "Clear floor space", 10, ["play-based", "traditional"]),
    learningIdea("school-age-rhythm-code", "Create a rhythm code", "Crea un código de ritmo", "Make a short pattern with claps and ask someone to copy it.", "Crea un patrón corto con palmas y pide a alguien que lo imite.", "music", "Your hands", 10, ["play-based", "waldorf"]),
    learningIdea("school-age-bird-notes", "Keep a bird note", "Anota un pájaro", "Watch birds from a safe place and sketch one shape or sound you notice.", "Observa aves desde un lugar seguro y dibuja una forma o sonido que notes.", "nature", "Paper and pencils", 15, ["forest-school", "charlotte-mason"]),
    learningIdea("school-age-snack-helper", "Prepare a no-heat snack", "Prepara un tentempié sin calor", "With an adult, assemble a simple snack using ready-to-eat soft ingredients.", "Con un adulto, prepara un tentempié sencillo con ingredientes blandos listos.", "independence", "Plate and soft ready-to-eat ingredients", 12, ["montessori", "traditional"]),
    learningIdea("school-age-story-comic", "Draw a three-frame comic", "Dibuja un cómic de tres cuadros", "Tell a short story with a beginning, middle, and end in three boxes.", "Cuenta una historia breve con inicio, medio y final en tres cuadros.", "early-reading", "Paper and pencils", 15, ["reggio-emilia", "play-based"]),
    learningIdea("school-age-measure-room", "Measure with footsteps", "Mide con pasos", "Measure a short clear space with footsteps and compare the numbers.", "Mide un espacio despejado con pasos y compara los números.", "numbers", "Clear floor space", 10, ["montessori", "play-based"]),
    learningIdea("school-age-kindness-notes", "Write a kind note", "Escribe una nota amable", "Write or draw a kind message for someone in your household.", "Escribe o dibuja un mensaje amable para alguien de casa.", "feelings", "Paper and pencils", 10, ["charlotte-mason", "traditional"]),
    learningIdea("school-age-reuse-sculpture", "Build a reused sculpture", "Crea una escultura reutilizada", "Join clean large cardboard pieces with paper tape to make a simple sculpture.", "Une piezas grandes de cartón limpio con cinta de papel para crear una escultura.", "art", "Clean cardboard and paper tape", 15, ["reggio-emilia", "play-based"]),
    learningIdea("school-age-plant-check", "Check a plant's needs", "Revisa qué necesita una planta", "Look at a sturdy plant and decide with an adult if its soil feels dry.", "Observa una planta resistente y decide con un adulto si la tierra está seca.", "nature", "A sturdy plant", 8, ["montessori", "forest-school"]),
    learningIdea("school-age-week-helper", "Plan one helpful job", "Planea una tarea útil", "Choose one small household job and make a three-step plan to do it.", "Elige una tarea pequeña de casa y prepara un plan de tres pasos.", "independence", "Paper and pencil", 12, ["montessori", "traditional"]),
  ],
  "8-12y": [
    learningIdea("preteen-word-roots", "Explore a word's roots", "Explora el origen de una palabra", "Choose a familiar word, look it up in a child-safe dictionary, and note its parts.", "Elige una palabra conocida, búscala en un diccionario infantil y anota sus partes.", "early-reading", "A child-safe dictionary", 15, ["traditional", "charlotte-mason"]),
    learningIdea("preteen-budget-game", "Plan a small pretend budget", "Planea un presupuesto imaginario", "Give pretend prices to three household items and work out a total and change.", "Pon precios imaginarios a tres objetos y calcula el total y el cambio.", "numbers", "Paper, pencil, household items", 15, ["montessori", "traditional"]),
    learningIdea("preteen-tower-challenge", "Build a freestanding tower", "Construye una torre estable", "Use paper and tape to build a tower that stands on its own for ten seconds.", "Usa papel y cinta para crear una torre que se mantenga diez segundos.", "movement", "Paper and painter's tape", 20, ["reggio-emilia", "play-based"]),
    learningIdea("preteen-observation-sketch", "Sketch a small detail", "Dibuja un detalle pequeño", "Observe one safe household object closely and sketch its texture and shape.", "Observa de cerca un objeto seguro de casa y dibuja su textura y forma.", "art", "Paper and pencils", 15, ["reggio-emilia", "charlotte-mason"]),
    learningIdea("preteen-backyard-biodiversity", "Map a tiny habitat", "Mapea un pequeño hábitat", "With an adult, map a safe outdoor patch and note plants or insects from a distance.", "Con un adulto, dibuja un lugar exterior seguro y anota plantas o insectos a distancia.", "nature", "Paper and pencil", 20, ["forest-school", "reggio-emilia"]),
    learningIdea("preteen-feeling-scale", "Make a feeling scale", "Crea una escala de emociones", "Draw a simple scale from calm to excited and name what helps at each point.", "Dibuja una escala de calma a entusiasmo y nombra qué ayuda en cada punto.", "feelings", "Paper and colored pencils", 15, ["montessori", "play-based"]),
    learningIdea("preteen-book-review", "Record a book recommendation", "Graba una recomendación de libro", "Give a one-minute recommendation for a book and say who might enjoy it.", "Haz una recomendación de un minuto y di quién podría disfrutar el libro.", "early-reading", "A book and paper", 12, ["charlotte-mason", "traditional"]),
    learningIdea("preteen-color-study", "Paint a limited-color scene", "Pinta una escena con pocos colores", "Paint a small scene using only three colors and describe your choices.", "Pinta una escena pequeña con solo tres colores y explica tus elecciones.", "art", "Paper and child-safe paints", 20, ["reggio-emilia", "play-based"]),
    learningIdea("preteen-movement-sequence", "Create a safe movement sequence", "Crea una secuencia de movimientos", "Make a short sequence of four gentle movements and teach it to someone.", "Crea una secuencia breve de cuatro movimientos suaves y enséñala.", "movement", "Clear floor space", 12, ["play-based", "traditional"]),
    learningIdea("preteen-soundscape", "Compose a home soundscape", "Compón un paisaje sonoro", "Use quiet household sounds to make a short pattern, then repeat it.", "Usa sonidos suaves de casa para crear un patrón breve y repítelo.", "music", "Safe everyday sounds", 15, ["play-based", "reggio-emilia"]),
    learningIdea("preteen-weather-log", "Keep a weather log", "Lleva un registro del clima", "Observe weather from indoors and record the clouds, light, and temperature feeling.", "Observa el clima desde dentro y anota nubes, luz y sensación de temperatura.", "nature", "Window, paper, pencil", 10, ["forest-school", "charlotte-mason"]),
    learningIdea("preteen-simple-snack-plan", "Plan a no-heat snack", "Planea un tentempié sin calor", "Choose a simple snack with an adult, list the steps, and assemble it together.", "Elige un tentempié sencillo con un adulto, anota los pasos y prepárenlo juntos.", "independence", "Paper, plate, ready-to-eat ingredients", 18, ["montessori", "traditional"]),
    learningIdea("preteen-poem-postcard", "Write a tiny nature poem", "Escribe un poema breve de naturaleza", "Write four lines about a safe outdoor view, using one sound and one color.", "Escribe cuatro versos sobre una vista exterior segura con un sonido y un color.", "early-reading", "Paper and pencil", 15, ["charlotte-mason", "waldorf"]),
    learningIdea("preteen-scale-map", "Draw a room map", "Dibuja un mapa de una habitación", "Sketch a room from above and mark where three objects sit.", "Dibuja una habitación desde arriba y marca dónde están tres objetos.", "numbers", "Paper and ruler", 15, ["montessori", "traditional"]),
    learningIdea("preteen-kindness-plan", "Plan a kind action", "Planea un gesto amable", "Think of one helpful action for someone and plan when and how to do it.", "Piensa en una ayuda para alguien y planea cuándo y cómo hacerla.", "feelings", "Paper and pencil", 12, ["play-based", "charlotte-mason"]),
    learningIdea("preteen-reuse-design", "Design a useful reused object", "Diseña un objeto útil reutilizado", "Sketch a useful object from clean packaging before building it with an adult.", "Dibuja un objeto útil con envases limpios antes de construirlo con un adulto.", "art", "Clean packaging and paper tape", 20, ["reggio-emilia", "montessori"]),
    learningIdea("preteen-plant-growth-check", "Track plant growth", "Sigue el crecimiento de una planta", "Measure a sturdy plant with an adult and record the date and height.", "Mide una planta resistente con un adulto y anota la fecha y altura.", "nature", "Plant, ruler, notebook", 10, ["forest-school", "traditional"]),
    learningIdea("preteen-week-task-plan", "Plan a household task", "Planea una tarea de casa", "Break one safe household task into steps and check them off together.", "Divide una tarea segura de casa en pasos y márquenlos juntos.", "independence", "Paper and pencil", 15, ["montessori", "traditional"]),
  ],
};

export const LEARNING_ACTIVITY_BANK = Object.freeze(Object.entries(LEARNING_IDEAS).flatMap(([band, ideas]) =>
  ideas.map((item) => Object.freeze({ ...item, bands: [band], safety: LEARNING_SAFETY[band] }))
));
export const LEARNING_ACTIVITY_BY_ID = Object.fromEntries(LEARNING_ACTIVITY_BANK.map((item) => [item.id, item]));

export function learningActivitySafety(band) { return LEARNING_SAFETY[band] || "Always supervise and use age-safe materials."; }

export function suggestLearningActivities(rawPlan, offset = 0, count = 4) {
  const plan = normaliseLearningPlan(rawPlan);
  const ages = new Set(plan.children.map((child) => child.band).filter(Boolean));
  if (!ages.size) return [];
  const candidates = LEARNING_ACTIVITY_BANK.filter((activity) => activity.bands.some((band) => ages.has(band)))
    .map((activity) => ({ activity, score: activity.areas.filter((area) => plan.areas.includes(area)).length * 3 + activity.styles.filter((style) => plan.styles.includes(style)).length * 2 }))
    .sort((a, b) => b.score - a.score || a.activity.id.localeCompare(b.activity.id))
    .map((entry) => entry.activity);
  if (!candidates.length) return [];
  const size = Math.max(3, Math.min(5, Number.isInteger(count) ? count : 4));
  const start = Math.abs(Math.trunc(Number(offset) || 0)) % candidates.length;
  const out = [];
  for (let i = 0; i < Math.min(size, candidates.length); i += 1) out.push(candidates[(start + i) % candidates.length]);
  return out;
}

const VOCABULARY = {
  Spanish: [["hello", "hola"], ["more", "más"], ["thank you", "gracias"]],
  Arabic: [["hello", "مرحبًا"], ["more", "أكثر"], ["thank you", "شكرًا"]],
  French: [["hello", "bonjour"], ["more", "encore"], ["thank you", "merci"]],
  Italian: [["hello", "ciao"], ["more", "ancora"], ["thank you", "grazie"]],
  Mandarin: [["hello", "你好"], ["more", "更多"], ["thank you", "谢谢"]],
  Hindi: [["hello", "नमस्ते"], ["more", "और"], ["thank you", "धन्यवाद"]],
  Vietnamese: [["hello", "xin chào"], ["more", "thêm"], ["thank you", "cảm ơn"]],
  Tagalog: [["hello", "kumusta"], ["more", "dagdag pa"], ["thank you", "salamat"]],
  Greek: [["hello", "γεια"], ["more", "κι άλλο"], ["thank you", "ευχαριστώ"]],
};
export function learningVocabulary(language) { return VOCABULARY[language] ? [...VOCABULARY[language]] : []; }
