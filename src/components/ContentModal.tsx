import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Share2, Compass, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { createPurchaseInquiry } from '../firebase/interactions';
import { retroAudio } from '../game/audio';
import { renderProceduralPainting } from '../game/spriteRenderer';
import { getMedia } from '../storage/mediaDb';
import { FrameStyle, InteractiveAppData, MuseumPiece, PaintingData } from '../types/museum';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

export type ModalPayload =
  | { kind: 'dialogue'; title: string; lines: string[]; subtitle?: string; piece?: MuseumPiece }
  | { kind: 'painting'; piece: MuseumPiece; painting: PaintingData }
  | { kind: 'app'; app: InteractiveAppData; piece?: MuseumPiece }
  | { kind: 'media'; piece: MuseumPiece }
  | { kind: 'link'; title: string; description: string; url: string; piece?: MuseumPiece };

interface ContentModalProps {
  payload: ModalPayload | null;
  frameStyle?: FrameStyle;
  museumId?: string;
  museumOwnerId?: string;
  museumIsPublic?: boolean;
  onSharePiece?: (piece: MuseumPiece) => void;
  onVisitSourceMuseum?: (sourceMuseumId: string) => void;
  onToast?: (msg: string) => void;
  onClose: () => void;
}

const PREFIXES = ['Auto', 'Crono', 'Neuro', 'Paleo', 'Linguo', 'Umbro', 'Aero', 'Somno', 'Astro', 'Gloso'];
const ROOTS = ['morfia', 'cronia', 'lalia', 'scopia', 'gnosis', 'feria', 'fagia', 'taxis', 'stasia', 'nomia'];
const DEFS = [
  'El acto de recordar una palabra olvidada justo antes de pronunciar otra equivocada.',
  'Fenómeno donde las letras impresas parecen pesar más en las páginas pares.',
  'Sensación de entrar a un cuarto vacío que fue diseñado exclusivamente para ti.',
  'Geometría secreta de las conversaciones que ocurren a medianoche en voz baja.',
  'Canto inaudible que producen los libros cuando se cierran bruscamente.',
];

const PROPHECIES = [
  '«La puerta que buscas no tiene cerradura: sólo espera que dejes de empujarla.»',
  '«En el minuto 404, todas las respuestas se vuelven preguntas más hermosas.»',
  '«Lo que no cabe en una palabra, desborda siempre en una mirada.»',
  '«No apresures el paso: el cuarto al que te diriges está terminando de nacer.»',
  '«El silencio del umbral contiene más tinta que diez enciclopedias.»',
];

const SALE_LABELS: Record<'for_sale' | 'reserved' | 'sold', { label: string; cls: string }> = {
  for_sale: {
    label: 'EN VENTA',
    cls: 'border-[#1d6873] bg-[#d9f0ec] text-[#114a53]',
  },
  reserved: {
    label: 'RESERVADA',
    cls: 'border-[#a2782e] bg-[#f7ecd0] text-[#704e14]',
  },
  sold: {
    label: 'VENDIDA',
    cls: 'border-[#7c3b2e] bg-[#f2ddd8] text-[#6d2a1c]',
  },
};

export const ContentModal: React.FC<ContentModalProps> = ({
  payload,
  frameStyle = 'archival',
  museumId = 'museo404',
  museumOwnerId = 'museo404',
  museumIsPublic = true,
  onSharePiece,
  onVisitSourceMuseum,
  onToast,
  onClose,
}) => {
  const dialogRef = useModalFocusTrap({ isOpen: Boolean(payload), onClose });
  const [lineIndex, setLineIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Estado de mini-apps
  const [genWord, setGenWord] = useState('LUMENCRONIA');
  const [genDef, setGenDef] = useState(
    'f. Medida del tiempo calculada exclusivamente por la sombra que proyecta una duda.'
  );
  const [oracleText, setOracleText] = useState(
    '«Todo lo que buscas ya está en el mapa, pero el mapa sólo se dibuja caminando.»'
  );
  const [morseStream, setMorseStream] = useState('');

  // Solicitud de compra inline
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [shippingLocation, setShippingLocation] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  // Multimedia desde IndexedDB o DataURL en la nube
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const paintingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePiece: MuseumPiece | undefined = payload?.piece;

  useEffect(() => {
    setInquiryOpen(false);
    setInquirySuccess(false);
    setInquiryError(null);
    setInquiryMessage('');
  }, [payload]);

  useEffect(() => {
    if (!payload || payload.kind !== 'dialogue') return;
    setLineIndex(0);
  }, [payload]);

  useEffect(() => {
    if (!payload || payload.kind !== 'dialogue') return;
    const current = payload.lines[lineIndex] ?? '';
    if (current.length > 280) {
      setTypedText(current);
      setIsTyping(false);
      return;
    }

    setTypedText('');
    setIsTyping(true);
    let idx = 0;
    const timer = window.setInterval(() => {
      idx += 1;
      setTypedText(current.slice(0, idx));
      if (idx % 2 === 0) retroAudio.playTextBlip();
      if (idx >= current.length) {
        window.clearInterval(timer);
        setIsTyping(false);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [payload, lineIndex]);

  useEffect(() => {
    let activeUrl: string | null = null;
    setMediaUrl(null);
    setMediaError(null);

    if (!payload) return;
    const piece =
      payload.kind === 'media' || payload.kind === 'painting' ? payload.piece : undefined;
    if (!piece) return;

    if (piece.mediaDataUrl) {
      setMediaUrl(piece.mediaDataUrl);
      return;
    }

    const mediaKey = piece.mediaKey;
    if (!mediaKey) return;

    let cancelled = false;
    getMedia(mediaKey).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setMediaError('No se encontró el archivo guardado en este navegador.');
        return;
      }
      activeUrl = URL.createObjectURL(blob);
      setMediaUrl(activeUrl);
    });

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [payload]);

  useEffect(() => {
    if (!payload || payload.kind !== 'painting' || mediaUrl) return;
    if (paintingCanvasRef.current) {
      renderProceduralPainting(paintingCanvasRef.current, payload.painting);
    }
  }, [payload, mediaUrl]);

  const handleAdvanceDialogue = () => {
    if (!payload || payload.kind !== 'dialogue') return;
    const current = payload.lines[lineIndex] ?? '';
    if (isTyping) {
      setTypedText(current);
      setIsTyping(false);
      return;
    }
    if (lineIndex + 1 < payload.lines.length) {
      setLineIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const pulseTelegraph = (type: 'DOT' | 'DASH') => {
    setMorseStream((prev) => prev + (type === 'DOT' ? ' • ' : ' ▬ '));
    retroAudio.playTone(type === 'DOT' ? 880 : 440, 'square', type === 'DOT' ? 0.06 : 0.18, 0.22);
  };

  useEffect(() => {
    if (!payload) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (payload.kind === 'dialogue' && (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space')) {
        if (e.code === 'Space' && (payload.lines[lineIndex]?.length || 0) > 280) return;
        e.preventDefault();
        handleAdvanceDialogue();
      } else if (payload.kind === 'app' && payload.app.interactiveType === 'telegraph') {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          pulseTelegraph('DOT');
        } else if (e.code === 'KeyX') {
          e.preventDefault();
          pulseTelegraph('DASH');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!payload) return null;

  const curatedFrom = activePiece?.curatedFrom;

  const modalShellClass =
    frameStyle === 'ornate'
      ? 'border-4 border-[#9f752b] bg-[#f4f0dc] shadow-[0_0_0_3px_#e2c56c,0_0_0_6px_#624312,0_20px_65px_rgba(0,0,0,0.62)]'
      : frameStyle === 'minimal'
        ? 'border border-[#1c343a]/35 bg-[#fafaf4] shadow-[0_20px_65px_rgba(0,0,0,0.48)]'
        : 'border-4 border-[#163d4a] bg-[#f1efd9] shadow-[0_0_0_3px_#e2c56c,0_20px_65px_rgba(0,0,0,0.58)]';

  const artworkMatClass =
    frameStyle === 'ornate'
      ? 'border-4 border-[#c9a34e] bg-[#16120c] p-5 shadow-inner'
      : frameStyle === 'minimal'
        ? 'border border-[#1c343a]/25 bg-[#eef0eb] p-4'
        : 'border-2 border-[#163d4a] bg-[#09202a] p-4';

  const artworkImgBorderClass =
    frameStyle === 'ornate'
      ? 'border-4 border-[#e1c875]'
      : frameStyle === 'minimal'
        ? 'border border-[#1c343a]/30'
        : 'border-4 border-[#bb9a51]';

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePiece) return;
    setInquiryError(null);

    const nameClean = buyerName.trim();
    const contactClean = buyerContact.trim();
    if (!nameClean) {
      setInquiryError('Escribe tu nombre completo.');
      return;
    }
    if (contactClean.length < 3) {
      setInquiryError('Incluye un correo electrónico o WhatsApp para contactarte.');
      return;
    }

    setSubmittingInquiry(true);
    try {
      await createPurchaseInquiry({
        museumId,
        museumOwnerId: museumId === 'museo404' ? 'museo404' : museumOwnerId,
        pieceId: activePiece.id,
        pieceTitle: activePiece.title,
        priceLabel: activePiece.priceLabel?.trim() || 'Consultar',
        buyerName: nameClean,
        buyerContact: contactClean,
        shippingLocation: shippingLocation.trim(),
        message: inquiryMessage.trim(),
      });
      setInquirySuccess(true);
      setInquiryOpen(false);
      retroAudio.playDiscovery();
      onToast?.('Solicitud de compra enviada al curador del museo.');
    } catch (err) {
      setInquiryError(
        err instanceof Error ? err.message : 'No se pudo enviar la solicitud.'
      );
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const renderCommerceSection = () => {
    if (!activePiece) return null;
    const status = activePiece.saleStatus || 'not_for_sale';
    if (status === 'not_for_sale') return null;

    const badge = SALE_LABELS[status];
    const hasPaymentUrl = Boolean(
      activePiece.paymentUrl && /^https?:\/\//i.test(activePiece.paymentUrl.trim())
    );
    const canSubmitRemoteInquiry = museumId === 'museo404' || museumIsPublic;

    return (
      <section className="mt-5 border border-[#163d4a]/25 bg-[#faf8eb] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`border px-2.5 py-0.5 text-[11px] font-bold tracking-wider ${badge.cls}`}
            >
              {badge.label}
            </span>
            {activePiece.priceLabel && (
              <span className="text-lg font-bold text-[#163d4a] tabular-nums">
                {activePiece.priceLabel}
              </span>
            )}
          </div>
          {activePiece.mediumOrSize && (
            <span className="text-xs font-medium text-[#4e7275]">
              {activePiece.mediumOrSize}
            </span>
          )}
        </div>

        {status === 'for_sale' && (
          <div className="mt-3.5 space-y-3 border-t border-[#163d4a]/15 pt-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              {hasPaymentUrl && (
                <a
                  href={activePiece.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#b25f37] px-4 py-2 text-[9px] text-[#fff9e5] transition-colors hover:bg-[#1d6873]"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>PAGAR / COMPRAR OBRA</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {canSubmitRemoteInquiry && !inquirySuccess && (
                <button
                  type="button"
                  onClick={() => setInquiryOpen((prev) => !prev)}
                  className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#1d6873] px-4 py-2 text-[9px] text-[#fff9e5] transition-colors hover:bg-[#b25f37]"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>{inquiryOpen ? 'OCULTAR FORMULARIO' : 'SOLICITAR COMPRA / RESERVAR'}</span>
                </button>
              )}
            </div>

            {!canSubmitRemoteInquiry && (
              <p className="text-xs text-[#507a78]">
                Las solicitudes de compra se habilitan cuando el museo es público en el directorio.
              </p>
            )}

            {inquirySuccess && (
              <div className="flex items-start gap-2 border border-[#1d6873]/40 bg-[#d9f0ec] px-3 py-2.5 text-sm text-[#114a53]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Tu solicitud fue enviada de forma privada al dueño de la obra. Te contactará por el medio que proporcionaste.
                </span>
              </div>
            )}

            {inquiryOpen && (
              <form
                onSubmit={handleInquirySubmit}
                className="space-y-3 border border-[#163d4a]/25 bg-white p-3.5"
              >
                <p className="text-xs leading-relaxed text-[#436569]">
                  Tus datos de contacto son privados y solo los verá el creador o curador responsable de esta obra.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#31555a]">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Tu nombre"
                      className="w-full border border-[#537c79] bg-[#faf8eb] px-2.5 py-1.5 text-sm text-[#183b42]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#31555a]">
                      Correo o WhatsApp *
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={buyerContact}
                      onChange={(e) => setBuyerContact(e.target.value)}
                      placeholder="correo@ejemplo.com o +52..."
                      className="w-full border border-[#537c79] bg-[#faf8eb] px-2.5 py-1.5 text-sm text-[#183b42]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-[#31555a]">
                      Ciudad / país de envío (opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={shippingLocation}
                      onChange={(e) => setShippingLocation(e.target.value)}
                      placeholder="Ej. Ciudad de México"
                      className="w-full border border-[#537c79] bg-[#faf8eb] px-2.5 py-1.5 text-sm text-[#183b42]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-[#31555a]">
                      Mensaje para el artista (opcional)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={inquiryMessage}
                      onChange={(e) => setInquiryMessage(e.target.value)}
                      placeholder="¿Quieres preguntar por envío, certificado o apartado?"
                      className="w-full border border-[#537c79] bg-[#faf8eb] px-2.5 py-1.5 text-sm text-[#183b42]"
                    />
                  </div>
                </div>
                {inquiryError && (
                  <p className="border border-[#b25f37]/40 bg-[#fae5dc] px-3 py-1.5 text-xs text-[#8a3118]">
                    {inquiryError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInquiryOpen(false)}
                    className="border border-[#163d4a]/30 bg-white px-3 py-1.5 text-xs text-[#31555a]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInquiry}
                    className="font-pixel border-2 border-[#183c49] bg-[#b25f37] px-4 py-1.5 text-[9px] text-[#fff9e5] hover:bg-[#1d6873] disabled:opacity-60"
                  >
                    {submittingInquiry ? 'ENVIANDO...' : 'ENVIAR SOLICITUD'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>
    );
  };

  const renderCuratedBanner = () => {
    if (!curatedFrom) return null;
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-2 border-[#1d6873]/40 bg-[#e4e9d3] px-3.5 py-2.5 text-xs text-[#193d46]">
        <span>
          Compartido desde <strong>«{curatedFrom.sourceMuseumTitle}»</strong> · por{' '}
          <strong>{curatedFrom.sourceAuthorName}</strong>
        </span>
        {onVisitSourceMuseum && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onVisitSourceMuseum(curatedFrom.sourceMuseumId);
            }}
            className="inline-flex items-center gap-1 border border-[#183c49] bg-[#1d6873] px-2.5 py-1 text-[11px] font-bold text-[#fff9e5] hover:bg-[#b25f37]"
          >
            <Compass className="h-3 w-3" />
            Visitar museo de origen
          </button>
        )}
      </div>
    );
  };

  const renderShareButton = () => {
    if (!activePiece || !onSharePiece) return null;
    return (
      <button
        type="button"
        onClick={() => onSharePiece(activePiece)}
        className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#183c49] bg-[#bd7544] px-3.5 py-2.5 text-[9px] text-[#fff9e5] transition-colors hover:bg-[#a24d2e]"
      >
        <Share2 className="h-3.5 w-3.5" />
        COMPARTIR EN MI MUSEO
      </button>
    );
  };

  const effectiveMediaUrl = mediaUrl || (payload.kind === 'media' && payload.piece.url ? payload.piece.url : null);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02141f]/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de contenido o interactivo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`museum-scroll relative max-h-[88vh] w-full max-w-[740px] overflow-y-auto p-6 text-[#1c343a] sm:p-8 ${modalShellClass}`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="float-right ml-4 flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-[#183c49] bg-[#1d6873] text-[#fff9e5] transition-colors hover:bg-[#b25f37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163d4a]"
        >
          <X className="h-4 w-4" />
        </button>

        {renderCuratedBanner()}

        {payload.kind === 'dialogue' && (
          <div>
            {payload.subtitle && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#507a78]">
                {payload.subtitle}
              </p>
            )}
            <h2 className="mb-4 text-balance text-2xl font-bold leading-tight text-[#a24d2e]">
              {payload.title}
            </h2>
            <div className="max-w-[65ch] whitespace-pre-wrap text-[17px] leading-[1.7] text-[#203b40]">
              {typedText}
            </div>
            {renderCommerceSection()}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#183c49]/15 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                {renderShareButton()}
                {payload.lines.length > 1 && (
                  <span className="text-xs text-[#507a78] tabular-nums">
                    Fragmento {lineIndex + 1} de {payload.lines.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleAdvanceDialogue}
                className="font-pixel ml-auto border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e5] transition-colors hover:bg-[#b25f37]"
              >
                {isTyping
                  ? 'COMPLETAR'
                  : lineIndex + 1 < payload.lines.length
                    ? 'SIGUIENTE [Z]'
                    : 'CERRAR [ENTER]'}
              </button>
            </div>
          </div>
        )}

        {payload.kind === 'painting' && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#507a78]">
              {payload.painting.year || 'Galería Visual'}
            </p>
            <h2 className="mb-4 text-balance text-2xl font-bold leading-tight text-[#a24d2e]">
              {payload.piece.title}
            </h2>
            <div className={`flex flex-col items-center ${artworkMatClass}`}>
              {mediaUrl ? (
                <img
                  src={mediaUrl}
                  alt={payload.piece.title}
                  className={`max-h-[55vh] w-auto max-w-full object-contain ${artworkImgBorderClass}`}
                />
              ) : (
                <canvas
                  ref={paintingCanvasRef}
                  width={160}
                  height={120}
                  className={`pixelated h-auto w-full max-w-[420px] bg-black ${artworkImgBorderClass}`}
                />
              )}
            </div>
            {payload.painting.palette?.length > 0 && !mediaUrl && (
              <div className="mt-4 flex items-center gap-2 text-xs text-[#507a78]">
                <span>Paleta cromática:</span>
                {payload.painting.palette.map((color, i) => (
                  <span
                    key={i}
                    className="inline-block h-3.5 w-3.5 border border-[#163d4a]"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
            {(payload.piece.body || payload.painting.desc) && (
              <p className="mt-4 max-w-[65ch] whitespace-pre-wrap text-[16px] leading-relaxed text-[#203b40]">
                {payload.piece.body || payload.painting.desc}
              </p>
            )}
            {renderCommerceSection()}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#183c49]/15 pt-4">
              {renderShareButton()}
              <button
                type="button"
                onClick={onClose}
                className="font-pixel ml-auto border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
              >
                CERRAR [ESC]
              </button>
            </div>
          </div>
        )}

        {payload.kind === 'app' && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#507a78]">
              {payload.app.subtitle}
            </p>
            <h2 className="mb-3 text-balance text-2xl font-bold leading-tight text-[#a24d2e]">
              {payload.app.title}
            </h2>
            <p className="mb-4 text-[16px] text-[#203b40]">{payload.app.desc}</p>

            {payload.app.interactiveType === 'word_generator' && (
              <div>
                <div className="border-2 border-[#bd9d50] bg-[#153c43] p-5 text-[#eff0d9]">
                  <h3 className="font-pixel mb-3 text-sm text-[#f8b800]">«{genWord}»</h3>
                  <p className="text-[16px] leading-relaxed">{genDef}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const word =
                        PREFIXES[Math.floor(Math.random() * PREFIXES.length)] +
                        ROOTS[Math.floor(Math.random() * ROOTS.length)];
                      const def = DEFS[Math.floor(Math.random() * DEFS.length)];
                      setGenWord(word.toUpperCase());
                      setGenDef(`f. ${def}`);
                      retroAudio.playDiscovery();
                    }}
                    className="font-pixel border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    GENERAR PALABRA
                  </button>
                  {renderShareButton()}
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-pixel border-2 border-[#183c49] bg-[#2a4a53] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    SALIR
                  </button>
                </div>
              </div>
            )}

            {payload.app.interactiveType === 'oracle' && (
              <div>
                <div className="border-2 border-[#bd9d50] bg-[#153c43] p-5 text-[#eff0d9]">
                  <p className="text-lg leading-relaxed text-[#f8d879]">{oracleText}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOracleText(PROPHECIES[Math.floor(Math.random() * PROPHECIES.length)]);
                      retroAudio.playFountain();
                    }}
                    className="font-pixel border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    CONSULTAR ORÁCULO
                  </button>
                  {renderShareButton()}
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-pixel border-2 border-[#183c49] bg-[#2a4a53] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    SALIR
                  </button>
                </div>
              </div>
            )}

            {payload.app.interactiveType === 'telegraph' && (
              <div>
                <div className="min-h-[76px] border-2 border-[#bd9d50] bg-[#153c43] p-4 font-mono text-base text-[#75e4dc]">
                  {morseStream || '[LISTO PARA TRANSMITIR...]'}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => pulseTelegraph('DOT')}
                    className="font-pixel border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    ● PUNTO [Z]
                  </button>
                  <button
                    type="button"
                    onClick={() => pulseTelegraph('DASH')}
                    className="font-pixel border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    ▬ RAYA [X]
                  </button>
                  <button
                    type="button"
                    onClick={() => setMorseStream('')}
                    className="font-pixel border-2 border-[#183c49] bg-[#45556a] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    LIMPIAR
                  </button>
                  {renderShareButton()}
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-pixel border-2 border-[#183c49] bg-[#2a4a53] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
                  >
                    SALIR
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {payload.kind === 'media' && (
          <div>
            {payload.piece.subtitle && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#507a78]">
                {payload.piece.subtitle}
              </p>
            )}
            <h2 className="mb-4 text-balance text-2xl font-bold leading-tight text-[#a24d2e]">
              {payload.piece.title}
            </h2>
            {payload.piece.body && (
              <p className="mb-4 max-w-[65ch] whitespace-pre-wrap text-[17px] leading-[1.7] text-[#203b40]">
                {payload.piece.body}
              </p>
            )}
            {mediaError && <p className="text-sm text-[#9a3412]">{mediaError}</p>}
            {effectiveMediaUrl && (payload.piece.type === 'image' || payload.piece.kind === 'image') && (
              <div className={`my-4 flex flex-col items-center ${artworkMatClass}`}>
                <img
                  src={effectiveMediaUrl}
                  alt={payload.piece.title}
                  className={`max-h-[60vh] max-w-full object-contain ${artworkImgBorderClass}`}
                />
              </div>
            )}
            {effectiveMediaUrl && (payload.piece.type === 'audio' || payload.piece.kind === 'audio') && (
              <audio controls src={effectiveMediaUrl} className="my-4 w-full" />
            )}
            {effectiveMediaUrl && (payload.piece.type === 'video' || payload.piece.kind === 'video') && (
              <video
                controls
                src={effectiveMediaUrl}
                className={`mx-auto my-4 max-h-[60vh] max-w-full ${artworkImgBorderClass}`}
              />
            )}
            {payload.piece.url && (
              <a
                href={payload.piece.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-sm font-bold text-[#fff9e5] hover:bg-[#b25f37]"
              >
                Abrir enlace externo <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {renderCommerceSection()}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#183c49]/15 pt-4">
              {renderShareButton()}
              <button
                type="button"
                onClick={onClose}
                className="font-pixel ml-auto border-2 border-[#183c49] bg-[#2a4a53] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
              >
                CERRAR [ESC]
              </button>
            </div>
          </div>
        )}

        {payload.kind === 'link' && (
          <div>
            <h2 className="mb-3 text-balance text-2xl font-bold leading-tight text-[#a24d2e]">
              {payload.title}
            </h2>
            <p className="mb-4 text-[16px] leading-relaxed text-[#203b40]">
              {payload.description}
            </p>
            <p className="mb-6 break-all text-sm text-[#507a78]">
              Destino: <strong className="text-[#163d4a]">{payload.url}</strong>
            </p>
            {renderCommerceSection()}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={payload.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
              >
                ABRIR ENLACE <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {renderShareButton()}
              <button
                type="button"
                onClick={onClose}
                className="font-pixel ml-auto border-2 border-[#183c49] bg-[#2a4a53] px-4 py-2.5 text-[10px] text-[#fff9e5] hover:bg-[#b25f37]"
              >
                VOLVER
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
