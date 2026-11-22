import React, { useEffect, useRef } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { CHARACTER_PROFILES, CharacterProfile } from '../data/characters';
import { retroAudio } from '../game/audio';
import { spriteRenderer } from '../game/spriteRenderer';
import { CharacterId } from '../types/museum';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface CharacterSelectorModalProps {
  isOpen: boolean;
  selectedCharacterId: CharacterId;
  onSelectCharacter: (id: CharacterId) => void;
  onClose: () => void;
}

const CharacterPixelPreview: React.FC<{ characterId: CharacterId }> = ({ characterId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 16, 16);
    spriteRenderer.renderPlayer(ctx, 0, 0, 'down', 0, characterId);
  }, [characterId]);

  return (
    <canvas
      ref={canvasRef}
      width={16}
      height={16}
      className="pixelated h-14 w-14 shrink-0 border-2 border-[#e1c875]/60 bg-[#0b3b4e] p-1"
    />
  );
};

export const CharacterSelectorModal: React.FC<CharacterSelectorModalProps> = ({
  isOpen,
  selectedCharacterId,
  onSelectCharacter,
  onClose,
}) => {
  const dialogRef = useModalFocusTrap({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Elegir personaje"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02141f]/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="museum-scroll max-h-[88vh] w-full max-w-[760px] overflow-y-auto border-[3px] border-[#e1c875] bg-[#0b2b39] p-6 text-[#f8f4df] shadow-[0_24px_75px_rgba(0,0,0,0.58)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#f3d889]/25 pb-4">
          <div>
            <p className="font-pixel flex items-center gap-1.5 text-[9px] text-[#f4d47d]">
              <Sparkles className="h-3.5 w-3.5" />
              IDENTIDAD DE EXPLORACIÓN
            </p>
            <h2 className="mt-1.5 text-2xl font-bold text-[#fff9e8]">Elige tu personaje</h2>
            <p className="mt-1 text-sm text-[#c4ded2]">
              Tu personaje aparece al caminar en 3D, en el mapa del archipiélago y dentro de todas las salas 2D.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar selector de personaje"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border border-[#d8c47b] bg-[#174d58] text-white hover:bg-[#b25f37]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHARACTER_PROFILES.map((profile: CharacterProfile) => {
            const isActive = profile.id === selectedCharacterId;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  onSelectCharacter(profile.id);
                  if (!retroAudio.muted) retroAudio.playInteract();
                }}
                className={`flex items-start gap-3.5 border-2 p-3.5 text-left transition-colors ${
                  isActive
                    ? 'border-[#f4d47d] bg-[#175160] shadow-[0_0_0_2px_rgba(244,212,125,0.28)]'
                    : 'border-[#e0d7a5]/25 bg-white/[0.04] hover:border-[#e0d7a5]/60 hover:bg-white/[0.08]'
                }`}
              >
                <CharacterPixelPreview characterId={profile.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-base font-bold text-[#fff9e8]">
                      {profile.name}
                    </strong>
                    {isActive && (
                      <span className="font-pixel inline-flex shrink-0 items-center gap-1 border border-[#f4d47d] bg-[#bd7544] px-2 py-1 text-[8px] text-[#fff9e8]">
                        <Check className="h-3 w-3" />
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#c3dcd1]">
                    {profile.tagline}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span
                      className="h-3.5 w-3.5 border border-black/40"
                      style={{ backgroundColor: profile.tunicColor }}
                      title="Túnica"
                    />
                    <span
                      className="h-3.5 w-3.5 border border-black/40"
                      style={{ backgroundColor: profile.trimColor }}
                      title="Acento"
                    />
                    <span
                      className="h-3.5 w-3.5 border border-black/40"
                      style={{ backgroundColor: profile.scarfColor }}
                      title="Detalle"
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end border-t border-[#f3d889]/20 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="font-pixel border-2 border-[#f2d17b] bg-[#bd7544] px-4 py-2.5 text-[10px] text-[#fff9e8] hover:bg-[#a24d2e]"
          >
            LISTO
          </button>
        </div>
      </div>
    </div>
  );
};
