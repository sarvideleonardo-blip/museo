import React, { useEffect, useState } from 'react';
import { BookOpen, Code2, Compass, Heart, KeyRound, Pencil, Sparkles, X } from 'lucide-react';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface AboutGuideModalProps {
  isOpen: boolean;
  canEditActiveMuseum: boolean;
  onOpenDirectory: () => void;
  onOpenInviteModal: () => void;
  onOpenEditor: () => void;
  onOpenCreateMuseum?: () => void;
  onOpenSupport: () => void;
  onClose: () => void;
}

type GuideTab = 'about' | 'how' | 'editor' | 'opensource';

export const AboutGuideModal: React.FC<AboutGuideModalProps> = ({
  isOpen,
  canEditActiveMuseum,
  onOpenDirectory,
  onOpenInviteModal,
  onOpenEditor,
  onOpenCreateMuseum,
  onOpenSupport,
  onClose,
}) => {
  const [tab, setTab] = useState<GuideTab>('about');
  const dialogRef = useModalFocusTrap({ isOpen, onClose });

  useEffect(() => {
    if (!isOpen) return;
    setTab('about');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Acerca de MUSEO 404 y guía de uso"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02111a]/82 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[89vh] w-full max-w-[780px] flex-col overflow-hidden border-[3px] border-[#163d4a] bg-[#f1efd9] text-[#1c343a] shadow-[0_0_0_3px_#e2c56c,0_24px_70px_rgba(0,0,0,0.62)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#163d4a]/20 bg-[#e6e3ca] px-6 py-4">
          <div className="min-w-0">
            <p className="font-pixel flex items-center gap-2 text-[9px] tracking-wider text-[#8b3a1a]">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>ARCHIVO VIVO · GUÍA DE USO</span>
            </p>
            <h2 className="mt-1.5 text-2xl font-bold leading-tight text-[#163d4a]">
              MUSEO 404
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#35575b]">
              Tu museo. Tus reglas. Nuestra comunidad.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border-2 border-[#183c49] bg-[#1d6873] text-[#fff9e5] transition-colors hover:bg-[#b25f37]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Pestañas */}
        <nav
          aria-label="Secciones de la guía"
          className="flex flex-wrap border-b border-[#163d4a]/20 bg-[#ebe8d1] px-6 pt-3"
        >
          {(
            [
              { id: 'about', label: 'Manifiesto' },
              { id: 'how', label: 'En 3 minutos' },
              { id: 'editor', label: 'Taller Interno' },
              { id: 'opensource', label: 'Comunidad' },
            ] as { id: GuideTab; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`mr-2 min-h-[44px] border border-b-0 px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === item.id
                  ? 'border-[#163d4a]/35 bg-[#f1efd9] text-[#8b3a1a]'
                  : 'border-transparent bg-transparent text-[#35575b] hover:text-[#163d4a]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="museum-scroll flex-1 overflow-y-auto px-6 py-5">
          {tab === 'about' && (
            <article className="space-y-4 text-[15px] leading-relaxed text-[#223f45]">
              <p>
                No sé exactamente en qué se va a convertir esto.
                <br />
                Por ahora es un proyecto pequeño, gratuito y abierto. Una idea que tenía ganas de salir de mi computadora y encontrar personas que quisieran utilizarla, modificarla y hacerla crecer.
              </p>

              <p>
                <strong>MUSEO 404 es una red de museos independientes.</strong>
                <br />
                Cada persona puede construir su propio espacio y mostrar prácticamente cualquier cosa: pintura, fotografía, música, escritura, colecciones, proyectos, experimentos, ideas o cosas que todavía no tienen nombre.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border border-[#163d4a]/25 bg-[#faf8eb] p-4">
                  <p className="text-sm font-bold text-[#a24d2e]">¿Te gusta la música?</p>
                  <p className="mt-1 text-sm text-[#2d4e53]">
                    Construye salas con tus listas curadas. Comparte lo que escuchas. Invita a un DJ. Organiza una sesión.
                  </p>
                </div>
                <div className="border border-[#163d4a]/25 bg-[#faf8eb] p-4">
                  <p className="text-sm font-bold text-[#a24d2e]">¿Eres artista?</p>
                  <p className="mt-1 text-sm text-[#2d4e53]">
                    Expón tus obras. Invita a otros creadores. Presta una sala a alguien que apenas comienza. Usa tu alcance para que proyectos desconocidos lleguen más lejos.
                  </p>
                </div>
              </div>

              <p className="border-y border-[#b25f37]/45 bg-[#e9e6d0] px-4 py-3 font-semibold text-[#163d4a]">
                Sé esa persona que te hubiera gustado tener de apoyo al principio.
              </p>

              <p>
                ¿Tienes un restaurante, una colección, una obsesión o algo que simplemente te encanta? También tiene lugar aquí.
              </p>

              <p>
                No necesitas ser famoso, profesional ni tener algo terminado. Puedes hacer tu museo como quieras. Puedes modificarlo, experimentarlo y usarlo a tu manera.
              </p>

              <p>
                El proyecto es gratuito y queremos mantenerlo abierto. Estará en GitHub para que cualquiera pueda participar en su desarrollo. Y hay algo que nos importa especialmente: que la comunidad tenga voz en las decisiones importantes. No queremos que un solo administrador tenga el poder absoluto de decidir quién puede existir aquí y quién no.
              </p>

              <section className="border-2 border-[#163d4a] bg-[#faf8eb] p-5 shadow-[6px_6px_0_rgba(22,61,74,0.1)]">
                <h3 className="text-lg font-bold text-[#163d4a]">¿Por qué hacerlo?</h3>
                <p className="mt-2">
                  Porque hay demasiadas cosas interesantes escondidas. Una playlist construida durante diez años. Una colección que nadie conoce. Una persona que hace cosas increíbles y todavía no encuentra dónde mostrarlas.
                </p>
                <p className="mt-2">
                  No queremos construir otro escaparate donde todos compitan por llamar la atención. Queremos un lugar donde podamos prestarnos espacios, descubrirnos y ayudarnos a existir.
                </p>
                <p className="mt-2">
                  No es una solución mágica. Es una herramienta sencilla, visible y modificable. Puede crecer, cambiar, equivocarse y convertirse en algo que todavía no imaginamos.
                </p>
                <p className="mt-3 font-bold text-[#a24d2e]">
                  Primero nosotros.
                  <br />
                  Bienvenido a MUSEO 404.
                </p>
              </section>
            </article>
          )}

          {tab === 'how' && (
            <div className="space-y-4">
              <div className="border-2 border-[#163d4a] bg-[#faf8eb] p-4 shadow-[5px_5px_0_rgba(22,61,74,0.09)]">
                <p className="font-pixel text-[9px] text-[#a24d2e]">
                  INICIO RÁPIDO · MENOS DE 3 MINUTOS
                </p>
                <h3 className="mt-1.5 text-xl font-bold text-[#163d4a]">
                  Cómo publicar tu primer museo hoy
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="border border-[#163d4a]/20 bg-[#f1efd9] p-3">
                    <p className="font-pixel text-[8px] text-[#1d6873]">MINUTO 1</p>
                    <p className="mt-1 text-sm font-bold text-[#163d4a]">Elige plantilla</p>
                    <p className="mt-0.5 text-xs text-[#2d4e53]">
                      Música, menú, galería o archivo en blanco desde «Crear mi museo».
                    </p>
                  </div>
                  <div className="border border-[#163d4a]/20 bg-[#f1efd9] p-3">
                    <p className="font-pixel text-[8px] text-[#1d6873]">MINUTO 2</p>
                    <p className="mt-1 text-sm font-bold text-[#163d4a]">Personaliza y publica</p>
                    <p className="mt-0.5 text-xs text-[#2d4e53]">
                      Ponle título, paleta de cielo/océano y decide si aparece en el directorio.
                    </p>
                  </div>
                  <div className="border border-[#163d4a]/20 bg-[#f1efd9] p-3">
                    <p className="font-pixel text-[8px] text-[#1d6873]">MINUTO 3</p>
                    <p className="mt-1 text-sm font-bold text-[#163d4a]">Sube o presta</p>
                    <p className="mt-0.5 text-xs text-[#2d4e53]">
                      Carga 3 piezas iniciales o genera un enlace mágico para prestar una isla.
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-bold text-[#163d4a]">Recorrido completo del archipiélago</h3>
              <ol className="space-y-3">
                {[
                  {
                    n: '1',
                    title: 'Explorar',
                    text: 'Entra al directorio. Visita museos de otras personas. Cada uno tiene su propia identidad.',
                  },
                  {
                    n: '2',
                    title: 'Crear tu museo',
                    text: 'Configura nombre, colores, avatar y la forma en que quieres presentarte. No hay plantilla obligatoria.',
                  },
                  {
                    n: '3',
                    title: 'Agregar creaciones',
                    text: 'Sube obras, textos, audios, procesos o experimentos. No hace falta que esté terminado.',
                  },
                  {
                    n: '4',
                    title: 'Organizar',
                    text: 'Decide el orden, las islas y la experiencia. Tú decides cómo se recorre tu universo.',
                  },
                  {
                    n: '5',
                    title: 'Conectar y prestar',
                    text: 'MUSEO 404 es una red. Puedes descubrir otros museos y, más importante, prestar islas a otras personas para que muestren su trabajo dentro de tu espacio (y viceversa).',
                  },
                  {
                    n: '6',
                    title: 'Administrar',
                    text: 'Vuelve cuando quieras. Tu museo puede evolucionar contigo.',
                  },
                ].map((step) => (
                  <li
                    key={step.n}
                    className="flex gap-3.5 border border-[#163d4a]/25 bg-[#faf8eb] p-4"
                  >
                    <span className="font-pixel flex h-7 w-7 shrink-0 items-center justify-center border border-[#183c49] bg-[#1d6873] text-[10px] text-[#fff9e5] tabular-nums">
                      {step.n}
                    </span>
                    <div>
                      <strong className="block text-base text-[#163d4a]">{step.title}</strong>
                      <p className="mt-0.5 text-sm leading-relaxed text-[#2d4e53]">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="border-2 border-[#b25f37] bg-[#e9e6d0] p-4">
                <p className="font-pixel text-[9px] text-[#a24d2e]">CONSEJO</p>
                <p className="mt-1.5 text-sm font-medium text-[#1c343a]">
                  No esperes a tenerlo perfecto. Empieza con tres piezas. Visita otros museos. Presta una isla. Sé generoso.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {onOpenCreateMuseum && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCreateMuseum();
                    }}
                    className="font-pixel inline-flex min-h-[42px] items-center gap-2 border-2 border-[#183c49] bg-[#b25f37] px-4 py-2 text-[9px] text-[#fff9e5] hover:bg-[#1d6873]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>CREAR MI MUSEO AHORA</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDirectory();
                  }}
                  className="font-pixel inline-flex min-h-[42px] items-center gap-2 border-2 border-[#183c49] bg-[#1d6873] px-4 py-2 text-[9px] text-[#fff9e5] hover:bg-[#b25f37]"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>EXPLORAR DIRECTORIO</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInviteModal();
                  }}
                  className="font-pixel inline-flex min-h-[42px] items-center gap-2 border-2 border-[#183c49] bg-[#faf8eb] px-4 py-2 text-[9px] text-[#163d4a] hover:bg-[#e6e3ca]"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>TENGO INVITACIÓN DE ISLA</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'editor' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-[#163d4a]">Cómo usar el Taller Interno</h3>
              <ol className="space-y-3">
                {[
                  {
                    n: '1',
                    title: 'Nombre y colores',
                    text: 'Clic en ✎ EDITAR MUSEO → cambia el título, el estilo de islas y la paleta.',
                  },
                  {
                    n: '2',
                    title: 'Crear o prestar una isla',
                    text: 'Botón “+ Nueva isla” → dale un nombre. En museos en la nube también puedes generar un enlace mágico para prestar esa isla a otro creador.',
                  },
                  {
                    n: '3',
                    title: 'Agregar una pieza',
                    text: 'Entra a la isla → elige una sala → “Cargar pieza” → sube imagen, texto, audio o enlace.',
                  },
                  {
                    n: '4',
                    title: 'Organizar o borrar',
                    text: 'Ajusta la posición X/Y de cada isla en el mapa y edita o elimina piezas cuando quieras.',
                  },
                  {
                    n: '5',
                    title: 'Guardar y migrar',
                    text: 'En el museo local los cambios se guardan solos en este navegador. Usa Exportar copia / Importar copia para llevarte el museo completo (incluyendo islas prestadas) a otro dispositivo.',
                  },
                ].map((step) => (
                  <li
                    key={step.n}
                    className="flex gap-3.5 border border-[#163d4a]/25 bg-[#faf8eb] p-4"
                  >
                    <span className="font-pixel flex h-7 w-7 shrink-0 items-center justify-center border border-[#183c49] bg-[#b25f37] text-[10px] text-[#fff9e5] tabular-nums">
                      {step.n}
                    </span>
                    <div>
                      <strong className="block text-base text-[#163d4a]">{step.title}</strong>
                      <p className="mt-0.5 text-sm leading-relaxed text-[#2d4e53]">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {canEditActiveMuseum && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditor();
                  }}
                  className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[9px] text-[#fff9e5] hover:bg-[#b25f37]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>ABRIR TALLER INTERNO</span>
                </button>
              )}
            </div>
          )}

          {tab === 'opensource' && (
            <article className="space-y-4 text-[15px] leading-relaxed text-[#223f45]">
              <div className="border-2 border-[#163d4a] bg-[#faf8eb] p-5 shadow-[6px_6px_0_rgba(22,61,74,0.1)]">
                <p className="font-pixel flex items-center gap-2 text-[9px] text-[#a24d2e]">
                  <Code2 className="h-3.5 w-3.5" />
                  <span>CONVOCATORIA ABIERTA · GITHUB</span>
                </p>
                <h3 className="mt-2 text-xl font-bold text-[#163d4a]">
                  ¿Alguien quiere construir MUSEO 404 conmigo?
                </h3>
                <p className="mt-3">
                  MUSEO 404 es una red de museos independientes donde cada persona puede construir su espacio y mostrar pintura, fotografía, música, escritura, colecciones, experimentos o ideas que todavía no tienen nombre.
                </p>
                <p className="mt-2.5">
                  La idea principal es simple pero importante: <strong>prestarnos espacios</strong>. Que alguien pueda prestar una sala o isla de su museo a otra persona para que muestre su trabajo. Que no sea solo un escaparate individual, sino una red donde nos ayudemos a existir.
                </p>
                <p className="mt-2.5">
                  El proyecto es <strong>gratuito, abierto y quiere vivir en GitHub</strong>. No buscamos que nadie trabaje gratis para nadie: buscamos personas a las que les guste la idea y quieran participar, proponer, romper cosas y construirlas mejor.
                </p>
                <p className="mt-2.5">
                  Si desarrollas (React, TypeScript, Three.js, backend), diseñas, curas colecciones o simplemente sientes que esto resuena contigo: cualquier ayuda, idea o crítica es bienvenida.
                </p>
                <p className="mt-3 font-bold text-[#a24d2e]">Primero nosotros.</p>
              </div>

              <section className="border border-[#163d4a]/30 bg-[#e9e6d0] p-4">
                <p className="font-pixel text-[9px] text-[#163d4a]">
                  CANAL DE COMUNIDAD Y PRIMEROS ISSUES
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#223f45]">
                  La conversación sobre el rumbo de MUSEO 404 vive en abierto dentro del repositorio:
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-[#223f45]">
                  <li>
                    • <strong>Guía completa</strong>: revisa <code>README.md</code> y <code>CONTRIBUTING.md</code>.
                  </li>
                  <li>
                    • <strong>8 issues iniciales listos para tomar</strong>: consulta <code>docs/ISSUES_INICIALES.md</code> (Isla Prestada, editor móvil, accesibilidad, Three.js).
                  </li>
                  <li>
                    • <strong>Acuerdos y debates</strong>: lee <code>CODE_OF_CONDUCT.md</code> y participa en GitHub Issues y Discussions antes de tomar decisiones que afecten a la red.
                  </li>
                </ul>
              </section>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSupport();
                  }}
                  className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#b25f37] px-4 py-2.5 text-[9px] text-[#fff9e5] hover:bg-[#1d6873]"
                >
                  <Heart className="h-3.5 w-3.5" />
                  <span>APOYAR CON DONACIÓN O APORTAR</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInviteModal();
                  }}
                  className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#faf8eb] px-4 py-2.5 text-[9px] text-[#163d4a] hover:bg-[#e6e3ca]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>PROBAR ISLA PRESTADA</span>
                </button>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
};
