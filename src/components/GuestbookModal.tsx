import React, { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { BookOpen, EyeOff, Send, Trash2, X } from 'lucide-react';
import {
  createGuestbookEntry,
  deleteGuestbookEntry,
  fetchGuestbookEntries,
  hideGuestbookEntry,
} from '../firebase/interactions';
import { retroAudio } from '../game/audio';
import { GuestbookEntry } from '../types/museum';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface GuestbookModalProps {
  isOpen: boolean;
  museumId: string;
  museumTitle: string;
  museumIsPublic: boolean;
  islandId: string;
  roomId: string;
  scopeLabel: string;
  authUser: User | null;
  canModerate: boolean;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

const NICK_KEY = 'museo404_guest_nickname_v1';

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return 'Reciente';
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Reciente';
  }
}

export const GuestbookModal: React.FC<GuestbookModalProps> = ({
  isOpen,
  museumId,
  museumTitle,
  museumIsPublic,
  islandId,
  roomId,
  scopeLabel,
  authUser,
  canModerate,
  onClose,
  onToast,
}) => {
  const dialogRef = useModalFocusTrap({ isOpen, onClose });
  const [scopeFilter, setScopeFilter] = useState<'room' | 'all'>(
    roomId === 'reception' ? 'all' : 'room'
  );
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nickname, setNickname] = useState(() => {
    try {
      return localStorage.getItem(NICK_KEY) || '';
    } catch {
      return '';
    }
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setScopeFilter(roomId === 'reception' ? 'all' : 'room');
    setFormError(null);
    if (!nickname && authUser?.displayName) {
      setNickname(authUser.displayName.slice(0, 40));
    }
  }, [isOpen, roomId, authUser?.displayName, nickname]);

  const loadEntries = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchGuestbookEntries({
        museumId,
        roomId: scopeFilter === 'room' ? roomId : null,
        maxItems: 50,
      });
      setEntries(list);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'No se pudo cargar el libro de visitas.'
      );
    } finally {
      setLoading(false);
    }
  }, [isOpen, museumId, roomId, scopeFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const canAcceptSignatures = museumId === 'museo404' || museumIsPublic;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanNick = nickname.trim();
    const cleanMsg = message.trim();
    if (!cleanNick) {
      setFormError('Escribe un apodo o nombre para firmar.');
      return;
    }
    if (!cleanMsg) {
      setFormError('Escribe tu comentario antes de publicar.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createGuestbookEntry({
        museumId,
        islandId,
        roomId,
        scopeLabel,
        nickname: cleanNick,
        message: cleanMsg,
      });
      try {
        localStorage.setItem(NICK_KEY, cleanNick);
      } catch {
        // ignorar
      }
      setMessage('');
      setEntries((prev) => [created, ...prev]);
      retroAudio.playDiscovery();
      onToast?.('Tu firma quedó registrada en el libro de visitas.');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo registrar tu comentario.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleHide = async (entryId: string) => {
    try {
      await hideGuestbookEntry(entryId);
      setEntries((prev) => prev.filter((item) => item.id !== entryId));
      onToast?.('Comentario ocultado del libro público.');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'No se pudo ocultar el comentario.');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteGuestbookEntry(entryId);
      setEntries((prev) => prev.filter((item) => item.id !== entryId));
      onToast?.('Comentario eliminado.');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'No se pudo eliminar el comentario.');
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Libro de visitas del museo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02111a]/82 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden border-[3px] border-[#163d4a] bg-[#f1efd9] text-[#1c343a] shadow-[0_0_0_3px_#e2c56c,0_24px_70px_rgba(0,0,0,0.62)]">
        {/* Cabecera editorial */}
        <header className="flex items-start justify-between gap-4 border-b border-[#163d4a]/20 bg-[#e6e3ca] px-6 py-4">
          <div className="min-w-0">
            <p className="font-pixel flex items-center gap-2 text-[9px] tracking-wider text-[#1d6873]">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>LIBRO DE VISITAS · {museumTitle.toUpperCase()}</span>
            </p>
            <h2 className="mt-1.5 text-2xl font-bold leading-tight text-[#8b3a1a]">
              {scopeLabel}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#35575b]">
              Deja una impresión, un saludo o una nota de lectura. Abierto a cualquier visitante sin registro.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar libro de visitas"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border-2 border-[#183c49] bg-[#1d6873] text-[#fff9e5] transition-colors hover:bg-[#b25f37]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Cuerpo */}
        <div className="museum-scroll flex-1 overflow-y-auto px-6 py-5">
          {/* Formulario de firma */}
          {canAcceptSignatures ? (
            <form
              onSubmit={handleSubmit}
              className="mb-6 border border-[#163d4a]/25 bg-[#faf8eb] p-4 shadow-[4px_4px_0_rgba(22,61,74,0.08)]"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[210px_minmax(0,1fr)]">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#42666b]">
                    Apodo libre
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Ej. Visitante nocturno"
                    className="w-full border border-[#537c79] bg-white px-3 py-2 text-sm text-[#183b42]"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-[#42666b]">
                    <label className="font-semibold uppercase tracking-wide">
                      Comentario para «{scopeLabel}»
                    </label>
                    <span className="tabular-nums">{message.length}/400</span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="¿Qué te pareció esta sala o el recorrido por el archipiélago?"
                    className="w-full border border-[#537c79] bg-white px-3 py-2 text-sm text-[#183b42]"
                  />
                </div>
              </div>

              {formError && (
                <p className="mt-2 border border-[#b25f37]/40 bg-[#fae5dc] px-3 py-1.5 text-xs font-medium text-[#8a3118]">
                  {formError}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#507a78]">
                  Se registrará en: <strong className="text-[#163d4a]">{scopeLabel}</strong>
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="font-pixel inline-flex items-center gap-2 border-2 border-[#183c49] bg-[#1d6873] px-4 py-2 text-[9px] text-[#fff9e5] transition-colors hover:bg-[#b25f37] disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? 'FIRMANDO...' : 'FIRMAR LIBRO'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-6 border border-[#163d4a]/25 bg-[#e6e3ca] px-4 py-3 text-sm text-[#2c4e54]">
              Este museo está en modo privado. Cuando el creador lo marque como visible en el directorio público, los visitantes podrán dejar comentarios aquí.
            </div>
          )}

          {/* Barra de filtro de sala vs todo el museo */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#163d4a]/15 pb-2.5">
            <h3 className="font-pixel text-[9px] tracking-wide text-[#163d4a]">
              FIRMAS RECIENTES ({entries.length})
            </h3>
            {roomId !== 'reception' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setScopeFilter('room')}
                  className={`border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    scopeFilter === 'room'
                      ? 'border-[#163d4a] bg-[#1d6873] text-[#fff9e5]'
                      : 'border-[#163d4a]/30 bg-white/60 text-[#355a60] hover:bg-white'
                  }`}
                >
                  Esta sala
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className={`border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    scopeFilter === 'all'
                      ? 'border-[#163d4a] bg-[#1d6873] text-[#fff9e5]'
                      : 'border-[#163d4a]/30 bg-white/60 text-[#355a60] hover:bg-white'
                  }`}
                >
                  Todo el museo
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-[#507a78]">
              Abriendo páginas del libro de visitas...
            </p>
          ) : loadError ? (
            <p className="border border-[#b25f37]/40 bg-[#fae5dc] px-4 py-3 text-sm text-[#8a3118]">
              {loadError}
            </p>
          ) : entries.length === 0 ? (
            <div className="border border-dashed border-[#163d4a]/30 bg-white/40 px-5 py-8 text-center text-sm text-[#4a6b70]">
              Aún no hay comentarios en esta sección. Sé la primera persona en dejar una dedicatoria.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {entries.map((entry) => {
                const isAuthor = Boolean(
                  authUser?.emailVerified && entry.authorUid && entry.authorUid === authUser.uid
                );
                return (
                  <li
                    key={entry.id}
                    className="border border-[#163d4a]/20 bg-[#faf8eb] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <strong className="text-base font-bold text-[#163d4a]">
                          {entry.nickname}
                        </strong>
                        <span className="border border-[#163d4a]/25 bg-[#e9e6d0] px-2 py-0.5 text-[11px] font-medium text-[#365c62]">
                          {entry.scopeLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#597d7f] tabular-nums">
                          {formatShortDate(entry.createdAt)}
                        </span>
                        {canModerate && (
                          <button
                            type="button"
                            onClick={() => handleHide(entry.id)}
                            title="Ocultar comentario"
                            className="inline-flex items-center gap-1 border border-[#163d4a]/30 bg-white px-2 py-0.5 text-[11px] text-[#355a60] hover:bg-[#fae5dc] hover:text-[#8a3118]"
                          >
                            <EyeOff className="h-3 w-3" />
                            <span>Ocultar</span>
                          </button>
                        )}
                        {(canModerate || isAuthor) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            title="Eliminar comentario"
                            className="inline-flex items-center gap-1 border border-[#b25f37]/40 bg-white px-2 py-0.5 text-[11px] text-[#8a3118] hover:bg-[#b25f37] hover:text-white"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Eliminar</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-[#223f45]">
                      {entry.message}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
