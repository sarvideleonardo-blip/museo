# Contribuir a MUSEO 404 · siNOMBRE

🇬🇧 [English version](CONTRIBUTING.en.md)

Gracias por querer aportar.

Este proyecto es una infraestructura abierta: un archipiélago digital donde cualquiera puede construir, publicar y conectar museos.
No hace falta crear un museo para participar. Tampoco hace falta saber programar.

Buscamos aportes de **programadores, diseñadores, artistas, escritores, curadores y personas curiosas**.

---

## Formas de contribuir

### 1. Código
- Corregir bugs
- Mejorar rendimiento (especialmente Three.js, carga de piezas y reglas de Firestore)
- Ampliar el Editor (nuevas opciones de personalización visual, herramientas de curaduría)
- Mejorar accesibilidad y experiencia móvil
- Añadir tests (especialmente reglas de seguridad)
- Documentar el código existente

### 2. Diseño y experiencia
- Proponer mejoras de interfaz manteniendo la estética archivística + pixel art
- Diseñar nuevos biomas de isla o variaciones de atriles/salas
- Mejorar la jerarquía visual de recepción, cajones y modales
- Crear iconografía o assets pixel art coherentes con el tono del proyecto
- Revisar contraste, legibilidad y flujo de los formularios (libro de visitas, solicitudes de compra, etc.)

### 3. Contenido y curaduría
- Proponer textos base, poemas, descripciones o piezas para el museo insignia
- Sugerir nuevos presets de tema (paletas)
- Ayudar a redactar o traducir textos de interfaz
- Crear ejemplos de museos públicos de buena calidad que sirvan de referencia

### 4. Comunidad y documentación
- Mejorar este archivo o el README
- Escribir guías para nuevos creadores
- Reportar problemas de usabilidad con claridad
- Ayudar a moderar o proponer mejores prácticas de convivencia en la red de museos

---

## Principios que pedimos respetar

1. **El visitante es ciudadano de primera clase**
   Nadie debe necesitar cuenta para recorrer museos, firmar el libro de visitas o explorar.

2. **La estética no es decoración**
   Cualquier cambio visual debe mantener la mezcla de archivo museográfico (papel pergamino, tipografía limpia, placas rectangulares) y pixel art nocturno.

3. **Aislamiento de datos personales**
   Nunca se deben exponer correos, WhatsApp u otros datos de contacto de compradores o visitantes en documentos públicos.

4. **Simplicidad sobre features**
   Preferimos pocas cosas bien resueltas antes que muchas opciones que saturen el espacio.

5. **El museo insignia (`museo404`) es especial**
   Tiene reglas propias de administración. Cualquier cambio que lo afecte debe ser discutido.

---

## Cómo empezar

### Reportar un problema
Abre un **Issue** usando la plantilla `[Bug]` en `.github/ISSUE_TEMPLATE/` y describe:
- Qué esperabas que pasara
- Qué pasó realmente
- Pasos para reproducirlo
- Si es posible, captura o vídeo corto

### Proponer una mejora o Isla Prestada
Abre un **Issue** usando la plantilla `[Mejora]` o `[Isla Prestada]` y explica:
- El problema o necesidad que resuelve
- Cómo se sentiría dentro del recorrido del museo
- Si afecta a visitantes, creadores o ambos

### Enviar código (Pull Request)

1. Lee [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) y [`README.md`](./README.md)
2. Haz fork del repositorio y crea una rama descriptiva:
   ```bash
   git checkout -b fix/libro-visitas-spam
   git checkout -b feat/nuevo-bioma-volcan
   git checkout -b docs/mejorar-readme
   ```
3. Haz commits claros y en presente:
   ```text
   Añade validación de longitud al apodo del libro de visitas
   Corrige posición de islas en vista mapa
   ```
4. Asegúrate de que el proyecto compile y pase verificaciones:
   ```bash
   npm install
   npm run lint
   npm run build
   npx eslint firestore.rules
   ```
   Si modificas `firestore.rules`, corre también los tests de emulador (`firestore.rules.test.ts`).
5. Abre el Pull Request hacia `main` y describe:
   - Qué cambia
   - Por qué
   - Cómo probarlo

---

## Estructura útil del proyecto

```text
src/
├── components/          # UI (Archipelago3D, RoomExplorer2D, MuseumEditor, LoanInviteModal...)
├── data/                # Temas, plantillas, personajes y contenido base
├── firebase/            # Red de museos, guestbook, solicitudes e islas prestadas
├── game/                # Audio, sprites, construcción de salas
├── storage/             # Estado local, copias JSON y mediaDb (IndexedDB)
├── three/               # Lógica Three.js
└── types/               # Tipos TypeScript (museum.ts es el corazón)
```

Archivos especialmente importantes:
- `src/types/museum.ts` → modelo de datos (museos, piezas, invitaciones de isla prestada)
- `firestore.rules` y `firestore.rules.test.ts` → seguridad e invariantes de red
- `src/components/MuseumEditor.tsx` → Taller Interno y modo invitado
- `src/components/LoanInviteModal.tsx` → flujo de aceptación de Isla Prestada
- `src/data/themes.ts` y `src/data/museumTemplates.ts` → presets de color y plantillas

---

## Guía práctica: Cómo diseñar y conectar un nuevo Bioma

Los biomas determinan la apariencia visual y arquitectónica de cada isla a lo largo del archipiélago. Un bioma completo debe coexistir armónicamente tanto en el mapa 2D interactivo como en la vista 3D en perspectiva y en las salas 2D explorables.

### 1. Registrar el tipo de bioma
Agrega el identificador del bioma al tipo de unión en `src/types/museum.ts`:
```typescript
export type IslandBiome =
  | 'forest'
  | 'observatory'
  | 'ice'
  | 'patio'
  | 'desert'
  | 'workshop'
  | 'volcano'   // Nuevo
  | 'crypt'     // Nuevo
  | 'coral';    // Nuevo
```

### 2. Configurar metadatos y etiquetas
En `src/data/initialContent.ts`, agrega el nombre legible y la descripción evocadora en `BIOME_LABELS`:
```typescript
export const BIOME_LABELS: Record<IslandBiome, { name: string; desc: string }> = {
  // ...
  volcano: { name: 'Caldera volcánica', desc: 'Rocas de basalto oscuro, cráter humeante y ríos de magma' },
};
```
En `src/components/MiniCompassRadar.tsx`, agrega el color representativo del bioma para el radar del compás:
```typescript
const BIOME_COLORS: Record<Island['biome'], string> = {
  // ...
  volcano: '#ff6b4a',
};
```

### 3. Conexión al Mapa 2D Isométrico
1. **Gradiente o patrón SVG**: En `src/components/ArchipelagoMap.tsx`, define los gradientes de superficie correspondientes en el bloque `<defs>`:
   ```xml
   <linearGradient id="volcano" x1="0" y1="0" x2="1" y2="1">
     <stop stopColor="#4a2522" />
     <stop offset="1" stopColor="#1e1014" />
   </linearGradient>
   ```
2. **Ilustración isométrica**: En `src/components/IslandArtworkSvg.tsx`, añade la rama de renderizado del bioma dentro de `IslandArtworkSvg`. Utiliza polígonos alineados a la rejilla isométrica base centrada en `(205, 110)`:
   - Capa de sombra elíptica inferior.
   - Caras de acantilado frontal y laterales.
   - Plataforma superior texturizada.
   - Estructura o landmark pixel-art distintivo (conos volcánicos, obeliscos, arrecifes, etc.).

### 4. Conexión a la Sala Explorable 2D (Tilemap)
En `src/game/roomBuilder.ts`, actualiza `getBiomeTileStyles()` para asignar los caracteres de pared (`W`), suelo (`.`) y si el bioma es exterior (`isOutdoor: true/false`):
```typescript
case 'coral':
  return {
    wallChar: 'W',
    floorChar: '.',
    isOutdoor: true,
    tileMap: {
      W: 'bush',
      '.': 'sand',
      C: 'path',
      D: 'door',
      X: 'exit_portal',
    },
  };
```

### 5. Conexión al Renderizador 3D (Three.js) y Canvas
1. **Terreno y Materiales 3D**: En `src/three/worldBuilder.ts`:
   - Configura la asignación de texturas de superficie (`topMat` y `pathMat`) según el bioma.
   - Añade el hito arquitectónico tridimensional (`landmark`) en la rama correspondiente, reutilizando geometrías y registrándolas en `trackGeo(...)` y `trackMat(...)`.
   - Añade elementos de vegetación o rocas decorativas (`colliders.push(...)`).
2. **Vista en Perspectiva 2.5D**: En `src/components/ArchipelagoPerspectiveCanvas.tsx`:
   - En la generación de props (`landmark` y decoraciones), agrega las coordenadas y escalas de los elementos periféricos.
   - En la fase de dibujado de hitos (`prop.kind === 'landmark'`), proyecta la silueta estilizada correspondiente al bioma.

### 6. Consideraciones de ciclo de vida y buenas prácticas
- **Gestión de Memoria GPU**: Nunca instancies texturas de Three.js de manera ad-hoc dentro del bucle de construcción; utiliza las compartidas en `ProceduralTextures` o regístralas en `trackMat`/`trackGeo` para que se liberen con `world.dispose()`.
- **Accesibilidad y Contraste**: Los textos y badges sobre las islas deben cumplir con ratios de contraste WCAG AA.
- **Verificación**: Ejecuta siempre `bun test`, `bun run lint` y `bun run build` para asegurar que ningún archivo presente tipos rotos o desalineaciones.

---

## Guías de estilo rápidas

### Código
- TypeScript estricto
- Componentes funcionales + hooks
- Nombres en español cuando describen dominio del museo (`Island`, `Room`, `GuestbookEntry`, `islasPrestadas`…), inglés cuando son técnicos genéricos
- Evitar dependencias nuevas sin justificación clara

### Diseño
- Mantener la paleta base y la tipografía (`Pixelify Sans` / `Press Start 2P` + sistema)
- Preferir separadores finos y placas rectangulares antes que píldoras redondeadas
- Los precios y estados comerciales deben sentirse museográficos, no de e-commerce

### Commits y PRs
- Un PR = una intención clara
- Si el cambio es grande, ábrelo como borrador (`Draft`) y ve comentando

---

## ¿No sabes por dónde empezar?

Revisa [`docs/ISSUES_INICIALES.md`](./docs/ISSUES_INICIALES.md), donde listamos los **8 primeros issues** listos para tomar, o directamente puedes:
- Revisar los Issues etiquetados como `good first issue`, `help wanted` o `isla-prestada`
- Mejorar textos de la interfaz y guías de onboarding
- Proponer un nuevo preset de tema o plantilla comunitaria
- Crear un museo público de ejemplo y contarnos qué se sintió raro al construirlo
- Simplemente recorrer el museo insignia y reportar fricciones

Todo eso cuenta.

---

## Canal de comunidad y tono

Este es un proyecto hecho con cuidado y obsesión estética.
Tratamos las contribuciones con respeto y pedimos lo mismo a cambio (consulta [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)).

- **Dudas antes de programar**: abre un Issue de pregunta o un hilo en **GitHub Discussions**.
- **Propuestas de gobernanza y red**: cualquier cambio que afecte reglas de visibilidad, convivencia o el museo insignia (`museo404`) se conversa en abierto antes de cerrarse.
- **Chat en tiempo real**: cuando se habilite el servidor comunitario (Discord / Matrix), el enlace oficial se publicará en la portada de `README.md`.

---

**Gracias por ayudar a que el archipiélago crezca.**
