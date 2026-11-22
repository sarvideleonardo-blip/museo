import { Island, IslandBiome, MuseumPiece, PaintingData, InteractiveAppData } from '../types/museum';

export const BIOME_LABELS: Record<IslandBiome, { name: string; desc: string }> = {
  forest: { name: 'Bosque verde', desc: 'Árboles pixelados, senderos dorados y hongos de tinta' },
  observatory: { name: 'Observatorio nocturno', desc: 'Torres astronómicas, cúpulas violetas y faroles' },
  ice: { name: 'Galería de hielo', desc: 'Castillo cristalino, vitrales fríos y reflejos claros' },
  patio: { name: 'Patio jardín', desc: 'Fuente de piedra, árbol raíz y plazas empedradas' },
  desert: { name: 'Desierto antiguo', desc: 'Pirámide de arena, cactus y ruinas contemplativas' },
  workshop: { name: 'Taller industrial', desc: 'Arquitectura metálica, chimeneas y luces de neón' },
  volcano: { name: 'Caldera volcánica', desc: 'Rocas de basalto oscuro, cráter humeante y ríos de magma' },
  crypt: { name: 'Cripta y ruinas', desc: 'Piedra antigua, arcos góticos, columnas y musgo' },
  coral: { name: 'Arrecife de coral', desc: 'Atolón turquesa, arenas claras y estructuras coralinas' },
};

export const ORIGINAL_ISLANDS: Island[] = [
  {
    id: 'linguinales',
    isOriginal: true,
    biome: 'forest',
    x: 18.5,
    y: 39,
    mapLabel: 'EL BOSQUE\nLINGÜINAL',
    title: 'El bosque lingüinal',
    eyebrow: 'ISLA 01 · BOSQUE DE LENGUAJE',
    description:
      'Aquí las palabras no se quedan quietas. Algunas germinan, otras se deforman y otras aprenden a volar.',
    footer: 'Palabras, fósiles y criaturas verbales',
  },
  {
    id: 'nucuria',
    isOriginal: true,
    biome: 'observatory',
    x: 50.5,
    y: 25,
    mapLabel: 'NUCURIA',
    title: 'Nucuria',
    eyebrow: 'ISLA 02 · OBSERVATORIO',
    description:
      'Un territorio para teorías que todavía no encuentran las leyes que necesitan. La duda funciona como gravedad.',
    footer: 'Teorías de otros universos',
  },
  {
    id: 'pinturas',
    isOriginal: true,
    biome: 'ice',
    x: 79.5,
    y: 39,
    mapLabel: 'LA GALERÍA\nDE HIELO',
    title: 'La galería de hielo',
    eyebrow: 'ISLA 03 · GALERÍA',
    description:
      'Nueve ventanas para mirar lo que no siempre se deja traducir en palabras.',
    footer: 'El archivo visual del museo',
  },
  {
    id: 'patio',
    isOriginal: true,
    biome: 'patio',
    x: 50.5,
    y: 67,
    mapLabel: 'PATIO 404',
    title: 'Patio 404',
    eyebrow: 'ISLA CENTRAL · UMBRAL',
    description:
      'El centro no explica el archipiélago: apenas permite orientarse antes de volver a perderse.',
    footer: 'Entrada, árbol raíz, fuente y recuerdos',
  },
  {
    id: 'sala5',
    isOriginal: true,
    biome: 'desert',
    x: 23,
    y: 82,
    mapLabel: 'DESIERTO\nFILOSÓFICO',
    title: 'Desierto filosófico',
    eyebrow: 'ISLA 05 · POESÍA Y RELATOS',
    description:
      'Un paisaje de preguntas, pliegues, relatos encontrados y cosas que quizá no tienen propósito accesible.',
    footer: 'Leer también es caminar',
  },
  {
    id: 'links',
    isOriginal: true,
    biome: 'workshop',
    x: 78,
    y: 81,
    mapLabel: 'TALLER\nDE JUEGOS',
    title: 'Taller de juegos',
    eyebrow: 'ISLA 06 · TALLER DE MÁQUINAS',
    description:
      'Pequeñas máquinas para producir palabras imposibles, consultar una niebla o emitir pulsos.',
    footer: 'Artefactos interactivos',
  },
];

export const INITIAL_ROOM_META: Record<string, { id: string; name: string; description: string }[]> = {
  linguinales: [
    {
      id: 'main',
      name: 'Sala de palabras espora',
      description:
        'Aquí las palabras no se quedan quietas. Algunas germinan, otras se deforman y otras aprenden a volar.',
    },
  ],
  nucuria: [
    {
      id: 'main',
      name: 'Observatorio de lo invisible',
      description:
        'Un territorio para teorías que todavía no encuentran las leyes que necesitan. La duda funciona como gravedad.',
    },
  ],
  pinturas: [
    {
      id: 'main',
      name: 'Galería de pinturas',
      description: 'Nueve ventanas para mirar lo que no siempre se deja traducir en palabras.',
    },
  ],
  patio: [
    {
      id: 'main',
      name: 'Sala del umbral',
      description:
        'El centro no explica el archipiélago: apenas permite orientarse antes de volver a perderse.',
    },
  ],
  sala5: [
    {
      id: 'main',
      name: 'Sala de poesía y filosofía',
      description:
        'Un paisaje de preguntas, pliegues y cosas que quizá no tienen propósito accesible.',
    },
    {
      id: 'historias',
      name: 'Historias encontradas',
      description:
        'Cuatro relatos hallados en los márgenes del desierto rojo y las montañas de hielo.',
    },
  ],
  links: [
    {
      id: 'main',
      name: 'Taller de máquinas',
      description:
        'Pequeñas máquinas para producir palabras imposibles, consultar una niebla o emitir pulsos.',
    },
  ],
};

export const RECEPTIONIST_DIALOGUE: string[] = [
  '«ES PELIGROSO CREAR SOLO. ¡LLEVA ESTO!»',
  'Has recibido el FOLLETO DEL MUSEO 404 siNOMBRE.',
  'Camina por el archipiélago o entra en modo 2D a cada isla para recorrer sus pedestales, cuadros y máquinas.',
  'Explora sin prisa. Todo lo que descubras quedará registrado en tu recorrido.',
];

export const FOUNTAIN_QUOTES: string[] = [
  '«El agua refleja lo que la palabra aún no se atreve a pronunciar.»',
  '«Un deseo 404: Que todo lo borrado encuentre una sala donde resonar para siempre.»',
  '«No todo lo que no se encuentra está perdido; a veces simplemente espera a un visitante paciente.»',
  '«El error no es el fin del camino, sino la grieta por donde brota la poesía.»',
  '«Bebes un trago de agua fresca de 8 bits. Tu mente creadora recupera toda su energía.»',
];

export const ROOT_TREE_TEXT =
  'Un árbol milenario sembrado en medio del patio. Sus hojas emiten un susurro digital: «El lenguaje es el único bosque que crece hacia adentro».';

const NUCURIA_TITLES = [
  'La física de la sombra',
  'Órbitas inversas',
  'Gramática del vacío',
  'El reloj de agua seca',
  'Cartografía de lo invisible',
  'El segundo eco',
  'Leyes de la resonancia',
  'Especies de silencio',
  'Minerales del pensamiento',
  'Mareas estelares',
  'La luz lenta',
  'El punto cero',
  'Geometría de la duda',
  'Fósiles de ideas',
  'Arquitectura del sueño',
  'Vocales perdidas',
  'Termodinámica del afecto',
  'El horizonte de sucesos íntimo',
];

const PAINTINGS_DATA: PaintingData[] = [
  { id: 1, title: 'Pintura 01 · Umbral Glacial', year: 'Archivo 404', palette: ['#0b2b39', '#3cbcfc', '#e1c875', '#f1efd9'], desc: 'Composición en frío mineral. Puedes sustituir esta obra por tu propia imagen desde el Editor.' },
  { id: 2, title: 'Pintura 02 · Reflejo de Mercurio', year: 'Archivo 404', palette: ['#1b1f3b', '#7d69aa', '#e8a7e3', '#f8f4dd'], desc: 'Geometrías suspendidas en vigilia. Sustituible por cualquier imagen en el Editor.' },
  { id: 3, title: 'Pintura 03 · Nevada Carmesí', year: 'Archivo 404', palette: ['#2a1018', '#a24d2e', '#e07d98', '#fce0a8'], desc: 'Horizonte térmico sobre cielo de ceniza. Sustituible desde el Editor.' },
  { id: 4, title: 'Pintura 04 · Bosque Hacia Adentro', year: 'Archivo 404', palette: ['#14381e', '#4a7c3a', '#a9d68d', '#f7c85b'], desc: 'Follaje pixelado y claros de niebla. Sustituible desde el Editor.' },
  { id: 5, title: 'Pintura 05 · La Hora Inversa', year: 'Archivo 404', palette: ['#042b40', '#027a8c', '#68e0d4', '#fff5cb'], desc: 'Mareas luminosas bajo una cúpula sumergida. Sustituible desde el Editor.' },
  { id: 6, title: 'Pintura 06 · Retorta del Río', year: 'Archivo 404', palette: ['#3b251e', '#c88e55', '#f6d48c', '#d82820'], desc: 'Arena iridiscente y trazos de obsidiana. Sustituible desde el Editor.' },
  { id: 7, title: 'Pintura 07 · Fósil Fonético', year: 'Archivo 404', palette: ['#273a5b', '#5485a4', '#b9e7ef', '#f2d079'], desc: 'Erosión de sílabas sobre hielo azul. Sustituible desde el Editor.' },
  { id: 8, title: 'Pintura 08 · Pulso Nocturno', year: 'Archivo 404', palette: ['#12101a', '#593d42', '#d17d5e', '#75e4dc'], desc: 'Arquitectura industrial de señales lejanas. Sustituible desde el Editor.' },
  { id: 9, title: 'Pintura 09 · Mapa Incompleto', year: 'Archivo 404', palette: ['#183c49', '#65b65d', '#e2c56c', '#fcfcfc'], desc: 'Fragmento cartográfico de una isla aún no nacida. Sustituible desde el Editor.' },
];

const APPS_DATA: InteractiveAppData[] = [
  {
    id: 'app_1',
    title: 'Generador de Palabras Imposibles',
    subtitle: 'Juego de lenguaje #1',
    desc: 'Herramienta que recombina raíces fonéticas para inventar términos que el idioma aún no tiene.',
    interactiveType: 'word_generator',
  },
  {
    id: 'app_2',
    title: 'Oráculo 404',
    subtitle: 'Juego de lenguaje #2',
    desc: 'Haz una pregunta a la niebla digital y recibe una respuesta construida con fragmentos poéticos aleatorios.',
    interactiveType: 'oracle',
  },
  {
    id: 'app_3',
    title: 'Telégrafo Poético',
    subtitle: 'Juego de lenguaje #3',
    desc: 'Generador de secuencias rítmicas de texto y pulso sonoro 8-bit.',
    interactiveType: 'telegraph',
  },
];

const LINGUINALES_TEXTS = [
  {
    id: 'ling_1',
    title: 'Palabras espora',
    body: 'palabras espora\nhifas rotas\n\nmi pensamiento\nno es mío\n\nuna\nlengua\ncordycep\nme habla\nde mi habla\npor mi habla\n\nEstoy\ndetrás todavia\n\n¿me ves?\n¿Alguien escucha?\n\nun cordycep\nmicelio de mercurio\ninfiltrado\nvolvió piel captora\n\n¿Todos estamos dentro?\n\ngrito resonante\nmaúllo\nladro\naraño sin uñas\naúllo\n\nme ahogo en mercurio\nlo de abajo\ndel abismo cordyceptum\n\nvivisepultura fúngica',
  },
  {
    id: 'ling_2',
    title: 'Tu piel',
    body: 'tu\n\ntu piel\n\nescamas de papiro\n\ntu\n\ntu dentro\n\njeroglíficos\nsusurran\nen una lengua\nque olvido\nque está muerta\n\nal\n\namanecer\n\nal…\n\nalba\naliento de cristal\n\nal\nalas\npara volar\n\ntu\n\ntu piel\n\nescamas\nde obsidiana\n\nlava\nsuspendida\nen el tiempo\n\ntu…\n\ntu piel\n\naurora\n\na-mora\n\nsabora\n\nsabor-eo\n\n\n\ntu\n\ntu piel\n\ntu el tiempo\n\ntu\n\n\npiel templo',
  },
  {
    id: 'ling_3',
    title: 'Objeto lingüístico #004',
    body: 'objeto lingüístico #004\nfósil fonético parcialmente erosionado\nedad aproximada: desconocida\nal parecer las palabras migran cuando nadie las observa\n\n\n    w\n     e\nweres\n     o.  u\n           e\n           roto\n    d edos\n     u\n          e\n   cu      l     os        a.             ´.\n                o.        u a aves.    . . .  .´. . o>\n                   s              e.        . ´\n                               l as.  .´\n\n\nlas puedes ver\n\nse duelen\n\nvuelentrealean\n\nánimas de nieve\n\nhuelen\n\nlas aves\n\nlas ves\n\nlas ves\ntejer\n\ntejiendo arañas\n\nbesando jaulas\n\nreposan\nentre\nbarras\n\naves\nenjaulan\nsu vuelo\n\nenredaderas\ntejen\narañas\n\nni dentro\n\nni fuera\n\nlas ves\n\navenodias\nempollando\ncáscaras\ncenizas de vuelos\n\na\n\nlas mías\n\nno\n\nme\n\nves\n\nsoy\n\nlumas\nde\na\nlas\n\nvuelheridas',
  },
  {
    id: 'ling_4',
    title: 'Peniipitación',
    body: 'peniipitación\n\nnubes con sobredosificación de viagra colapsan\nuna tormenta de pirañas falotriarcales\ncae como siempre\ncon violencia\n\ndevoran inocencia\ndevoran sueños\ndevoran esperanza\n\nal tocar el piso se convierten en babosas reptantes\nciegas para todo lo que no sea el saqueo\n\narrastran su falodiscapacidad\ndesesperadas por crecer\npor llegar al lugar donde se puede hacer a placer\n\nno temen caer detrás de las rejas\nellos son las rejas\n\nseres falopensantes\nhambrientos de falodominio\n\njuegan\nbeben\nse abrazan de más\n\nbrindan con un estallido de champañag rancio\n\n\nlas venas se inflan de poder.\nel poder se infla de venas.\nninguna sabe\nquién está usando a quién.\nnunca es suficiente.\nmás.\nmás.\ntodavía más.\nel "más" devora al "más".\nlas venas aplauden.\nah...\nduele.\ncabum.\ncrak.\nouch.\nel poder\nse desangra\nde sí mismo.',
  },
  {
    id: 'ling_5',
    title: 'Mancho antes',
    body: 'mancho antes\n\n\nmi sudor huele a gasolina\nmi respiración huele a gas\nmi saliva es petróleo\n\n\nmancho\ntodo\nlo que aún\nno me ha tocado\n\n\nun niño pirómano\nenciende un cigarro\n\nme ofrece uno\n\nfumamos\nen silencio\n\nel humo\nnos reconoce\n\ncada tacto\nlabios\ninhalación\nexhalación\n\nes única\n\n\nme habla\nme dice\nya sabes qué pasa\nal final del incendio\n\no aún no\n\nme enseña\nnuevos trucos\ncon su zippo negro mate\n\nmis dedos\nrecuerdan\nel metal\n\nel zippo\ndibuja\nfiguras en el aire\n\nninguno lo lanza\n\nlos dos\nsabemos\ndónde caerá\nantes\nde tocarlo\n\n\nreía\ncon un diente\ntorcido\n\n\ntodavía\n\nantes\nde mis incendios\n\nmiraba\nel fuego\ncon picardía\n\ncuántas formas\ntiene\nuna flama\nmientras\nla sostienes\n\nhambriento\nde conocer\nal hambre\ndel hambre\n\ncomo el murciélago\ncon una ala rosa\nque vive en mi espalda\n\nel niño sonrió\n\nla flama\nse lo fuma',
  },
  {
    id: 'ling_6',
    title: 'Paredes viejas',
    body: 'paredes viejas\nruinas de sal\nno recuerdan\n\nsombras sin sombrante\ncoronadas amnesia\nentre nidos\ncascarones enteros\ny totalmente vacíos\n\nesquinas de enjaularaña\ndonde anidan\narañas anhedónicas\nsin pupilas\n\nvuelaheridas\nde risas\nflotan en silencios\n\n\ntechos\n\ncarcajean\n\nporque aún\n\nse vuelan\n\nal hogar',
  },
  {
    id: 'ling_7',
    title: 'No diré su nombre',
    body: 'no diré su nombre ni su forma ni su peso\nel rezo\nni si rezo su nombre sin peso ni forma\n\nni lo que deforma el peso\nsin nombre\n\nni del humo que fue madera\nmadera sin era\nera sin tiempo\n\ny sin tiempo\nhablaré del fuego\ndel antes del humear\ny del después lagrimear\n\nno hablaré del llanto de ceniza\nni de la lluvia de hollín\nni del canto\nde madera dura\n\ntampoco\ntampoco de mi lengua sin vos\n\nni que sin vos\nla voz\nduramen no arbóreo\n\nsin semilla\nsin madera\n\nsolo queda\n\nla quema\nsolo quema\nquema dura\n\nquemadura\n\nmadura agonía\nantigua quemnadera\ndurandera\nsin curamen\nsin cura\n\nincurable\nme quema\ntu voz\nsin vos\n\nincurable\nvoz de ceniza\nsin vos\nque la eriza\n\nmi voz\nhumeando los aires\ncarbonizada\n\ndibuja\n\nun te amo\n\n\ncon cantos difuntos\nde hojas de mi abedul\n\ncanto\n\ncuánto\n\ncuanto dura lo que el roble tarda\nen evaporarse\n\ncuánto dura un ave-dul\nmi abedul\n\nal besar delirante\namante\nflameante\n\nlo que el humo fue madera\nlo que un árbol se evapora en humo\nsin\nni\n\nhasta que el amar\nhasta que el quemar\nhasta que la mar\nhasta que alma-r\nhasta que el vapor sea amar\nhasta que la mar sea vapor\nhasta que el vapor se fume\nesfume\nmi sopor\n\nentonces\namaré\nsolo\nsolo y sin tiempo\n\namarear\nsin mar\nsin amor\n\namaré hasta sin vos\namar mi voz\n\namaré cuando quemar sea vapor\n\ncuando el amar sea vapor\ny el vapor sea bosque\n\nmientras\nla madera arda\nla flama no rece\ny el humo sea fuego\n\nno hablaré\nni del fuego ni del humo ni de lágrimas\nni lo que evapora el fuego de humo\nni de la madera y su arder\nni del vapor que fue agua\n\nde mí\nde mí en ceniza\ncenizas de mí\n\nsolo entonces\ncuando\nmis cenizas se vuelvan el mar\nmi voz sonará como una flama\nel mar\nyo mar\namaré hasta arder',
  },
];

const SALA5_POEMS = [
  {
    id: 's5_1',
    title: 'El pliegue',
    body: 'el pliegue\n\nno es lo que veo\n\ntodo lo que toco\ndesaparece\n\nsoy\n\nel que ve\nel que ve\nel que viéndose\ncree\n\nlo que tocas\nse retira\nse pliega\nse vuelve a plegar\n\nuna plaga de pliegues\n\nplaga\n\ndentro de sí\ndentro de sí\ndentro de ti\nadentro de mi\n\nmi dentro\nplagado de pliegues\n\ncuando crei agarrar\nsolo roce\nla ausencia\nque dejé con mi propio intento\n\nausencia\nque también se pliega\ntambién es plaga\ntambién te plagia\n\nlo que fui\nno me habla\n\npesa\nme pasa\nme pesas\n\nen el paso\nse multiplica\nen ecos\ncada vez más pequeños\ncada vez más pequeños\ncada vez más peq\ncada vez más p\ncada vez más\ncada vez m\ncada vez\ncada v\ncada\ncad\nca\nc\n\npequeños ríos\nde fractales\nplagados de pliegues\n\nlo que aún no es\nme toca el hombro\n\nuna mano\nno decide\nentre\ncaricia\no madrazo\n\ny esa indecisión\nse repite\na todas las escalas\n\ntodas se escapan\n\ntú te escapas\n\nyo corro\nyo me pliego\nsobre la ausencia\nde un yo\n\nser pliegue\n\nel pliegue\nes el espacio\ndonde la indecisión\nse vuelve estructura\n\ny la estructura\nvuelve',
  },
  {
    id: 's5_2',
    title: 'El hacha',
    body: 'el hacha\n\nhay un para qué\nhay un por qué\nhay un cómo\nhay un de dónde\n\n cuidado\n mienten\n\nsi los persigues\ntodos terminan\nen\nno sé\n\n\n\nentonces aparece el hacha\n\nnunca había visto una en mi vida\npero sé exactamente para qué sirve\n\nla levanto\nla explico\nla uso\nse lo digo a todo el mundo\n\n\n\nquizá estaba completamente equivocado\nquizá nunca fue para cortar madera\nni para defenderse\n\nquizá su propósito\nno es accesible\n\ny aun así\nla sostengo\ncomo si supiera',
  },
  {
    id: 's5_3',
    title: 'El amor como fenómeno emergente',
    body: 'el amor como fenómeno emergente\n\nel amor\n\nno existe como cosa\n\nno me lo das\n\nno te lo doy\n\nno puede poseerse\n\nquizá tampoco exista\neso que llamamos amor\n\nsolo estoy\n\ny estás\n\nte veo\n\nme siento\n\nme veo\nviento\ncomo te siento\n\nahí\n\nemerge\n\ny eso que llamo amor\n\nno surge solo\n\ncomo un lanzamiento nuclear\n\nmás de una llave\n\nmovimientos sincronizados\n\nfuerzas\n\nrelaciones\n\nfunciones\n\ntodo invisible\n\ndemasiadas variables\n\npara creer\nque entiendo algo\n\nlo que llamo amor\n\nquizá sea solamente\n\nel sentir\n\ncomo consecuencia\n\nde eso\n\nque no puedo nombrar\n\nni pensar\n\ncualquier intento\nde darle forma\n\nsería matarlo\n\naquí me detengo\n\neste no saber\n\nera exactamente\n\nlo que llevaba años\n\nqueriendo sentir\n\ncierro los ojos\n\nimagino una nevada\n\nlos copos\n\ntocándome\n\nuno por uno\n\nninguno\n\nigual',
  },
  {
    id: 's5_4',
    title: 'Atrapado',
    body: 'atrapado\n\n\nestoy atrapado entre el aparecer y el desaparecer\nlo que fui no es pero infecta a lo que aún no es\nno duele\nno duele todavía todavía no duele ya está doliendo\ny muriendo\n¿le duele morir?\nme busco mientras algo me busca\nmi cuerpo es caminado lo veo\nno sé si soy yo o si llego tarde a cada paso\nestoy atrapado\nme hablo me escucho pero no hay sonido\nalgo responde\nno sé si viene de mí\nlo que fui no es\n¿cuándo hablo conmigo quién es el otro?\nno sé qué responderá\nva adelante y yo detrás\nestá adentro\n¿tú has caminado así?\na cinco centímetros del piso\nsin estar del todo\nviendo cómo algo usa tu forma\nno duele digo\nno duele\npero algo se está acomodando\n¿qué perdí?\n¿qué sigue aquí esperando?\nlo que aún no es\nsi vuelve\n¿me borra? ¿me deja?\no\n¿yo soy lo que queda mientras eso todavía no llega?\nestoy atrapado entre el aparecer y el desaparecer\nmientras escribía esto perdí mi lugar\nquizá nunca fue mío\nno\ntodavía no\npero sí ya\ndesvanecerse\nhacer invertido\nfundirse\nme dejo atras',
  },
  {
    id: 's5_5',
    title: 'El sentir',
    body: 'el sentir\n\n\n\n¿el sentir soy yo\no yo soy una forma qué el sentir usa ?\n\n¿el sentir es un adolescente y por eso es imposible saber que hará en un minuto?\n\n¿cómo decide si será sentimiento de atracción o sensación con erección?\n\n¿porque no se puede negociar su duración\nni incrementar el pago de su habitación?\n\n¿donde vive antes de encontrar huéspedes\nsi me quedo calladito se sigue de largo?\n\n¿es sadomasoquista por eso prefiere\nsentirse amor\nsentir al amor\ny sentirme vapor\nvolver para sentirme dolor\nolvidar mi sentimiento de dolor\nhasta que el sentir se vuelve vapor ?\n\nyo también lo haría\nverme evaporado\nsentirme en ausencia\nsentirme incapaz de existir\nver el dolor retorcer\ny su mente romper\n\npero ese dolor que no genere\nyo el sentir\nme tuerzo también\n\n¿puedo observar el sentir sin sentir?\n\n¿por qué un mundo imaginario modifica un cuerpo real?\n\n¿hace cien años existían menos formas de sentir o solo menos palabras?\n\n¿podemos inventar un sentir nuevo?\n\n¿cuántos sentires existen sin nombre?\n\n¿cuantos sentimientos no sentiré?\n\n¿cuantos sentires tiene una vida?\n\n¿porque sentir mis sentimientos\nse siente tan\ntan\nsientaladores\n\neste sentir soy yo juegando\na imaginarme multi sensorial\njuego a imaginar cómo sería\ntrabajar de sentir',
  },
];

const HISTORIAS_ENCONTRADAS = [
  {
    id: 'sala2_1',
    title: 'Frio numinoso',
    body: 'frio numinoso\n\n portador\n\nque los vientos glaciares protejan tu camino\nque la madre gélida te guíe\nque tu numinosa frialdad temple tus pensamientos\ntu asombro\ntu insistencia\n\nvas con la fuerza de los siete fríos\n\nrecuerda\nviaja cuando salga el sol negro\npermanece bajo sus rayos de baja temperatura\n\nportador\nque jamás te detenga el calor\n\nrecuerda\nno salgas sin tu flama portadora\nla de tu primer emplazamiento\nsin ella no cruzas el desierto rojo\n\nlobos de vidrio\nprotejan siempre al portador\nque sus aullidos no corten de más\n\nque el trineo saturnino alcance la velocidad helada\npara el salto del no-tiempo\n\nal descender la montaña calorina\nque la madre templada aún te piense\n\nel día de la primera nevada carmesí\nnos volveremos a encontrar\n\npara entonces\nya no serás portador\nserás uno con nuscuria\n\nsiete veces enfría\nsiete veces insiste\nsiete nuscuriales\nsiete voces',
  },
  {
    id: 'sala2_2',
    title: 'La primera nevada carmesí',
    body: 'la primera nevada carmesí\n\ndiecinueve años desde que el portador inició el trayecto\naquí diecinueve horas\nes la primera nevada carmesí\nen la geometría de los copos se esconden\nmensajes de un después anterior\n\na lo lejos aullidos\nuna grieta corta la realidad\nalgo cruza\n\nsu bosque lo reconoce\nlas hojas flotan celebran\nforman un remolino a su alrededor\nun abrazo de otoño lo envuelve\n\nuna risa húmeda como petricor\nlo devuelve al cuerpo\n\nel micelio pregunta\ndónde estuviste\nte sentí pero en un lugar\nparpadeante\ndonde el micelio\nno tiene forma\n\nel portador no responde\nhuele a melancolía\nestá cansado\nno del cuerpo\n\nresponde con la mente\nun gesto apenas\n\ncomienza a girar\nsobre su propio eje\nla nieve carmesí acude\nse adhiere\nasciende\nforma un cilindro\n\nahora\nla voz no viene de afuera\nfrena\nde golpe\n\nuna temperatura desconocida\npermea su cuerpo\n\nel carmesí abandona la nieve\nse licúa\nflota frente a sus ojos\nluego\nlágrimas\n\ndescienden\nentran\n\ndos temperaturas\nun instante\nun grito\n\nel cilindro se disuelve\n\nsiete veces enfría\nsiete veces insiste\nsiete nuscuriales\nsiete voces\ndiecinueve años soñándola\ndiecinueve años en silencio\nhoy\nsomos uno nuevamente\namada nuscuria',
  },
  {
    id: 'sala2_3',
    title: 'El camino de la flama',
    body: 'el camino de la flama.\n\npregunté dónde estamos\n\nen otra dimensión respondió sin mover la boca\n\na unos centímetros de su cabeza\nflota una flama\nen sus ojos hay fuego\n\nde mi cuerpo emana\nun humor vitreo\nque no lleva mi nombre\n\nel cuerpo sigue caminando\n\nlos caminantes balbucean\ncosas que no tienen sentido\n\ntengo sed\ndemasiada sed\n\ncamina rápido dice ella\no te quedarás\n\nsus palabras no suenan\nse sienten\n\nhay casas en llamas\ntodo arde\n\nentonces lo entiendo\nno busco un lugar\nme busco algo que olvide\n\nme detengo\nel cuerpo sigue\n\nlo que buscas dice algo sin voz\nva a matarte para recuperar su lugar\n\nella sigue intacta\nla flama no cede\n\nfuera del camino\ndunas de hidrógeno\ncorroen conjuros cactáceos\nárboles en llamas que\nmueven sus brazos\nlanzando juicios dorados\n\nuna jauría de pies sin cuerpo corre\npor los bordes\nse muerde\nraspa el suelo con uñas\nque ya no terminan de sostenerse\n\nla neblina se cierra\nalguien sale del trazo\ny desaparece en segundos\n\nmás adelante\ncabezas apiladas atravesadas\npor un mástil oxidado\ngritan telarañas de olvido\n\nuna flama que se pelea con sus colores\nflota arriba de mi cabeza\nalgo busca su lugar\n\n\n¿qué soy?\n¿qué somos?\n una voz me dice.\nes un decir. dicho con mi misma voz. sin ser mía.\n\n¿me permites narrar?\n\nno siento opción. la pregunta es cortesía.\n\nya venía respondida.\nme siento usurpador de algo más antiguo que el decir.',
  },
  {
    id: 'sala2_4',
    title: 'Río de los filósofos',
    body: 'río de los filósofos\n\n\n\na la sombra de la luna de azufre\nel río hierve sangre de la tierra\nen su retorta\n\nsiete huevos olvidados\npor deidades\nque solo saben replicar\n\nbeben miel de mercurio\nesperan el corte excomulgo\n\nuna serpiente apóstata\nsuelta sus escamas\ndescienden como cuchillos de seda\n\na dos centímetros del origen\nbufan un vapor antiguo\nllevamos la misma herida\n\nen un giro sin sagrado\nla carne se divide en siete\nse inclina mostrando su miedo\n\nalimenta el hambre primal\nesa que estira el tejido del universo\nsin saber si el origen\no si hay final\n\ncomo la piel\nlos bordes de la existencia\nsiempre van por delante del grito\n\nun huevo no se mueve\nno exhala sonido\n\nestá podrido por dentro de tanto ver\n\nla luz lo infectó antes de dejarlo nacer\n\nel trueno vino de la grieta\nel espacio mismo se quiebra a unos metros del suelo\nemerge hendidura apuntando al cenit\n\nun aliento de arena lo borra todo\ndetrás, el aleteo grita como cascada\n\nemergen unos brazos\nsostenidos por un cuerpo de cóndor\nojo de plomo\nalas de obsidiana\n\nla arena iridiscente comienza\na girar y\nun continente sin nombre\nlo empuja suave\ndesde antes del tiempo\n\nel volcán invertido\nabre un portal de lava\nsus dos cabezas crecen\nhuyen de un centro\nvestido de blanco\n\nLágrimas incandescentes\nde lava viva destilan\nuna forma de serpiente\ntraza una línea de obsidiana con ternura ardiente\n\nengulle los huevos uno a uno\ny los devuelve al athanor\n\nadentro mil soles negros\nirradian la sombra pura de la materia oscura\n\nsiete lunas después el estallido\nsalieron de golpe estrellándose contra el aire\n\nfragmentos de una especie nueva\nluchaban por su pedazo de mundo\n\nun huevo solo decidió no salir\nvomitó la rubedo',
  },
];

export function getBasePiecesForIsland(islandId: string): MuseumPiece[] {
  if (islandId === 'linguinales') {
    return LINGUINALES_TEXTS.map((item, i) => ({
      id: `base-ling-${i + 1}`,
      islandId: 'linguinales',
      roomId: 'main',
      title: item.title,
      subtitle: 'Fragmento lingüinal',
      body: item.body,
      kind: 'text',
    }));
  }

  if (islandId === 'nucuria') {
    return NUCURIA_TITLES.map((title, i) => ({
      id: `base-nucuria-${i + 1}`,
      islandId: 'nucuria',
      roomId: 'main',
      title: `Nucuria #${i + 1}: ${title}`,
      subtitle: 'Teorías de otros universos',
      body: `Fragmento teórico registrado en los anales de Nucuria (${i + 1}/18).\n\n"En este cuadrante, las leyes físicas operan bajo la premisa de que todo pensamiento no dicho ejerce una gravedad proporcional a su misterio. Las partículas no chocan: se reconocen y cambian de trayectoria en reverencia mutua."`,
      kind: 'text',
    }));
  }

  if (islandId === 'pinturas') {
    return PAINTINGS_DATA.map((painting, i) => ({
      id: `base-pintura-${i + 1}`,
      islandId: 'pinturas',
      roomId: 'main',
      title: painting.title,
      subtitle: 'Pieza visual',
      body: painting.desc,
      kind: 'painting',
      mediumOrSize: 'Pintura digital de archivo · Serie 404',
      painting,
    }));
  }

  if (islandId === 'sala5') {
    const poems: MuseumPiece[] = SALA5_POEMS.map((item, i) => ({
      id: `base-poema-${i + 1}`,
      islandId: 'sala5',
      roomId: 'main',
      title: item.title,
      subtitle: 'Poema / exploración',
      body: item.body,
      kind: 'text',
    }));
    const stories: MuseumPiece[] = HISTORIAS_ENCONTRADAS.map((item, i) => ({
      id: `base-historia-${i + 1}`,
      islandId: 'sala5',
      roomId: 'historias',
      title: item.title,
      subtitle: 'Historia encontrada',
      body: item.body,
      kind: 'text',
    }));
    return [...poems, ...stories];
  }

  if (islandId === 'links') {
    return APPS_DATA.map((app, i) => ({
      id: `base-app-${i + 1}`,
      islandId: 'links',
      roomId: 'main',
      title: app.title,
      subtitle: `${app.subtitle} · ${app.desc}`,
      body: app.desc,
      kind: 'app',
      app,
    }));
  }

  if (islandId === 'patio') {
    return [
      {
        id: 'base-patio-guide',
        islandId: 'patio',
        roomId: 'main',
        title: 'La Guía del Umbral',
        subtitle: 'Comenzar el recorrido',
        lines: RECEPTIONIST_DIALOGUE,
        body: RECEPTIONIST_DIALOGUE.join('\n\n'),
        kind: 'text',
      },
      {
        id: 'base-patio-fountain',
        islandId: 'patio',
        roomId: 'main',
        title: 'Fuente de los Deseos 404',
        subtitle: 'Una frase al azar',
        lines: FOUNTAIN_QUOTES,
        body: FOUNTAIN_QUOTES[0],
        kind: 'text',
      },
      {
        id: 'base-patio-tree',
        islandId: 'patio',
        roomId: 'main',
        title: 'El Árbol Raíz',
        subtitle: 'Un organismo en el centro',
        lines: [ROOT_TREE_TEXT],
        body: ROOT_TREE_TEXT,
        kind: 'text',
      },
      {
        id: 'base-patio-shop-0',
        islandId: 'patio',
        roomId: 'main',
        title: 'Instagram Oficial',
        subtitle: 'Conéctate con las transmisiones visuales y notas de proceso del autor.',
        url: 'https://instagram.com',
        kind: 'link',
      },
      {
        id: 'base-patio-shop-1',
        islandId: 'patio',
        roomId: 'main',
        title: 'Playlist del Museo',
        subtitle: 'Canciones y atmósferas que acompañan la creación de estas salas.',
        url: 'https://open.spotify.com',
        kind: 'link',
      },
      {
        id: 'base-patio-shop-2',
        islandId: 'patio',
        roomId: 'main',
        title: 'Recuerdo: Postal del No-Lugar',
        subtitle: 'Objeto de recuerdo',
        lines: ['«Guardas este fragmento de tiempo. Un museo sin paredes físicas pesa menos pero viaja más lejos.»'],
        body: '«Guardas este fragmento de tiempo. Un museo sin paredes físicas pesa menos pero viaja más lejos.»',
        kind: 'text',
      },
      {
        id: 'base-patio-shop-3',
        islandId: 'patio',
        roomId: 'main',
        title: 'Recuerdo: Botella con Tinta Digital',
        subtitle: 'Objeto de recuerdo',
        lines: ['«Tinta que nunca se seca. Escribe sólo en pantallas apagadas.»'],
        body: '«Tinta que nunca se seca. Escribe sólo en pantallas apagadas.»',
        kind: 'text',
      },
    ];
  }

  return [];
}
