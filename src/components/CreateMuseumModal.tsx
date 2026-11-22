import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { LogIn, Palette, Sparkles, X } from 'lucide-react';
import { CHARACTER_PROFILES } from '../data/characters';
import { MUSEUM_TEMPLATES, MuseumTemplate } from '../data/museumTemplates';
import { CATEGORY_META, MUSEUM_THEME_PRESETS } from '../data/themes';
import { createCloudMuseum } from '../firebase/museumNetwork';
import {
  CharacterId,
  CloudMuseum,
  MuseumCategory,
  MuseumPiece,
  MuseumThemeConfig,
  ThemeId,
} from '../types/museum';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface CreateMuseumModalProps {
  isOpen: boolean;
  authUser: User | null;
  onSignIn: () => Promise<void>;
  onCreated: (result: { museum: CloudMuseum; pieces: MuseumPiece[] }) => void;
  onClose: () => void;
}

export const CreateMuseumModal: React.FC<CreateMuseumModalProps> = ({
  isOpen,
  authUser,
  onSignIn,
  onCreated,
  onClose,
}) => {
  const dialogRef = useModalFocusTrap({ isOpen, onClose });
  const [templateId, setTemplateId] = useState<string>(MUSEUM_TEMPLATES[0].id);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState(MUSEUM_TEMPLATES[0].defaultSubtitle);
  const [authorName, setAuthorName] = useState(authUser?.displayName || '');
  const [category, setCategory] = useState<MuseumCategory>(MUSEUM_TEMPLATES[0].category);
  const [theme, setTheme] = useState<MuseumThemeConfig>(MUSEUM_TEMPLATES[0].theme);
  const [defaultCharacterId, setDefaultCharacterId] = useState<CharacterId>(
    MUSEUM_TEMPLATES[0].defaultCharacterId
  );
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authUser?.displayName && !authorName) {
      setAuthorName(authUser.displayName);
    }
  }, [authUser, authorName]);

  if (!isOpen) return null;

  const applyTemplate = (tpl: MuseumTemplate) => {
    setTemplateId(tpl.id);
    setCategory(tpl.category);
    setTheme(tpl.theme);
    setDefaultCharacterId(tpl.defaultCharacterId);
    setSubtitle(tpl.defaultSubtitle);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    if (!title.trim()) {
      setError('Escribe un título para tu museo.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createCloudMuseum(authUser, {
        title: title.trim(),
        subtitle: subtitle.trim(),
        authorName: authorName.trim() || authUser.displayName || 'Creador',
        category,
        templateId,
        theme,
        defaultCharacterId,
        isPublic,
      });
      onCreated(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear el museo. Intenta nuevamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Crear nuevo museo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02141f]/80 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="museum-scroll max-h-[90vh] w-full max-w-[860px] overflow-y-auto border-[3px] border-[#e1c875] bg-[#0b2b39] p-6 text-[#f8f4df] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#f3d889]/25 pb-4">
          <div>
            <p className="font-pixel flex items-center gap-1.5 text-[9px] text-[#f4d47d]">
              <Sparkles className="h-3.5 w-3.5" />
              NUEVO ARCHIPIÉLAGO PERSONAL
            </p>
            <h2 className="mt-1.5 text-2xl font-bold text-[#fff9e8]">Crear mi propio museo</h2>
            <p className="mt-1 text-sm text-[#c4ded2]">
              Elige una plantilla inicial, define tu paleta de colores y publícalo en la red de creadores.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar creación de museo"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border border-[#d8c47b] bg-[#174d58] text-white hover:bg-[#b25f37]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!authUser ? (
          <div className="mt-6 border border-[#e1c875]/40 bg-[#082330] p-6 text-center">
            <p className="text-base leading-relaxed text-[#f8f4df]">
              Para guardar y publicar tu propio museo en la red de creadores necesitas iniciar sesión con Google.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="font-pixel mt-5 inline-flex items-center gap-2 border-2 border-[#f2d17b] bg-[#1d6873] px-5 py-3 text-[10px] text-[#fff9e8] hover:bg-[#b25f37]"
            >
              <LogIn className="h-4 w-4" />
              ENTRAR CON GOOGLE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-6">
            {/* Barra de onboarding en 3 minutos */}
            <div className="grid grid-cols-3 gap-2 border border-[#e0d7a5]/25 bg-[#082330] p-2.5 text-xs">
              <div className="border border-[#f4d47d]/35 bg-white/[0.03] px-2.5 py-1.5">
                <span className="font-pixel block text-[8px] text-[#f4d47d]">PASO 1</span>
                <span className="text-[#fff9e8]">Elige plantilla</span>
              </div>
              <div className="border border-[#e0d7a5]/20 bg-white/[0.03] px-2.5 py-1.5">
                <span className="font-pixel block text-[8px] text-[#f4d47d]">PASO 2</span>
                <span className="text-[#fff9e8]">Pon tu nombre</span>
              </div>
              <div className="border border-[#e0d7a5]/20 bg-white/[0.03] px-2.5 py-1.5">
                <span className="font-pixel block text-[8px] text-[#f4d47d]">PASO 3</span>
                <span className="text-[#fff9e8]">Publica y edita</span>
              </div>
            </div>

            {/* Plantillas */}
            <div>
              <h3 className="font-pixel mb-2.5 text-[9px] text-[#f4d47d]">
                1. ELIGE UNA PLANTILLA INICIAL
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {MUSEUM_TEMPLATES.map((tpl) => {
                  const active = tpl.id === templateId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={`min-h-[44px] border-2 p-3 text-left transition-colors ${
                        active
                          ? 'border-[#f4d47d] bg-[#175160]'
                          : 'border-[#e0d7a5]/25 bg-white/[0.04] hover:bg-white/[0.08]'
                      }`}
                    >
                      <strong className="block text-sm font-bold text-[#fff9e8]">{tpl.name}</strong>
                      <span className="mt-1 block text-xs leading-snug text-[#c4ded2]">
                        {tpl.description}
                      </span>
                      <span className="mt-1.5 block text-[11px] font-semibold text-[#f4d47d] tabular-nums">
                        Incluye {tpl.islands.length} islas · {tpl.rooms.length} salas · {tpl.pieces.length}{' '}
                        {tpl.pieces.length === 1 ? 'pieza inicial' : 'piezas iniciales'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Datos del Museo */}
            <div>
              <h3 className="font-pixel mb-2.5 text-[9px] text-[#f4d47d]">
                2. IDENTIDAD DEL MUSEO
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-[#c7ded2]">Título del museo</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Vinilos de Medianoche / Bistro Nube"
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#c7ded2]">
                    Nombre de creador o proyecto
                  </label>
                  <input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Tu nombre o el de tu proyecto"
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs text-[#c7ded2]">Subtítulo breve</label>
                  <input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#c7ded2]">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MuseumCategory)}
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                  >
                    {(Object.entries(CATEGORY_META) as [MuseumCategory, { label: string }][]).map(
                      ([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#c7ded2]">
                    Personaje sugerido al entrar
                  </label>
                  <select
                    value={defaultCharacterId}
                    onChange={(e) => setDefaultCharacterId(e.target.value as CharacterId)}
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                  >
                    {CHARACTER_PROFILES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Colores y estética */}
            <div>
              <h3 className="font-pixel mb-2.5 flex items-center gap-1.5 text-[9px] text-[#f4d47d]">
                <Palette className="h-3.5 w-3.5" />
                3. PALETA DE COLORES Y SALAS
              </h3>
              <div className="mb-3 flex flex-wrap gap-2">
                {MUSEUM_THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setTheme(preset.config)}
                    className={`flex items-center gap-2 border px-2.5 py-1.5 text-xs ${
                      theme.presetId === preset.id
                        ? 'border-[#f4d47d] bg-[#175160] text-[#fff9e8]'
                        : 'border-[#e0d7a5]/25 bg-white/[0.04] text-[#c4ded2] hover:bg-white/[0.08]'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 border border-black/40"
                      style={{ backgroundColor: preset.config.skyColor }}
                    />
                    <span
                      className="h-3.5 w-3.5 border border-black/40"
                      style={{ backgroundColor: preset.config.oceanColor }}
                    />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                  <span className="mb-1.5 block text-[#c7ded2]">Cielo / Niebla</span>
                  <input
                    type="color"
                    value={theme.skyColor}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, presetId: 'custom', skyColor: e.target.value }))
                    }
                    className="h-8 w-full cursor-pointer border-0 bg-transparent"
                  />
                </label>
                <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                  <span className="mb-1.5 block text-[#c7ded2]">Océano</span>
                  <input
                    type="color"
                    value={theme.oceanColor}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, presetId: 'custom', oceanColor: e.target.value }))
                    }
                    className="h-8 w-full cursor-pointer border-0 bg-transparent"
                  />
                </label>
                <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                  <span className="mb-1.5 block text-[#c7ded2]">Acento dorado</span>
                  <input
                    type="color"
                    value={theme.accentColor}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, presetId: 'custom', accentColor: e.target.value }))
                    }
                    className="h-8 w-full cursor-pointer border-0 bg-transparent"
                  />
                </label>
                <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                  <span className="mb-1.5 block text-[#c7ded2]">Paneles</span>
                  <input
                    type="color"
                    value={theme.surfaceColor}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, presetId: 'custom', surfaceColor: e.target.value }))
                    }
                    className="h-8 w-full cursor-pointer border-0 bg-transparent"
                  />
                </label>
                <div className="col-span-2 border border-white/15 bg-white/[0.04] p-2.5 text-xs sm:col-span-1">
                  <span className="mb-1.5 block text-[#c7ded2]">Luz de salas 2D</span>
                  <select
                    value={theme.roomThemeId}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, roomThemeId: e.target.value as ThemeId }))
                    }
                    className="w-full border border-[#537c79] bg-[#f0eedc] px-2 py-1 text-xs text-[#183b42]"
                  >
                    <option value="classic">Clásico</option>
                    <option value="night">Nocturno</option>
                    <option value="twilight">Crepúsculo</option>
                    <option value="gameboy">Consola 89</option>
                  </select>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 border border-white/15 bg-white/[0.04] p-3 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 accent-[#f4d47d]"
              />
              <span>
                Publicar en el directorio público para que otros visitantes puedan explorar este museo y compartir obras.
              </span>
            </label>

            {error && (
              <p className="border border-[#e39b7f] bg-[#4c241d] px-4 py-2.5 text-sm text-[#ffd9cc]">
                {error}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-[#f3d889]/20 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="border border-[#d8c47b]/60 bg-[#062230] px-4 py-2.5 text-sm text-[#fff5d7]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="font-pixel border-2 border-[#f2d17b] bg-[#bd7544] px-5 py-2.5 text-[10px] text-[#fff9e8] hover:bg-[#a24d2e] disabled:opacity-60"
              >
                {submitting ? 'CREANDO...' : 'CREAR Y ABRIR MUSEO'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
