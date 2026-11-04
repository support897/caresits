export type ActivityVariant = { title: string; steps: string[]; learningGoal: string };
export type Activity = {
  id: string;
  title: string;
  minAge: number;
  maxAge: number;
  minutes: number;
  interests: string[];
  materials: string[];
  steps: string[];
  learningGoal: string;
  simpler: ActivityVariant;
  moreKids: ActivityVariant;
  spanish: ActivityVariant & { materials: string[] };
};

export const ACTIVITIES: Activity[] = [
  {
    id: "mirror-hello", title: "Mirror hello", minAge: 0, maxAge: 1, minutes: 8, interests: ["senses", "people", "language"], materials: ["large baby-safe mirror", "soft mat"],
    steps: ["Place the secured mirror beside the baby during awake floor time.", "Make a gentle face, pause, and name what you see together."], learningGoal: "Shared attention, early communication, and visual tracking.",
    simpler: { title: "One face at a time", steps: ["Hold the baby safely and let them look at your face.", "Pause when they look away."], learningGoal: "Comfort and shared attention." },
    moreKids: { title: "Grown-up and baby turns", steps: ["One adult sits beside each baby.", "Take turns making a gentle expression for each baby to notice."], learningGoal: "Social attention with calm, supported turns." },
    spanish: { title: "Hola, espejo", materials: ["espejo grande y seguro para bebés", "manta suave"], steps: ["Coloca el espejo bien sujeto junto al bebé durante su tiempo despierto en el suelo.", "Haz una expresión suave, espera y nombra juntos lo que ven."], learningGoal: "Atención compartida, comunicación temprana y seguimiento visual." },
  },
  {
    id: "soft-texture-trail", title: "Soft texture trail", minAge: 0, maxAge: 2, minutes: 10, interests: ["senses", "nature", "curiosity"], materials: ["large clean fabric squares", "basket"],
    steps: ["Lay out two or three large, washable fabric pieces within reach.", "Name each texture as the child touches it; watch closely and keep fabric away from the face."], learningGoal: "Sensory exploration, attention, and new describing words.",
    simpler: { title: "One soft square", steps: ["Offer one large fabric square while the child is awake and supervised.", "Describe it with one word, such as soft."], learningGoal: "Touch and listening." },
    moreKids: { title: "Texture turn-taking", steps: ["Give each child a separate fabric square.", "Invite each child to choose one describing word."], learningGoal: "Sensory language and taking turns." },
    spanish: { title: "Camino de texturas suaves", materials: ["trozos grandes de tela limpia", "cesta"], steps: ["Coloca dos o tres telas grandes y lavables al alcance.", "Nombra cada textura mientras el niño la toca; supervísalo de cerca y mantén la tela lejos de la cara."], learningGoal: "Exploración sensorial, atención y nuevas palabras descriptivas." },
  },
  {
    id: "scoop-and-pour", title: "Scoop and pour", minAge: 1, maxAge: 3, minutes: 12, interests: ["water", "movement", "science"], materials: ["shallow water tray", "large cups", "towel"],
    steps: ["Set a shallow tray on a non-slip surface and add a little water.", "Show how to pour between large cups; stay within arm’s reach and empty the tray after play."], learningGoal: "Cause and effect, coordination, and early measuring words.",
    simpler: { title: "Pour with one cup", steps: ["Offer one large cup and a small amount of water.", "Help the child tip it into the tray."], learningGoal: "Hand control and cause and effect." },
    moreKids: { title: "Cup relay", steps: ["Give each child a large cup at their own station.", "Take turns pouring into one shared tray with an adult nearby."], learningGoal: "Turn-taking and comparing amounts." },
    spanish: { title: "Recoger y verter", materials: ["bandeja poco profunda con agua", "vasos grandes", "toalla"], steps: ["Coloca la bandeja sobre una superficie antideslizante y añade poca agua.", "Muestra cómo verter entre vasos grandes; quédate al alcance y vacía la bandeja al terminar."], learningGoal: "Causa y efecto, coordinación y primeras palabras para medir." },
  },
  {
    id: "colour-window-hunt", title: "Colour window hunt", minAge: 1, maxAge: 4, minutes: 12, interests: ["colour", "nature", "language"], materials: ["large colour cards", "window"],
    steps: ["Choose two large colour cards and sit together at a safe window.", "Look for matching colours outside and name what you notice."], learningGoal: "Colour words, observation, and shared attention.",
    simpler: { title: "Find one colour", steps: ["Pick one colour card.", "Point to one matching object together."], learningGoal: "Noticing and naming." },
    moreKids: { title: "Colour spotters", steps: ["Give each child a different colour card.", "Take turns pointing out a matching view."], learningGoal: "Colour recognition and listening to others." },
    spanish: { title: "Busca colores en la ventana", materials: ["tarjetas grandes de colores", "ventana"], steps: ["Elige dos tarjetas grandes y siéntense juntos junto a una ventana segura.", "Busquen colores parecidos afuera y nombren lo que ven."], learningGoal: "Palabras de colores, observación y atención compartida." },
  },
  {
    id: "shape-path", title: "Shape path", minAge: 2, maxAge: 4, minutes: 15, interests: ["movement", "maths", "shapes"], materials: ["paper shapes", "floor space"],
    steps: ["Place large paper shapes on a clear floor with no trip hazards.", "Invite the child to step, reach, or point to a shape you name."], learningGoal: "Shape recognition, listening, and body movement.",
    simpler: { title: "Point to a shape", steps: ["Place two large shapes within view.", "Name one and invite the child to point."], learningGoal: "Early shape words and attention." },
    moreKids: { title: "Shape turn", steps: ["Give each child a turn to choose a shape.", "Move together to the chosen shape without racing."], learningGoal: "Shared play and shape vocabulary." },
    spanish: { title: "Camino de figuras", materials: ["figuras grandes de papel", "espacio libre en el suelo"], steps: ["Coloca figuras grandes en un suelo despejado y sin obstáculos.", "Invita al niño a pisar, alcanzar o señalar la figura que nombras."], learningGoal: "Reconocer figuras, escuchar y mover el cuerpo." },
  },
  {
    id: "garden-helper", title: "Garden helper", minAge: 2, maxAge: 5, minutes: 18, interests: ["nature", "plants", "practical life"], materials: ["small watering can", "adult-approved plant", "water"],
    steps: ["Choose a sturdy plant and fill a small watering can together.", "Let the child add a little water, then look for changes in the soil and leaves."], learningGoal: "Care, observation, and simple cause and effect.",
    simpler: { title: "Water one plant", steps: ["Show the child one plant.", "Help them pour a small amount of water with two hands."], learningGoal: "Careful movement and noticing living things." },
    moreKids: { title: "Plant care team", steps: ["Give each child one small task, such as holding the can or checking leaves.", "Take turns and talk about what the plant needs."], learningGoal: "Cooperation and responsibility." },
    spanish: { title: "Ayudante del jardín", materials: ["regadera pequeña", "planta aprobada por un adulto", "agua"], steps: ["Elijan una planta firme y llenen juntos una regadera pequeña.", "Deja que el niño añada poca agua y después observen la tierra y las hojas."], learningGoal: "Cuidado, observación y causa y efecto sencillos." },
  },
  {
    id: "float-and-sink", title: "Float and sink", minAge: 3, maxAge: 5, minutes: 20, interests: ["science", "water", "curiosity"], materials: ["shallow water tray", "large safe objects", "towel"],
    steps: ["Select only large, age-appropriate objects and set a shallow tray on a stable surface.", "Guess whether each object will float, test it together, and dry the area after play."], learningGoal: "Prediction, comparison, and describing what happens.",
    simpler: { title: "Choose one object", steps: ["Offer one large object and a shallow tray.", "Watch together as it touches the water."], learningGoal: "Observation and new words." },
    moreKids: { title: "Make a group guess", steps: ["Each child chooses one large object.", "Share a guess before an adult tests the objects one at a time."], learningGoal: "Listening, prediction, and comparing ideas." },
    spanish: { title: "Flota o se hunde", materials: ["bandeja poco profunda con agua", "objetos grandes y seguros", "toalla"], steps: ["Elige solo objetos grandes y apropiados para la edad; coloca la bandeja en una superficie estable.", "Adivinen si cada objeto flotará, pruébenlo juntos y sequen el área al terminar."], learningGoal: "Predicción, comparación y descripción de lo que ocurre." },
  },
  {
    id: "story-stones", title: "Story stones", minAge: 3, maxAge: 6, minutes: 20, interests: ["reading", "stories", "art"], materials: ["large picture cards", "paper", "crayons"],
    steps: ["Choose three large picture cards and place them face up.", "Invite the child to pick a character, a place, and an event for a short story."], learningGoal: "Story order, vocabulary, and imagination.",
    simpler: { title: "Tell one picture", steps: ["Pick one picture card.", "Ask what the character might be doing."], learningGoal: "Speaking and noticing details." },
    moreKids: { title: "Pass the story", steps: ["Each child chooses one picture in turn.", "Join the pictures into one shared story."], learningGoal: "Listening, sequence, and collaborative language." },
    spanish: { title: "Piedras de historias", materials: ["tarjetas grandes con dibujos", "papel", "crayones"], steps: ["Elige tres tarjetas grandes con dibujos y colócalas boca arriba.", "Invita al niño a elegir un personaje, un lugar y un suceso para un cuento corto."], learningGoal: "Orden de historias, vocabulario e imaginación." },
  },
  {
    id: "leaf-detective", title: "Leaf detective", minAge: 4, maxAge: 7, minutes: 22, interests: ["nature", "science", "art"], materials: ["fallen leaves", "paper", "crayons"],
    steps: ["Collect a few fallen leaves from a parent-approved place; avoid touching unknown plants.", "Compare their shapes, make a crayon rubbing, and return the leaves outside."], learningGoal: "Observation, comparison, and nature vocabulary.",
    simpler: { title: "Look closely at one leaf", steps: ["Choose one fallen leaf with an adult.", "Describe its colour and outline."], learningGoal: "Careful looking and describing." },
    moreKids: { title: "Leaf gallery", steps: ["Each child chooses one fallen leaf.", "Arrange the leaves by shape and explain the groupings."], learningGoal: "Sorting and sharing observations." },
    spanish: { title: "Detectives de hojas", materials: ["hojas caídas", "papel", "crayones"], steps: ["Recojan algunas hojas caídas en un lugar aprobado por la familia; no toquen plantas desconocidas.", "Comparen sus formas, hagan un frotado con crayón y devuelvan las hojas afuera."], learningGoal: "Observación, comparación y vocabulario de la naturaleza." },
  },
  {
    id: "pretend-market", title: "Pretend market", minAge: 4, maxAge: 7, minutes: 25, interests: ["maths", "stories", "practical life"], materials: ["clean empty boxes", "paper labels", "play coins"],
    steps: ["Set out clean, empty boxes and make simple picture price labels.", "Take turns being the shopper and shopkeeper; use play coins only."], learningGoal: "Counting, conversation, and everyday problem solving.",
    simpler: { title: "Choose and count", steps: ["Set out two empty boxes.", "Choose one and count one play coin together."], learningGoal: "Choice-making and early counting." },
    moreKids: { title: "Market team", steps: ["Give each child a role: shopper, shopkeeper, or label maker.", "Swap roles after a few turns."], learningGoal: "Cooperation, number words, and role play." },
    spanish: { title: "Mercado de juego", materials: ["cajas vacías y limpias", "etiquetas de papel", "monedas de juguete"], steps: ["Coloca cajas limpias y vacías y crea etiquetas sencillas con dibujos.", "Túrnense para ser quien compra y quien atiende; usen solo monedas de juguete."], learningGoal: "Contar, conversar y resolver problemas cotidianos." },
  },
  {
    id: "paper-bridge", title: "Paper bridge builders", minAge: 5, maxAge: 8, minutes: 25, interests: ["science", "engineering", "problem solving"], materials: ["paper", "two sturdy books", "large counters"],
    steps: ["Place two sturdy books a short distance apart and lay a flat sheet of paper across them.", "Add large counters one at a time, then fold the paper and compare how the bridge changes."], learningGoal: "Testing, redesign, and simple engineering ideas.",
    simpler: { title: "One paper bridge", steps: ["Make a short bridge with one sheet of paper.", "Place one large counter on it with an adult."], learningGoal: "Cause and effect." },
    moreKids: { title: "Bridge design teams", steps: ["Give each child a sheet of paper and a shared set of large counters.", "Compare designs without racing or throwing objects."], learningGoal: "Fair testing and explaining ideas." },
    spanish: { title: "Constructores de puentes de papel", materials: ["papel", "dos libros firmes", "fichas grandes"], steps: ["Separa dos libros firmes y coloca una hoja plana encima.", "Añade fichas grandes de una en una; luego dobla el papel y comparen el cambio."], learningGoal: "Probar, rediseñar y explorar ideas sencillas de ingeniería." },
  },
  {
    id: "cloud-watch", title: "Cloud watch journal", minAge: 5, maxAge: 9, minutes: 20, interests: ["weather", "nature", "art"], materials: ["paper", "crayons", "shaded outdoor seat"],
    steps: ["Choose a shaded, supervised spot and look at the clouds for a few minutes.", "Draw the shapes you notice and describe how the sky changes."], learningGoal: "Observation, weather words, and visual storytelling.",
    simpler: { title: "One cloud shape", steps: ["Look at one cloud from a safe place.", "Draw its outline together."], learningGoal: "Noticing and drawing." },
    moreKids: { title: "Cloud story circle", steps: ["Each child chooses a cloud shape to draw.", "Connect the drawings into a shared sky story."], learningGoal: "Imagination, listening, and describing change." },
    spanish: { title: "Diario de nubes", materials: ["papel", "crayones", "asiento exterior con sombra"], steps: ["Elijan un lugar con sombra y supervisión para observar las nubes unos minutos.", "Dibujen las formas que ven y describan cómo cambia el cielo."], learningGoal: "Observación, palabras sobre el clima y relatos visuales." },
  },
  {
    id: "pattern-dance", title: "Pattern dance", minAge: 6, maxAge: 8, minutes: 18, interests: ["music", "movement", "maths"], materials: ["open floor space", "optional music"],
    steps: ["Make a short movement pattern, such as clap, step, clap, step.", "Invite the child to repeat it and change one part to create a new pattern."], learningGoal: "Sequencing, rhythm, and creative movement.",
    simpler: { title: "Copy two moves", steps: ["Choose two simple moves.", "Repeat them together slowly."], learningGoal: "Memory and rhythm." },
    moreKids: { title: "Add a move", steps: ["Stand in a wide circle with clear space.", "Each child adds one move to the shared pattern."], learningGoal: "Sequencing and taking turns." },
    spanish: { title: "Baile de patrones", materials: ["espacio libre en el suelo", "música opcional"], steps: ["Crea un patrón corto de movimientos, como palmada, paso, palmada, paso.", "Invita al niño a repetirlo y cambiar una parte para crear otro patrón."], learningGoal: "Secuencias, ritmo y movimiento creativo." },
  },
  {
    id: "seed-detectives", title: "Seed detectives", minAge: 6, maxAge: 10, minutes: 25, interests: ["science", "plants", "nature"], materials: ["large seeds", "clear jar", "paper towel", "water"],
    steps: ["With an adult, place large seeds between a damp paper towel and the side of a clear jar.", "Check once a day, draw changes, and keep seeds out of mouths."], learningGoal: "Life cycles, recording change, and patient observation.",
    simpler: { title: "Observe one seed", steps: ["Look at one large seed with an adult.", "Draw its shape before planting."], learningGoal: "Observation and recording." },
    moreKids: { title: "Shared growth diary", steps: ["Give each child a day to draw the jar.", "Compare drawings at the end of the week."], learningGoal: "Sequence, shared responsibility, and evidence." },
    spanish: { title: "Detectives de semillas", materials: ["semillas grandes", "frasco transparente", "papel absorbente", "agua"], steps: ["Con un adulto, coloca semillas grandes entre papel húmedo y el lado de un frasco transparente.", "Revísalas una vez al día, dibuja los cambios y mantén las semillas fuera de la boca."], learningGoal: "Ciclos de vida, registro de cambios y observación paciente." },
  },
  {
    id: "room-map", title: "Map a room", minAge: 7, maxAge: 10, minutes: 25, interests: ["geography", "drawing", "problem solving"], materials: ["paper", "pencil", "familiar room"],
    steps: ["Choose a familiar room and sketch its main furniture from above.", "Add a simple key and mark a route between two places."], learningGoal: "Spatial language, symbols, and planning.",
    simpler: { title: "Map one corner", steps: ["Draw one corner of a familiar room.", "Add one symbol for a chair or table."], learningGoal: "Position words and symbols." },
    moreKids: { title: "Team map makers", steps: ["Each child sketches one part of the room.", "Join the sketches and agree on a shared key."], learningGoal: "Collaboration and clear communication." },
    spanish: { title: "Haz un mapa de una habitación", materials: ["papel", "lápiz", "habitación conocida"], steps: ["Elijan una habitación conocida y dibujen sus muebles principales desde arriba.", "Añadan una leyenda sencilla y marquen una ruta entre dos lugares."], learningGoal: "Lenguaje espacial, símbolos y planificación." },
  },
  {
    id: "shadow-clock", title: "Shadow clock", minAge: 7, maxAge: 11, minutes: 25, interests: ["science", "time", "nature"], materials: ["chalk", "sunny outdoor spot", "adult supervision"],
    steps: ["In a supervised sunny spot, mark the end of a stationary object’s shadow with chalk.", "Return later to compare the shadow; never look directly at the sun."], learningGoal: "Time, changing light, and careful measurement.",
    simpler: { title: "Trace one shadow", steps: ["Choose a shaded safe view of one shadow.", "Trace its outline with an adult."], learningGoal: "Shape and light observation." },
    moreKids: { title: "Shadow recorders", steps: ["Give each child a different recording task: mark, draw, or describe.", "Compare the records after a short wait."], learningGoal: "Team roles and comparing change." },
    spanish: { title: "Reloj de sombras", materials: ["tiza", "lugar soleado al aire libre", "supervisión adulta"], steps: ["En un lugar soleado y supervisado, marca con tiza el final de la sombra de un objeto quieto.", "Vuelvan después para comparar la sombra; nunca miren directamente al sol."], learningGoal: "Tiempo, cambios de luz y medición cuidadosa." },
  },
  {
    id: "bottle-band", title: "Bottle-band rhythm", minAge: 8, maxAge: 12, minutes: 20, interests: ["music", "sound", "engineering"], materials: ["clean empty plastic containers", "large dry beans", "tape"],
    steps: ["An adult seals a clean container with a few large dry beans and checks the lid.", "Compare quiet and loud rhythms; keep the sealed instrument away from younger children."], learningGoal: "Sound, rhythm, and safe reuse of materials.",
    simpler: { title: "Tap a rhythm", steps: ["Tap a table softly with two fingers.", "Repeat the rhythm together."], learningGoal: "Listening and rhythm." },
    moreKids: { title: "Small rhythm group", steps: ["Give each child a different rhythm to practise.", "Take turns leading one short group pattern."], learningGoal: "Timing and attentive teamwork." },
    spanish: { title: "Ritmo con recipientes", materials: ["recipientes de plástico limpios y vacíos", "frijoles secos grandes", "cinta adhesiva"], steps: ["Un adulto cierra un recipiente limpio con pocos frijoles grandes y revisa la tapa.", "Comparen ritmos suaves y fuertes; mantengan el instrumento lejos de niños pequeños."], learningGoal: "Sonido, ritmo y reutilización segura de materiales." },
  },
  {
    id: "weather-station", title: "Window weather station", minAge: 8, maxAge: 12, minutes: 20, interests: ["weather", "science", "data"], materials: ["paper", "pencil", "window view"],
    steps: ["Create a simple chart for cloud cover, rain, and wind seen from indoors.", "Record one observation at the same time each day and compare the week."], learningGoal: "Data collection, patterns, and evidence-based descriptions.",
    simpler: { title: "One weather note", steps: ["Look outside from indoors.", "Draw one sign of today’s weather."], learningGoal: "Observation and recording." },
    moreKids: { title: "Weather reporters", steps: ["Give each child one observation to record.", "Combine notes into one daily report."], learningGoal: "Shared data and clear explanations." },
    spanish: { title: "Estación del clima junto a la ventana", materials: ["papel", "lápiz", "vista desde una ventana"], steps: ["Crea una tabla sencilla para nubes, lluvia y viento vistos desde adentro.", "Registra una observación a la misma hora cada día y compara la semana."], learningGoal: "Recopilar datos, encontrar patrones y describir pruebas." },
  },
  {
    id: "treasure-route", title: "Code a treasure route", minAge: 9, maxAge: 12, minutes: 25, interests: ["coding", "maths", "problem solving"], materials: ["paper", "pencil", "small toy"],
    steps: ["Draw a small grid and place a toy at the start and a paper marker at the goal.", "Write step-by-step arrows, then follow them and debug any wrong turns."], learningGoal: "Algorithms, direction, and debugging.",
    simpler: { title: "Three-step route", steps: ["Draw a short line of three squares.", "Use arrows to move a marker to the last square."], learningGoal: "Sequencing and direction." },
    moreKids: { title: "Pair programmer", steps: ["One child writes the route and one follows it exactly.", "Swap roles and fix unclear instructions together."], learningGoal: "Precision, collaboration, and debugging." },
    spanish: { title: "Programa una ruta del tesoro", materials: ["papel", "lápiz", "juguete pequeño"], steps: ["Dibuja una cuadrícula pequeña y coloca un juguete al inicio y una marca de papel en la meta.", "Escribe flechas paso a paso, síguelas y corrige los giros equivocados."], learningGoal: "Algoritmos, dirección y depuración." },
  },
  {
    id: "nature-colour-lab", title: "Nature colour lab", minAge: 9, maxAge: 12, minutes: 30, interests: ["art", "nature", "science"], materials: ["paper", "crayons", "parent-approved outdoor view"],
    steps: ["Choose three colours seen from a supervised outdoor spot or window.", "Make a small colour chart and note where each colour appeared."], learningGoal: "Close observation, colour comparison, and visual recording.",
    simpler: { title: "Two-colour study", steps: ["Choose two colours from the view.", "Draw one object for each colour."], learningGoal: "Observation and comparison." },
    moreKids: { title: "Shared colour atlas", steps: ["Each child records a different colour.", "Combine the pages into one small atlas."], learningGoal: "Classification and collaborative art." },
    spanish: { title: "Laboratorio de colores de la naturaleza", materials: ["papel", "crayones", "vista exterior aprobada por la familia"], steps: ["Elige tres colores que veas desde un lugar exterior supervisado o una ventana.", "Haz una tabla pequeña y anota dónde apareció cada color."], learningGoal: "Observación detallada, comparación de colores y registro visual." },
  },
  {
    id: "paper-engineering", title: "Paper engineering tower", minAge: 10, maxAge: 12, minutes: 30, interests: ["engineering", "design", "maths"], materials: ["paper", "paper tape", "flat tabletop"],
    steps: ["Set a height goal and build a freestanding tower from paper and tape.", "Measure it, change one design choice, and compare the new result."], learningGoal: "Design cycles, measurement, and explaining trade-offs.",
    simpler: { title: "Short stable tower", steps: ["Fold two sheets into broad supports.", "Join them with a short strip of tape."], learningGoal: "Stability and simple construction." },
    moreKids: { title: "Design challenge teams", steps: ["Set the same paper limit for each pair.", "Compare stability and explain one design choice."], learningGoal: "Fair testing and teamwork." },
    spanish: { title: "Torre de ingeniería de papel", materials: ["papel", "cinta de papel", "mesa plana"], steps: ["Fija una altura meta y construye una torre independiente con papel y cinta.", "Mídela, cambia una decisión de diseño y compara el resultado."], learningGoal: "Ciclos de diseño, medición y explicación de decisiones." },
  },
  {
    id: "pollinator-map", title: "Pollinator map", minAge: 10, maxAge: 12, minutes: 30, interests: ["nature", "geography", "science"], materials: ["paper", "pencil", "adult-approved garden view"],
    steps: ["From a safe, supervised place, observe a garden or park without touching insects.", "Sketch where you see flowers and record any pollinators from a distance."], learningGoal: "Mapping, respectful observation, and habitat awareness.",
    simpler: { title: "Flower spotter", steps: ["Look at one flower from a safe distance.", "Draw its shape and colour."], learningGoal: "Observation and careful attention." },
    moreKids: { title: "Habitat map team", steps: ["Assign children separate areas to observe with an adult.", "Join the sketches and compare the places seen."], learningGoal: "Mapping and sharing evidence." },
    spanish: { title: "Mapa de polinizadores", materials: ["papel", "lápiz", "vista de jardín aprobada por un adulto"], steps: ["Desde un lugar seguro y supervisado, observa un jardín o parque sin tocar insectos.", "Dibuja dónde ves flores y registra polinizadores a distancia."], learningGoal: "Mapas, observación respetuosa y conocimiento del hábitat." },
  },
  {
    id: "feelings-comic", title: "Feelings comic strip", minAge: 11, maxAge: 12, minutes: 25, interests: ["art", "reading", "emotional skills"], materials: ["paper", "pencils", "crayons"],
    steps: ["Draw three simple panels about a made-up character facing a small challenge.", "Add thought bubbles showing two ways the character might respond."], learningGoal: "Perspective, emotional vocabulary, and flexible thinking.",
    simpler: { title: "One feeling panel", steps: ["Draw a character with one clear feeling.", "Name the feeling and one thing that may help."], learningGoal: "Emotional words and reflection." },
    moreKids: { title: "Many possible endings", steps: ["Each child draws a different ending for the same character.", "Share how each response might feel for the character."], learningGoal: "Perspective-taking and respectful discussion." },
    spanish: { title: "Cómic de emociones", materials: ["papel", "lápices", "crayones"], steps: ["Dibuja tres viñetas sobre un personaje inventado que enfrenta un reto pequeño.", "Añade globos de pensamiento con dos maneras en que el personaje podría responder."], learningGoal: "Perspectiva, vocabulario emocional y pensamiento flexible." },
  },
  {
    id: "water-filter-design", title: "Water filter design", minAge: 11, maxAge: 12, minutes: 30, interests: ["science", "engineering", "environment"], materials: ["clear cup", "clean gravel", "paper filter", "soil-water mixture"],
    steps: ["An adult prepares a small soil-and-water mixture and sets out clean materials.", "Layer a paper filter and clean gravel, pour the mixture through, compare the result, and do not drink it."], learningGoal: "Material properties, observation, and fair testing.",
    simpler: { title: "Compare two filters", steps: ["Place two different clean filter materials over separate cups.", "An adult pours the same soil-water mixture through each; do not drink it."], learningGoal: "Comparison and careful observation." },
    moreKids: { title: "Test design teams", steps: ["Give each pair the same starting materials.", "Compare what changes and record that filtered water is not drinking water."], learningGoal: "Fair testing and clear safety communication." },
    spanish: { title: "Diseño de filtro de agua", materials: ["vaso transparente", "grava limpia", "filtro de papel", "mezcla de agua y tierra"], steps: ["Un adulto prepara una mezcla pequeña de tierra y agua y dispone materiales limpios.", "Coloca el filtro y la grava, vierte la mezcla, compara el resultado y no la bebas."], learningGoal: "Propiedades de materiales, observación y pruebas justas." },
  },
  {
    id: "sound-map", title: "Sound map", minAge: 6, maxAge: 12, minutes: 20, interests: ["music", "nature", "listening"], materials: ["paper", "pencil", "quiet supervised place"],
    steps: ["Sit in a quiet, supervised place and draw a dot for where you are.", "Listen for a short time and add a symbol for each sound and its direction."], learningGoal: "Listening, spatial awareness, and careful recording.",
    simpler: { title: "Name three sounds", steps: ["Listen quietly for one minute.", "Name three sounds you heard."], learningGoal: "Attention and listening words." },
    moreKids: { title: "Sound map circle", steps: ["Each child listens from the same safe spot.", "Compare maps and notice which sounds were shared."], learningGoal: "Comparing observations and listening together." },
    spanish: { title: "Mapa de sonidos", materials: ["papel", "lápiz", "lugar tranquilo y supervisado"], steps: ["Siéntate en un lugar tranquilo y supervisado y dibuja un punto para indicar dónde estás.", "Escucha un momento y añade un símbolo para cada sonido y su dirección."], learningGoal: "Escucha, orientación espacial y registro cuidadoso." },
  },
  {
    id: "recycled-design", title: "Recycled packaging design", minAge: 7, maxAge: 12, minutes: 25, interests: ["art", "design", "environment"], materials: ["clean empty boxes", "paper", "paper tape"],
    steps: ["Choose clean, dry packaging with no sharp edges and decide what new object it could become.", "Sketch the idea, build a small model, and explain which parts were reused."], learningGoal: "Creative reuse, planning, and material awareness.",
    simpler: { title: "Build one new shape", steps: ["Choose one clean box.", "Add a paper label to give it a new purpose."], learningGoal: "Imagination and reuse." },
    moreKids: { title: "Reuse design studio", steps: ["Each child makes one part of a shared model.", "Join the parts and explain how they work together."], learningGoal: "Collaboration and design thinking." },
    spanish: { title: "Diseño con envases reutilizados", materials: ["cajas limpias y vacías", "papel", "cinta de papel"], steps: ["Elige envases limpios, secos y sin bordes afilados; piensa en un objeto nuevo.", "Dibuja la idea, construye un modelo pequeño y explica qué partes reutilizaste."], learningGoal: "Reutilización creativa, planificación y conocimiento de materiales." },
  },
  {
    id: "story-map", title: "Story map adventure", minAge: 5, maxAge: 10, minutes: 25, interests: ["reading", "geography", "stories"], materials: ["paper", "crayons", "favourite book"],
    steps: ["Choose a familiar story and sketch three places the character visits.", "Draw a route between places and retell one event at each stop."], learningGoal: "Story sequence, place words, and recall.",
    simpler: { title: "One story place", steps: ["Pick one place from a favourite book.", "Draw what the character might see there."], learningGoal: "Recall and descriptive language." },
    moreKids: { title: "Shared story route", steps: ["Each child chooses one place from the story.", "Arrange the places in order and retell the journey."], learningGoal: "Sequence and shared storytelling." },
    spanish: { title: "Aventura de mapa e historia", materials: ["papel", "crayones", "libro favorito"], steps: ["Elige un cuento conocido y dibuja tres lugares que visita el personaje.", "Traza una ruta entre ellos y cuenta un suceso en cada parada."], learningGoal: "Secuencia narrativa, palabras de lugar y memoria." },
  },
  {
    id: "balance-lab", title: "Balance and build lab", minAge: 4, maxAge: 9, minutes: 22, interests: ["science", "building", "problem solving"], materials: ["large blocks", "flat table"],
    steps: ["Set out large blocks on a flat surface and make a low, wide base.", "Add one block at a time and notice what makes the structure steady."], learningGoal: "Balance, spatial reasoning, and patient testing.",
    simpler: { title: "Build a low wall", steps: ["Place three large blocks in a row.", "Add one block on top with an adult nearby."], learningGoal: "Position and balance." },
    moreKids: { title: "Shared structure", steps: ["Take turns adding one large block.", "Pause after each turn to check stability."], learningGoal: "Cooperation and testing ideas." },
    spanish: { title: "Laboratorio de equilibrio y construcción", materials: ["bloques grandes", "mesa plana"], steps: ["Coloca bloques grandes sobre una superficie plana y crea una base ancha y baja.", "Añade un bloque cada vez y observa qué mantiene firme la estructura."], learningGoal: "Equilibrio, razonamiento espacial y pruebas pacientes." },
  },
  {
    id: "mini-museum", title: "Pocket-size mini museum", minAge: 8, maxAge: 12, minutes: 30, interests: ["history", "art", "stories"], materials: ["three family-approved objects", "paper", "pencil"],
    steps: ["Choose three safe, family-approved objects with a story or use.", "Make a small label for each and give a short tour of the mini museum."], learningGoal: "Description, storytelling, and organizing information.",
    simpler: { title: "One object exhibit", steps: ["Choose one safe object.", "Draw it and write or say one thing about it."], learningGoal: "Observation and description." },
    moreKids: { title: "Museum guide team", steps: ["Each child contributes one approved object and label.", "Take turns guiding visitors through the exhibit."], learningGoal: "Communication and shared planning." },
    spanish: { title: "Pequeño museo", materials: ["tres objetos aprobados por la familia", "papel", "lápiz"], steps: ["Elige tres objetos seguros y aprobados por la familia que tengan una historia o un uso.", "Escribe una etiqueta para cada uno y presenta el pequeño museo."], learningGoal: "Descripción, narración y organización de información." },
  },
];
