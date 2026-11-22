import React, { useEffect, useState } from 'react';
import { Code2, Compass, ExternalLink, Heart, Palette, Users, X } from 'lucide-react';
import { DonationConfig } from '../types/museum';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface SupportProjectModalProps {
  isOpen: boolean;
  activeMuseumId: string;
  activeMuseumTitle: string;
  activeMuseumAuthor: string;
  activeDonation?: DonationConfig;
  flagshipDonation?: DonationConfig;
  canEditActiveMuseum: boolean;
  onOpenEditorAppearance: () => void;
  onOpenGuide?: () => void;
  onClose: () => void;
}

function isSafeHttpUrl(url?: string): boolean {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

export const SupportProjectModal: React.FC<SupportProjectModalProps> = ({
  isOpen,
  activeMuseumId,
  activeMuseumTitle,
  activeMuseumAuthor,
  activeDonation,
  flagshipDonation,
  canEditActiveMuseum,
  onOpenEditorAppearance,
  onOpenGuide,
  onClose,
}) => {
  const dialogRef = useModalFocusTrap({ isOpen, onClose });
  const [tab, setTab] = useState<'donate' | 'contribute'>('donate');

  useEffect(() => {
    if (!isOpen) return;
    setTab('donate');
  }, [isOpen]);

  if (!isOpen) return null;

  const isFlagship = activeMuseumId === 'museo404';
  const primaryDonation = isFlagship ? flagshipDonation : activeDonation;
  const hasPrimaryDonation = Boolean(primaryDonation?.enabled && isSafeHttpUrl(primaryDonation?.url));
  const hasFlagshipBackup = Boolean(
    !isFlagship && flagshipDonation?.enabled && isSafeHttpUrl(flagshipDonation?.url)
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Apoyar y aportar al proyecto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02111a]/82 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-[740px] flex-col overflow-hidden border-[3px] border-[#163d4a] bg-[#f1efd9] text-[#1c343a] shadow-[0_0_0_3px_#e2c56c,0_24px_70px_rgba(0,0,0,0.62)]">
        {/* Cabecera */}
        <header className="flex items-start justify-between gap-4 border-b border-[#163d4a]/20 bg-[#e6e3ca] px-6 py-4">
          <div className="min-w-0">
            <p className="font-pixel flex items-center gap-2 text-[9px] tracking-wider text-[#8b3a1a]">
              <Heart className="h-3.5 w-3.5 shrink-0" />
              <span>SOSTENIBILIDAD Y COMUNIDAD ABIERTA</span>
            </p>
            <h2 className="mt-1.5 text-2xl font-bold leading-tight text-[#163d4a]">
              Apoyar y aportar a Museo 404
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#35575b]">
              Todo el acceso y la exploración son gratuitos. Puedes respaldar directamente a sus creadores o sumarte al desarrollo del proyecto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border-2 border-[#183c49] bg-[#1d6873] text-[#fff9e5] transition-colors hover:bg-[#b25f37]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Pestañas */}
        <div className="flex border-b border-[#163d4a]/20 bg-[#ebe8d1] px-6 pt-3">
          <button
            type="button"
            onClick={() => setTab('donate')}
            className={`mr-2 min-h-[44px] border border-b-0 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === 'donate'
                ? 'border-[#163d4a]/35 bg-[#f1efd9] text-[#8b3a1a]'
                : 'border-transparent bg-transparent text-[#35575b] hover:text-[#163d4a]'
            }`}
          >
            Apoyar con donación
          </button>
          <button
            type="button"
            onClick={() => setTab('contribute')}
            className={`border min-h-[44px] border-b-0 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === 'contribute'
                ? 'border-[#163d4a]/35 bg-[#f1efd9] text-[#8b3a1a]'
                : 'border-transparent bg-transparent text-[#35575b] hover:text-[#163d4a]'
            }`}
          >
            Aportar al proyecto
          </button>
        </div>

        {/* Contenido */}
        <div className="museum-scroll flex-1 overflow-y-auto px-6 py-5">
          {tab === 'donate' && (
            <div className="space-y-5">
              {/* Tarjeta principal del museo actual */}
              <section className="border-2 border-[#163d4a] bg-[#faf8eb] p-5 shadow-[6px_6px_0_rgba(22,61,74,0.1)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#507a78]">
                      {isFlagship ? 'PROYECTO PRINCIPAL' : `MUSEO VISITADO · POR ${activeMuseumAuthor.toUpperCase()}`}
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-[#163d4a]">
                      {activeMuseumTitle}
                    </h3>
                  </div>
                  {hasPrimaryDonation && primaryDonation?.platformLabel && (
                    <span className="border border-[#163d4a] bg-[#e6e3ca] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#163d4a]">
                      {primaryDonation.platformLabel}
                    </span>
                  )}
                </div>

                {hasPrimaryDonation && primaryDonation ? (
                  <div className="mt-4 space-y-4">
                    <p className="text-[15px] leading-relaxed text-[#25454b]">
                      {primaryDonation.note ||
                        'Si disfrutaste caminar por estas salas, puedes aportar directamente para mantener vivo el archivo, nuevas obras e infraestructura.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={primaryDonation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#b25f37] px-5 py-3 text-[10px] text-[#fff9e5] transition-colors hover:bg-[#1d6873]"
                      >
                        <Heart className="h-3.5 w-3.5" />
                        <span>APOYAR EN {(primaryDonation.platformLabel || 'ENLACE').toUpperCase()}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <span className="text-xs text-[#507a78]">
                        Se abrirá en una pestaña segura del proveedor elegido.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 border-t border-[#163d4a]/15 pt-4">
                    <p className="text-sm leading-relaxed text-[#3a5c60]">
                      {isFlagship
                        ? 'El enlace directo de donaciones para Museo 404 todavía no ha sido publicado por el curador principal.'
                        : `${activeMuseumAuthor} aún no ha enlazado una cuenta de PayPal, Ko-fi o Mercado Pago para este museo.`}
                    </p>
                    {canEditActiveMuseum && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenEditorAppearance();
                        }}
                        className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#1d6873] px-4 py-2 text-[9px] text-[#fff9e5] hover:bg-[#b25f37]"
                      >
                        <span>CONFIGURAR MI ENLACE DE DONACIÓN</span>
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* Respaldar infraestructura abierta cuando se visita otro museo */}
              {hasFlagshipBackup && flagshipDonation && (
                <section className="border border-[#163d4a]/30 bg-[#e9e6d0] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#1d6873]">
                        INFRAESTRUCTURA ABIERTA · MUSEO 404 siNOMBRE
                      </p>
                      <p className="mt-1 text-sm text-[#2a494f]">
                        {flagshipDonation.note ||
                          'Ayuda a sostener el alojamiento y el desarrollo abierto de esta plataforma para todos los creadores.'}
                      </p>
                    </div>
                    <a
                      href={flagshipDonation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel inline-flex shrink-0 items-center gap-1.5 border border-[#183c49] bg-[#1d6873] px-3.5 py-2 text-[9px] text-[#fff9e5] hover:bg-[#b25f37]"
                    >
                      <span>{flagshipDonation.platformLabel || 'APOYAR'}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </section>
              )}

              <p className="text-xs leading-relaxed text-[#507a78]">
                Las aportaciones son 100% voluntarias y se procesan directamente en la plataforma del creador (PayPal, Ko-fi o Mercado Pago) sin intermediarios ni comisiones del museo.
              </p>
            </div>
          )}

          {tab === 'contribute' && (
            <div className="space-y-5">
              <div className="border-2 border-[#163d4a] bg-[#faf8eb] p-5 shadow-[6px_6px_0_rgba(22,61,74,0.08)]">
                <p className="text-xs font-bold uppercase tracking-widest text-[#1d6873]">
                  ¿ALGUIEN QUIERE CONSTRUIR MUSEO 404 CONMIGO?
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-[#223f45]">
                  No queremos construir otro escaparate donde todos compitan por llamar la atención. Queremos un lugar donde podamos <strong>prestarnos espacios, descubrirnos y ayudarnos a existir</strong>.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#2d4e53]">
                  El proyecto es <strong>gratuito, abierto y vive para crecer en comunidad y en GitHub</strong>. Si desarrollas en React/TypeScript/Three.js, haces pixel art, diseñas o curas colecciones, puedes revisar <code>CONTRIBUTING.md</code>, proponer mejoras o prestarle una isla a alguien que apenas comienza.
                </p>
                <p className="mt-2 text-sm font-bold text-[#a24d2e]">Primero nosotros.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border border-[#163d4a]/25 bg-[#faf8eb] p-4">
                  <div className="flex items-center gap-2 text-[#a24d2e]">
                    <Code2 className="h-4 w-4 shrink-0" />
                    <h3 className="text-base font-bold">Código y mundo 3D</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#33555a]">
                    Mejoras en Three.js, exploración 2D, accesibilidad en móviles, sistema de islas prestadas y reglas de seguridad (<code>CONTRIBUTING.md</code>).
                  </p>
                </div>

                <div className="border border-[#163d4a]/25 bg-[#faf8eb] p-4">
                  <div className="flex items-center gap-2 text-[#a24d2e]">
                    <Palette className="h-4 w-4 shrink-0" />
                    <h3 className="text-base font-bold">Diseño y biomas</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#33555a]">
                    Nuevas paletas cromáticas, siluetas de islas, mobiliario 2D de pixel-art y marcos expositivos para curadores.
                  </p>
                </div>

                <div className="border border-[#163d4a]/25 bg-[#faf8eb] p-4">
                  <div className="flex items-center gap-2 text-[#a24d2e]">
                    <Compass className="h-4 w-4 shrink-0" />
                    <h3 className="text-base font-bold">Prestar islas y curar</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#33555a]">
                    Crea tu propio archipiélago, genera invitaciones mágicas para prestar una isla a proyectos emergentes y mantén siempre visible su autoría.
                  </p>
                </div>

                <div className="border border-[#163d4a]/25 bg-[#faf8eb] p-4">
                  <div className="flex items-center gap-2 text-[#a24d2e]">
                    <Users className="h-4 w-4 shrink-0" />
                    <h3 className="text-base font-bold">Comunidad y voz</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#33555a]">
                    Firma los libros de visitas en recepción y salas, comparte tus ideas en GitHub Issues/Discussions y ayuda a decidir el rumbo del museo.
                  </p>
                </div>
              </div>

              <div className="border border-[#163d4a]/30 bg-[#e9e6d0] p-4">
                <p className="font-pixel text-[9px] text-[#163d4a]">
                  CANAL DE COMUNIDAD Y DOCUMENTOS CLAVE
                </p>
                <p className="mt-1.5 text-sm text-[#223f45]">
                  Encuentra <code>README.md</code>, <code>CODE_OF_CONDUCT.md</code>, <code>CONTRIBUTING.md</code> y los primeros 8 issues públicos en <code>docs/ISSUES_INICIALES.md</code>.
                </p>
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenGuide();
                    }}
                    className="font-pixel mt-3 inline-flex items-center gap-2 border border-[#183c49] bg-[#1d6873] px-3.5 py-2 text-[9px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    <span>LEER MANIFIESTO Y GUÍA EN 3 MINUTOS</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
