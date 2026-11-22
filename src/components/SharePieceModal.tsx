import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { LogIn, Plus, Share2, X } from 'lucide-react';
import { curatePieceIntoMuseum } from '../firebase/museumNetwork';
import { compactImageToDataUrl, getMedia } from '../storage/mediaDb';
import { CloudMuseum, MuseumPiece } from '../types/museum';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface SharePieceModalProps {
  piece: MuseumPiece | null;
  sourceMuseumId: string;
  sourceMuseumTitle: string;
  sourceAuthorName: string;
  authUser: User | null;
  myMuseums: CloudMuseum[];
  onSignIn: () => Promise<void>;
  onOpenCreateMuseum: () => void;
  onCurated: (targetMuseumId: string, createdPiece: MuseumPiece) => void;
  onClose: () => void;
}

export const SharePieceModal: React.FC<SharePieceModalProps> = ({
  piece,
  sourceMuseumId,
  sourceMuseumTitle,
  sourceAuthorName,
  authUser,
  myMuseums,
  onSignIn,
  onOpenCreateMuseum,
  onCurated,
  onClose,
}) => {
  const dialogRef = useModalFocusTrap({ isOpen: Boolean(piece), onClose });
  const [targetMuseumId, setTargetMuseumId] = useState<string>('');
  const [targetIslandId, setTargetIslandId] = useState<string>('');
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [curatorialNote, setCuratorialNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!piece) return;
    setError(null);
    setCuratorialNote('');
    if (myMuseums.length > 0) {
      const firstM = myMuseums.find((m) => m.id !== sourceMuseumId) || myMuseums[0];
      setTargetMuseumId(firstM.id);
      const firstIsl = firstM.islands[0];
      setTargetIslandId(firstIsl?.id || '');
      const firstRoom = firstM.rooms.find((r) => r.islandId === firstIsl?.id) || firstM.rooms[0];
      setTargetRoomId(firstRoom?.id || '');
    } else {
      setTargetMuseumId('');
      setTargetIslandId('');
      setTargetRoomId('');
    }
  }, [piece, myMuseums, sourceMuseumId]);

  const targetMuseum = useMemo(
    () => myMuseums.find((m) => m.id === targetMuseumId) || null,
    [myMuseums, targetMuseumId]
  );

  const availableRooms = useMemo(() => {
    if (!targetMuseum) return [];
    return targetMuseum.rooms.filter((r) => r.islandId === targetIslandId);
  }, [targetMuseum, targetIslandId]);

  useEffect(() => {
    if (!piece) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [piece, onClose]);

  if (!piece) return null;

  const handleConfirmShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMuseum || !targetIslandId || !targetRoomId) {
      setError('Elige un museo, una isla y una sala de destino.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let resolvedMediaDataUrl =
        piece.mediaDataUrl && /^data:image\//i.test(piece.mediaDataUrl) ? piece.mediaDataUrl : '';
      if (!resolvedMediaDataUrl && piece.mediaKey) {
        const blob = await getMedia(piece.mediaKey);
        if (blob && blob.type.startsWith('image/')) {
          const file = new File([blob], 'pieza.jpg', { type: blob.type });
          resolvedMediaDataUrl = await compactImageToDataUrl(file, 155000);
        }
      }

      const { piece: created } = await curatePieceIntoMuseum({
        targetMuseum,
        targetIslandId,
        targetRoomId,
        sourcePiece: {
          ...piece,
          mediaDataUrl: resolvedMediaDataUrl || null,
        },
        sourceMuseumId,
        sourceMuseumTitle,
        sourceAuthorName,
        curatorialNote,
      });

      onCurated(targetMuseum.id, created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo compartir la pieza en tu museo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Compartir obra en mi museo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02141f]/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="museum-scroll max-h-[88vh] w-full max-w-[600px] overflow-y-auto border-[3px] border-[#e1c875] bg-[#0b2b39] p-6 text-[#f8f4df] shadow-[0_24px_75px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#f3d889]/25 pb-4">
          <div>
            <p className="font-pixel flex items-center gap-1.5 text-[9px] text-[#f4d47d]">
              <Share2 className="h-3.5 w-3.5" />
              CURADURÍA CRUZADA ENTRE MUSEOS
            </p>
            <h2 className="mt-1.5 text-xl font-bold text-[#fff9e8]">Compartir en mi museo</h2>
            <p className="mt-1 text-xs text-[#c4ded2]">
              Obra seleccionada: <strong className="text-[#fff9e8]">«{piece.title}»</strong> · de{' '}
              {sourceMuseumTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border border-[#d8c47b] bg-[#174d58] text-white hover:bg-[#b25f37]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!authUser ? (
          <div className="mt-5 border border-[#e1c875]/35 bg-[#082330] p-5 text-center">
            <p className="text-sm leading-relaxed text-[#d0e6da]">
              Inicia sesión con Google para exhibir obras de otros museos en tus propias salas conservando el crédito al autor original.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="font-pixel mt-4 inline-flex items-center gap-2 border-2 border-[#f2d17b] bg-[#1d6873] px-4 py-2.5 text-[10px] text-[#fff9e8] hover:bg-[#b25f37]"
            >
              <LogIn className="h-4 w-4" />
              ENTRAR CON GOOGLE
            </button>
          </div>
        ) : myMuseums.length === 0 ? (
          <div className="mt-5 border border-[#e1c875]/35 bg-[#082330] p-5 text-center">
            <p className="text-sm leading-relaxed text-[#d0e6da]">
              Aún no tienes un museo propio en la nube donde exhibir esta pieza. Crea uno en segundos y vuelve aquí.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateMuseum();
              }}
              className="font-pixel mt-4 inline-flex items-center gap-2 border-2 border-[#f2d17b] bg-[#bd7544] px-4 py-2.5 text-[10px] text-[#fff9e8] hover:bg-[#a24d2e]"
            >
              <Plus className="h-4 w-4" />
              CREAR MI PRIMER MUSEO
            </button>
          </div>
        ) : (
          <form onSubmit={handleConfirmShare} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#c7ded2]">Tu museo de destino</label>
              <select
                value={targetMuseumId}
                onChange={(e) => {
                  const nextM = myMuseums.find((m) => m.id === e.target.value);
                  setTargetMuseumId(e.target.value);
                  const firstIsl = nextM?.islands[0];
                  setTargetIslandId(firstIsl?.id || '');
                  const firstR =
                    nextM?.rooms.find((r) => r.islandId === firstIsl?.id) || nextM?.rooms[0];
                  setTargetRoomId(firstR?.id || '');
                }}
                className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
              >
                {myMuseums.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            {targetMuseum && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-[#c7ded2]">Isla de destino</label>
                  <select
                    value={targetIslandId}
                    onChange={(e) => {
                      const nextIsl = e.target.value;
                      setTargetIslandId(nextIsl);
                      const firstR = targetMuseum.rooms.find((r) => r.islandId === nextIsl);
                      setTargetRoomId(firstR?.id || '');
                    }}
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                  >
                    {targetMuseum.islands.map((isl) => (
                      <option key={isl.id} value={isl.id}>
                        {isl.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-[#c7ded2]">Sala de destino</label>
                  <select
                    value={targetRoomId}
                    onChange={(e) => setTargetRoomId(e.target.value)}
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                  >
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs text-[#c7ded2]">
                Nota curatorial (opcional: explica por qué la recomiendas)
              </label>
              <textarea
                rows={3}
                value={curatorialNote}
                onChange={(e) => setCuratorialNote(e.target.value)}
                placeholder="Ej. Recomiendo mucho este álbum o este platillo de mi colega..."
                className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
              />
            </div>

            <p className="text-xs text-[#a9c7bc]">
              La pieza aparecerá en tu sala con un sello automático enlazando a «{sourceMuseumTitle}» ({sourceAuthorName}).
            </p>

            {error && (
              <p className="border border-[#e39b7f] bg-[#4c241d] px-3 py-2 text-xs text-[#ffd9cc]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-[#f3d889]/20 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="border border-[#d8c47b]/60 bg-[#062230] px-4 py-2 text-sm text-[#fff5d7]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !targetRoomId}
                className="font-pixel border-2 border-[#f2d17b] bg-[#bd7544] px-4 py-2.5 text-[10px] text-[#fff9e8] hover:bg-[#a24d2e] disabled:opacity-60"
              >
                {submitting ? 'COMPARTIENDO...' : 'EXHIBIR EN MI MUSEO'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
