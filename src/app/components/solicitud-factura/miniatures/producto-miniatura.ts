export interface MiniaturaProducto {
    emoji: string;
    /** Opcional: ruta a una foto real, ej. 'assets/productos/pechuga.jpg' */
    imagen?: string;
}

interface Regla {
    /** Basta con que aparezca UNA de estas palabras. */
    palabras: string[];
    /** Si se indica, además debe aparecer AL MENOS UNA de estas. */
    con?: string[];
    /** Si aparece ALGUNA de estas, la regla no aplica. */
    sin?: string[];
    emoji: string;
    imagen?: string;
}

const DEFECTO: MiniaturaProducto = { emoji: '🍖' };

/**
 * El ORDEN importa: la primera regla que coincida gana.
 * Pon primero lo más específico y lo que desambigua, y al final lo general.
 */
const REGLAS: Regla[] = [
    // --- Aves específicas (antes que pechuga/pollo: "pechuga de pavo" es pavo) ---
    { palabras: ['pavo'], emoji: '🦃' },
    { palabras: ['pato'], emoji: '🦆' },
    { palabras: ['huevo'], emoji: '🥚' },

    // --- Chuleta: depende del animal que se mencione ---
    { palabras: ['chuleta'], con: ['res', 'vaca', 'ternera', 'novillo', 'carne'], emoji: '🥩' },
    { palabras: ['chuleta'], con: ['pollo', 'gallina'], emoji: '🍗' },
    { palabras: ['chuleta'], con: ['cordero', 'borrego', 'chivo', 'cabrito'], emoji: '🍖' },
    { palabras: ['chuleta'], con: ['pescado', 'atun', 'salmon', 'corvina', 'tilapia'], emoji: '🐟' },
    // "chuleta" sola o "chuleta de cerdo" cae en la regla de cerdo de abajo

    // --- Pollo (cortes) ---
    { palabras: ['pechuga'], emoji: '🍗' },
    { palabras: ['ala', 'alita'], emoji: '🍗' },
    { palabras: ['muslo', 'pierna', 'encuentro', 'contramuslo'], emoji: '🍗' },

    // --- Cerdo (si dice "cerdo", gana sobre "lomo", "costilla", etc.) ---
    { palabras: ['tocino', 'bacon', 'panceta', 'chicharron'], emoji: '🥓' },
    {
        palabras: ['chuleta', 'cerdo', 'cochino', 'puerco', 'pernil', 'lechon'],
        emoji: '🐖',
    },

    // --- Embutidos ---
    {
        palabras: ['chorizo', 'salchicha', 'longaniza', 'hot dog', 'butifarra', 'morcilla'],
        emoji: '🌭',
    },
    { palabras: ['jamon', 'mortadela', 'salami', 'pepperoni'], emoji: '🍖' },

    // --- Res ---
    { palabras: ['hamburguesa'], emoji: '🍔' },
    {
        palabras: [
            'corte', 'bistec', 'filete', 'lomo', 'costilla', 'molida', 'res', 'carne',
            'churrasco', 'asado', 'tbone', 'ribeye', 'ternera', 'vaca',
        ],
        emoji: '🥩',
    },
    { palabras: ['higado', 'menudencia', 'mondongo', 'lengua', 'corazon', 'rinon'], emoji: '🍖' },

    // --- Pollo (general, va después de los cortes) ---
    { palabras: ['combo', 'pollo', 'gallina', 'broaster', 'pio'], emoji: '🍗' },

    // --- Mar ---
    { palabras: ['camaron', 'langostino'], emoji: '🍤' },
    { palabras: ['pescado', 'tilapia', 'trucha', 'atun', 'corvina', 'salmon', 'bagre'], emoji: '🐟' },

    // --- Otros ---
    { palabras: ['queso'], emoji: '🧀' },
];

/** Minúsculas, sin tildes ni símbolos. */
function normalizar(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Palabra COMPLETA, con plural opcional (s / es):
 * "res" coincide con "res" pero no con "resto"; "pechuga" coincide con "pechugas".
 */
function compilar(palabras: string[] | undefined): RegExp[] {
    return (palabras ?? []).map((p) => new RegExp('(^|\\s)' + normalizar(p) + '(s|es)?(\\s|$)'));
}

// Se compila una sola vez al cargar el archivo.
const REGLAS_COMPILADAS = REGLAS.map((regla) => ({
    regla,
    palabras: compilar(regla.palabras),
    con: compilar(regla.con),
    sin: compilar(regla.sin),
}));

export function miniaturaProducto(nombre: string | null | undefined): MiniaturaProducto {
    const texto = normalizar(nombre ?? '');
    if (!texto) return DEFECTO;

    for (const { regla, palabras, con, sin } of REGLAS_COMPILADAS) {
        const coincide = palabras.some((p) => p.test(texto));
        if (!coincide) continue;

        if (con.length > 0 && !con.some((p) => p.test(texto))) continue;
        if (sin.length > 0 && sin.some((p) => p.test(texto))) continue;

        return { emoji: regla.emoji, imagen: regla.imagen };
    }

    return DEFECTO;
}