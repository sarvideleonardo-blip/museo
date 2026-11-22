import React, { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Cloud,
  Compass,
  KeyRound,
  Link2,
  LogIn,
  Sparkles,
  X,
} from 'lucide-react';
import {
  acceptIslandInvite,
  fetchIslandInvite,
  fetchMyGuestLoans,
} from '../firebase/interactions';
import { CloudMuseum, IslandInvite } from '../types/museum';
import {
  evaluateInviteExpiration,
  formatElapsedTime,
  formatReadableDate,
} from '../utils/inviteHelpers';

interface LoanInviteModalProps {
  isOpen: boolean;
  initialInviteId: string | null;
  authUser: User | null;
  myMuseums: CloudMuseum[];
  onSignIn: () => void;
  onAccepted: (invite: IslandInvite) => void;
  onOpenMuseumById: (museumId: string) => void;
  onClose: () => void;
}

function extractInviteCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('?')) {
      const url = trimmed.startsWith('http')
        ? new URL(trimmed)
        : new URL(trimmed, 'https://museo404.local');
      const param = url.searchParams.get('invite');
      if (param) return param.trim();
    }
  } catch {
    // ignorar si no es URL completa
  }
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
}

export const LoanInviteModal: React.FC<LoanInviteModalProps> = ({
  isOpen,
  initialInviteId,
  authUser,
  myMuseums,
  onSignIn,
  onAccepted,
  onOpenMuseumById,
  onClose,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [invite, setInvite] = useState<IslandInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myLoans, setMyLoans] = useState<IslandInvite[]>([]);
  const [loadingMyLoans, setLoadingMyLoans] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [selectedOriginMuseumId, setSelectedOriginMuseumId] = useState<string>('custom');
  const [sourceMuseumTitle, setSourceMuseumTitle] = useState('');
  const [sourceMuseumUrl, setSourceMuseumUrl] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  const lookupInvite = useCallback(async (rawCode: string) => {
    const clean = extractInviteCode(rawCode);
    if (!clean) {
      setError('Pega un código o enlace de invitación válido.');
      return;
    }
    setLoading(true);
    setError(null);
    setAcceptedSuccess(false);
    try {
      const found = await fetchIslandInvite(clean);
      if (!found) {
        setInvite(null);
        setError('No se encontró ninguna invitación con ese código.');
      } else {
        setInvite(found);
      }
    } catch (err) {
      setInvite(null);
      setError(err instanceof Error ? err.message : 'No se pudo consultar la invitación.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (initialInviteId) {
      setCodeInput(initialInviteId);
      lookupInvite(initialInviteId);
    } else {
      setError(null);
    }
  }, [isOpen, initialInviteId, lookupInvite]);

  useEffect(() => {
    if (!isOpen || !authUser) {
      setMyLoans([]);
      return;
    }
    setGuestName((prev) => prev || authUser.displayName || '');
    if (myMuseums.length > 0) {
      setSelectedOriginMuseumId((prev) => {
        if (prev !== 'custom' && myMuseums.some((m) => m.id === prev)) return prev;
        const first = myMuseums[0];
        setSourceMuseumTitle(first.title);
        setSourceMuseumUrl(`?museum=${first.id}`);
        return first.id;
      });
    }
    setLoadingMyLoans(true);
    fetchMyGuestLoans(authUser.uid)
      .then((loans) => setMyLoans(loans))
      .catch(() => setMyLoans([]))
      .finally(() => setLoadingMyLoans(false));
  }, [isOpen, authUser, myMuseums]);

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

  const handleSelectOriginMuseum = (museumId: string) => {
    setSelectedOriginMuseumId(museumId);
    if (museumId === 'custom') {
      return;
    }
    const found = myMuseums.find((m) => m.id === museumId);
    if (found) {
      setSourceMuseumTitle(found.title);
      setSourceMuseumUrl(`?museum=${found.id}`);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || !authUser) return;
    setAccepting(true);
    setError(null);
    try {
      const originId =
        selectedOriginMuseumId !== 'custom' ? selectedOriginMuseumId : '';
      const updated = await acceptIslandInvite({
        inviteId: invite.id,
        user: authUser,
        guestName,
        sourceMuseumId: originId,
        sourceMuseumTitle,
        sourceMuseumUrl,
      });
      setInvite(updated);
      setAcceptedSuccess(true);
      setMyLoans((prev) => {
        const rest = prev.filter((l) => l.id !== updated.id);
        return [updated, ...rest];
      });
      onAccepted(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación.');
    } finally {
      setAccepting(false);
    }
  };

  const isHostViewingOwn = Boolean(authUser && invite && authUser.uid === invite.hostUid);
  const isGuestOwnerOfAccepted = Boolean(
    authUser && invite && invite.status === 'accepted' && invite.guestUid === authUser.uid
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invitación a Isla Prestada"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02111a]/82 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden border-[3px] border-[#e1c875] bg-[#0b2b39] text-[#f8f4df] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#f3d889]/25 bg-gradient-to-r from-[#164e59] to-[#092b3b] px-5 py-4">
          <div className="min-w-0">
            <p className="font-pixel flex items-center gap-2 text-[9px] text-[#f4d47d]">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>RED DE MUSEOS · ISLA PRESTADA</span>
            </p>
            <h2 className="mt-1.5 text-2xl font-bold text-[#fff9e8]">
              Invitación para habitar una isla
            </h2>
            <p className="mt-1 text-sm text-[#c4ded2]">
              Cuando otro creador te presta una isla, tu trabajo aparece rodeado de niebla liminal y siempre enlaza a tu museo de origen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d8c47b] bg-[#174d58] text-white hover:bg-[#b25f37]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="museum-scroll flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {/* Buscar código o pegar enlace mágico */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupInvite(codeInput);
            }}
            className="border border-[#e0d7a5]/25 bg-[#07222d] p-4"
          >
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#f4d47d]">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Código o enlace mágico de invitación</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Pega el enlace (?invite=inv_...) o el código inv_..."
                className="min-w-[220px] flex-1 border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
              />
              <button
                type="submit"
                disabled={loading}
                className="border border-[#f2d17b] bg-[#1d6873] px-4 py-2 text-xs font-bold text-[#fff9e8] hover:bg-[#b25f37] disabled:opacity-55"
              >
                {loading ? 'Buscando...' : 'Buscar invitación'}
              </button>
            </div>
          </form>

          {error && (
            <p className="border border-[#bd7967] bg-[#603d3d]/60 px-4 py-3 text-sm text-[#ffd5c7]">
              {error}
            </p>
          )}

          {/* Detalle de la invitación encontrada */}
          {invite && (
            <section className="border-2 border-[#f4d47d]/60 bg-[#082532] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#9fc4b8]">
                    ANFITRIÓN: {invite.hostName} · MUSEO «{invite.museumTitle}»
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-[#fff9e8]">
                    Isla: {invite.islandTitle}
                  </h3>
                </div>
                <span
                  className={`border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    invite.status === 'pending'
                      ? 'border-[#f4d47d] bg-[#6d451f] text-[#fff3c7]'
                      : invite.status === 'accepted'
                        ? 'border-[#7fd6cc] bg-[#144c58] text-[#e7fbf7]'
                        : 'border-[#bd7967] bg-[#533b3a] text-[#ffd5c7]'
                  }`}
                >
                  {invite.status === 'pending'
                    ? 'Disponible'
                    : invite.status === 'accepted'
                      ? 'Activa'
                      : 'Revocada'}
                </span>
              </div>

              {invite.status === 'revoked' && (
                <div className="space-y-2 border border-[#bd7967]/60 bg-[#422222]/80 p-4 text-[#ffd5c7]">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#ffc1b0]">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#ff8c73]" />
                    <span>Préstamo no disponible o revocado</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    El creador anfitrión ha revocado el acceso para esta invitación o el préstamo ha concluido. Si crees que se trata de un error, por favor solicita un nuevo enlace mágico de invitación al anfitrión del museo.
                  </p>
                </div>
              )}

              {invite.status === 'accepted' && (
                <div className="space-y-3">
                  {acceptedSuccess && (
                    <div className="flex items-center gap-2 border border-[#7fd6cc]/60 bg-[#124552] px-3.5 py-2.5 text-sm text-[#e8fbf7]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8ae6dc]" />
                      <span>
                        ¡Préstamo aceptado! Ya puedes subir tus piezas en «{invite.islandTitle}» dentro de «{invite.museumTitle}».
                      </span>
                    </div>
                  )}
                  {isGuestOwnerOfAccepted ? (
                    <p className="text-sm text-[#d0e6da]">
                      Tienes esta isla prestada a tu nombre (<strong className="text-[#fff9e8]">{invite.guestName}</strong>) enlazando a tu museo origen (<strong className="text-[#f4d47d]">{invite.sourceMuseumTitle}</strong>).
                    </p>
                  ) : (
                    <div className="space-y-2 border border-[#f4d47d]/40 bg-[#3d2f16]/70 p-3.5 text-xs text-[#ffecc7]">
                      <div className="flex items-center gap-2 font-bold text-sm text-[#f4d47d]">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-[#f4d47d]" />
                        <span>Invitación ya reclamada</span>
                      </div>
                      <p className="leading-relaxed">
                        Esta invitación ya fue aceptada por otra cuenta (<strong className="text-white">{invite.guestName}</strong>). Cada invitación mágica es de un solo uso para garantizar la autoría exclusiva de la isla prestada.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMuseumById(invite.museumId);
                        onClose();
                      }}
                      className="font-pixel inline-flex items-center gap-2 border-2 border-[#f2d17b] bg-[#bd7544] px-4 py-2.5 text-[9px] text-[#fff9e8] hover:bg-[#a24d2e]"
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>
                        {isGuestOwnerOfAccepted
                          ? 'IR A EDITAR MI ISLA PRESTADA'
                          : 'VISITAR MUSEO ANFITRIÓN'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Metadatos de fecha y tiempo transcurrido en el modal */}
              {invite && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-2 text-[11px] text-[#9fc4b8]">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-[#d8c47b]" />
                    <span>Creada: {formatReadableDate(invite.createdAt)} ({formatElapsedTime(invite.createdAt)})</span>
                  </span>
                  {invite.status === 'pending' && (() => {
                    const evalExp = evaluateInviteExpiration(invite);
                    if (evalExp.enforcedExpirationStr) {
                      return (
                        <span className={`inline-flex items-center gap-1 ${evalExp.isEnforcedExpired ? 'text-[#ffb4a2]' : 'text-[#c4ded2]'}`}>
                          <Clock className="h-3 w-3" />
                          <span>
                            {evalExp.isEnforcedExpired ? 'Expirada:' : 'Vence:'} {evalExp.enforcedExpirationStr}
                          </span>
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1 text-[#c4ded2]">
                        <Clock className="h-3 w-3" />
                        <span>
                          Fecha sugerida de revisión: {evalExp.suggestedReview.suggestedDateStr}
                          {evalExp.suggestedReview.isPastSuggestedWindow
                            ? ' (revisión sugerida cumplida)'
                            : ` (${evalExp.suggestedReview.daysRemaining}d restantes)`}
                        </span>
                      </span>
                    );
                  })()}
                </div>
              )}

              {invite.status === 'pending' && (
                <>
                  {!authUser ? (
                    <div className="space-y-3 border border-white/15 bg-white/[0.04] p-4">
                      <p className="text-sm text-[#d0e6da]">
                        Inicia sesión con tu cuenta de Google para vincular esta isla a tu autoría y poder subir tus propias obras en sus salas.
                      </p>
                      <button
                        type="button"
                        onClick={onSignIn}
                        className="inline-flex items-center gap-2 border-2 border-[#f2d17b] bg-[#1d6873] px-4 py-2 text-xs font-bold text-[#fff9e8] hover:bg-[#b25f37]"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Entrar con Google para aceptar
                      </button>
                    </div>
                  ) : isHostViewingOwn ? (
                    <div className="space-y-2 border border-[#f4d47d]/35 bg-white/[0.04] p-4 text-sm text-[#dbece4]">
                      <p>
                        Eres el creador anfitrión de esta invitación. Comparte el enlace mágico o el código <code className="bg-black/30 px-1.5 py-0.5 text-[#f4d47d]">{invite.id}</code> con la persona que invitarás a exponer en «{invite.islandTitle}».
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleAccept} className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-[#c7ded2]">
                            Tu nombre o apodo de creador *
                          </label>
                          <input
                            required
                            maxLength={80}
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Ej. Estudio Nube / Ana"
                            className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-[#c7ded2]">
                            Vincular a uno de tus museos
                          </label>
                          <select
                            value={selectedOriginMuseumId}
                            onChange={(e) => handleSelectOriginMuseum(e.target.value)}
                            className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                          >
                            {myMuseums.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.title}
                              </option>
                            ))}
                            <option value="custom">Otro proyecto o enlace web</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-[#c7ded2]">
                            Nombre visible de tu museo / proyecto *
                          </label>
                          <input
                            required
                            maxLength={100}
                            value={sourceMuseumTitle}
                            onChange={(e) => setSourceMuseumTitle(e.target.value)}
                            placeholder="Ej. Archivo Nocturno"
                            className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-[#c7ded2]">
                            Enlace de origen (opcional, ?museum=... o https://...)
                          </label>
                          <input
                            maxLength={1000}
                            value={sourceMuseumUrl}
                            onChange={(e) => setSourceMuseumUrl(e.target.value)}
                            placeholder="?museum=... o https://..."
                            className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                          />
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-[#9fc4b8]">
                        Al aceptar, entrarás en <strong>Modo Invitado</strong>: podrás crear, editar y borrar tus piezas únicamente dentro de «{invite.islandTitle}». El resto del museo permanecerá en solo lectura.
                      </p>

                      <button
                        type="submit"
                        disabled={accepting}
                        className="font-pixel inline-flex items-center gap-2 border-2 border-[#f2d17b] bg-[#bd7544] px-5 py-2.5 text-[9px] text-[#fff9e8] hover:bg-[#a24d2e] disabled:opacity-55"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span>{accepting ? 'ACEPTANDO...' : 'ACEPTAR ISLA PRESTADA'}</span>
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          )}

          {/* Lista de islas que el usuario ya tiene prestadas */}
          {authUser && (
            <section className="border border-[#e0d7a5]/20 bg-[#07222d] p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h3 className="font-pixel flex items-center gap-1.5 text-[9px] text-[#f4d47d]">
                  <Cloud className="h-3.5 w-3.5" />
                  <span>ISLAS DONDE EXPONES COMO INVITADO ({myLoans.length})</span>
                </h3>
                {loadingMyLoans && <span className="text-xs text-[#9fc4b8]">Cargando...</span>}
              </div>

              {myLoans.length === 0 ? (
                <p className="text-xs text-[#a9c7bc]">
                  Todavía no has aceptado invitaciones de isla prestada con esta cuenta.
                </p>
              ) : (
                <div className="space-y-2">
                  {myLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="flex flex-wrap items-center justify-between gap-3 border border-white/15 bg-white/[0.04] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-[#fff9e8]">
                          {loan.islandTitle} · en «{loan.museumTitle}»
                        </strong>
                        <span className="block truncate text-xs text-[#a8c8bc]">
                          Anfitrión: {loan.hostName} · Tu enlace: {loan.sourceMuseumTitle}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenMuseumById(loan.museumId);
                          onClose();
                        }}
                        className="border border-[#f2d17b] bg-[#1d6873] px-3 py-1.5 text-xs font-bold text-[#fff9e8] hover:bg-[#b25f37]"
                      >
                        Abrir museo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
