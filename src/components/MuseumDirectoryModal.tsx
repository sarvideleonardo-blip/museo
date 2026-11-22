import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { BookOpen, Compass, KeyRound, Link2, Lock, LogIn, Pencil, Plus, RefreshCw, Search, Share2, Shuffle, Sparkles, X } from 'lucide-react';
import { CATEGORY_META } from '../data/themes';
import { CloudMuseum, IslandInvite, MuseumCategory } from '../types/museum';

interface MuseumDirectoryModalProps {
  isOpen: boolean;
  authUser: User | null;
  publicMuseums: CloudMuseum[];
  myMuseums: CloudMuseum[];
  acceptedLoans?: IslandInvite[];
  activeMuseumId: string;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenFlagship: () => void;
  onOpenCloudMuseum: (museum: CloudMuseum) => void;
  onOpenMuseumById?: (museumId: string) => void;
  onOpenEditorForMuseum: (museum: CloudMuseum) => void;
  onOpenCreateMuseum: () => void;
  onOpenInviteModal: () => void;
  onOpenGuide?: () => void;
  onCopyMuseumLink?: (museum: CloudMuseum) => void;
  onSignIn: () => void;
  onClose: () => void;
}

export const MuseumDirectoryModal: React.FC<MuseumDirectoryModalProps> = ({
  isOpen,
  authUser,
  publicMuseums,
  myMuseums,
  acceptedLoans = [],
  activeMuseumId,
  loading,
  error,
  onRefresh,
  onOpenFlagship,
  onOpenCloudMuseum,
  onOpenMuseumById,
  onOpenEditorForMuseum,
  onOpenCreateMuseum,
  onOpenInviteModal,
  onOpenGuide,
  onCopyMuseumLink,
  onSignIn,
  onClose,
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | MuseumCategory>('all');
  const [loanedOnly, setLoanedOnly] = useState<boolean>(false);
  const [jumpInput, setJumpInput] = useState('');

  // Authoritative set of museum IDs with active accepted loans
  const loanedMuseumIds = useMemo(() => {
    const ids = new Set<string>();
    for (const loan of acceptedLoans) {
      if (loan.status === 'accepted' && loan.museumId) {
        ids.add(loan.museumId);
      }
    }
    return ids;
  }, [acceptedLoans]);

  const networkTotals = useMemo(() => {
    const totalIslands = publicMuseums.reduce((acc, m) => acc + (m.islandCount || 0), 0);
    const totalPieces = publicMuseums.reduce((acc, m) => acc + (m.pieceCount || 0), 0);
    return {
      museums: publicMuseums.length,
      islands: totalIslands,
      pieces: totalPieces,
    };
  }, [publicMuseums]);

  const handleOpenRandomMuseum = () => {
    const candidates = publicMuseums.filter((m) => m.id !== activeMuseumId);
    const pool = candidates.length > 0 ? candidates : publicMuseums;
    if (pool.length === 0) {
      onOpenFlagship();
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onOpenCloudMuseum(pick);
  };

  const handleQuickJump = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = jumpInput.trim();
    if (!raw || !onOpenMuseumById) return;
    const match = raw.match(/[?&]museum=([a-zA-Z0-9_-]+)/);
    const cleanId = (match ? match[1] : raw).replace(/^\/+/, '');
    if (!cleanId) return;
    setJumpInput('');
    onClose();
    onOpenMuseumById(cleanId);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filteredPublic = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return publicMuseums.filter((m) => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
      if (loanedOnly && !loanedMuseumIds.has(m.id)) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.authorName.toLowerCase().includes(q) ||
        m.subtitle.toLowerCase().includes(q)
      );
    });
  }, [publicMuseums, searchText, selectedCategory, loanedOnly, loanedMuseumIds]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Directorio de museos"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02141f]/80 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[90vh] max-h-[840px] w-full max-w-[1060px] flex-col overflow-hidden border-[3px] border-[#e1c875] bg-[#0b2b39] text-[#f8f4df] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f3d889]/25 bg-gradient-to-r from-[#164e59] to-[#092b3b] px-5 py-4">
          <div>
            <p className="font-pixel flex items-center gap-1.5 text-[9px] text-[#f4d47d]">
              <Compass className="h-3.5 w-3.5" />
              RED DE CREADORES · ARCHIPIÉLAGOS
            </p>
            <h2 className="mt-1.5 text-2xl font-bold text-[#fff9e8]">Explorar todos los museos</h2>
            <p className="text-sm text-[#c4ded2]">
              Visita museos de música, restaurantes, galerías de arte o crea el tuyo propio.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 border border-[#d8c47b]/70 bg-[#062230] px-3 py-2 text-xs font-semibold text-[#fff5d7] hover:bg-[#174d58] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInviteModal();
              }}
              className="inline-flex items-center gap-1.5 border border-[#7fd6cc] bg-[#0e3f4e] px-3 py-2 text-xs font-semibold text-[#e6fbf8] hover:bg-[#175b6e]"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#f4d47d]" />
              Tengo invitación
            </button>
            <button
              type="button"
              onClick={onOpenCreateMuseum}
              className="inline-flex items-center gap-1.5 border-2 border-[#f2d17b] bg-[#bd7544] px-3.5 py-2 text-xs font-bold text-[#fff9e8] hover:bg-[#a24d2e]"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear mi museo
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar directorio"
              className="flex h-9 w-9 items-center justify-center border border-[#d8c47b] bg-[#174d58] text-white hover:bg-[#b25f37]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="museum-scroll flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          {/* Cinta de Red Viva y Descubrimiento */}
          <section className="flex flex-wrap items-center justify-between gap-3 border border-[#7fd6cc]/35 bg-[#082431] p-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[#9fc4b8]">
                  Museos públicos
                </span>
                <strong className="text-lg font-bold text-[#fff9e8] tabular-nums">
                  {networkTotals.museums}
                </strong>
              </div>
              <div className="h-7 w-px bg-white/15" />
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[#9fc4b8]">
                  Islas en red
                </span>
                <strong className="text-lg font-bold text-[#fff9e8] tabular-nums">
                  {networkTotals.islands}
                </strong>
              </div>
              <div className="h-7 w-px bg-white/15" />
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[#9fc4b8]">
                  Obras expuestas
                </span>
                <strong className="text-lg font-bold text-[#fff9e8] tabular-nums">
                  {networkTotals.pieces}
                </strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {publicMuseums.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenRandomMuseum}
                  className="inline-flex min-h-[38px] items-center gap-1.5 border border-[#f2d17b] bg-[#1d6873] px-3 py-1.5 text-xs font-bold text-[#fff9e8] hover:bg-[#b25f37]"
                >
                  <Shuffle className="h-3.5 w-3.5 text-[#f4d47d]" />
                  <span>Museo al azar</span>
                </button>
              )}
              {onOpenGuide && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGuide();
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 border border-[#d8c47b]/60 bg-[#062230] px-3 py-1.5 text-xs font-semibold text-[#fff5d7] hover:bg-[#174d58]"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#f4d47d]" />
                  <span>Manifiesto · Guía 3 min</span>
                </button>
              )}
            </div>
          </section>

          {onOpenMuseumById && (
            <form
              onSubmit={handleQuickJump}
              className="flex flex-wrap items-center gap-2 border border-[#e0d7a5]/20 bg-[#07212d] px-4 py-3"
            >
              <label htmlFor="quick-jump-museum" className="text-xs font-semibold text-[#c4ded2]">
                Ir directo por enlace o ID de museo:
              </label>
              <input
                id="quick-jump-museum"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder="Pega ?museum=... o el ID del museo"
                className="min-w-[200px] flex-1 border border-[#537c79] bg-[#f0eedc] px-3 py-1.5 text-sm text-[#183b42]"
              />
              <button
                type="submit"
                className="border border-[#f2d17b] bg-[#1d6873] px-3.5 py-1.5 text-xs font-bold text-[#fff9e8] hover:bg-[#b25f37]"
              >
                Abrir museo
              </button>
            </form>
          )}

          {/* Museo original fijo */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-[#f4d47d]/60 bg-gradient-to-r from-[#174a57] to-[#0d3141] p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-pixel border border-[#f4d47d] bg-[#082532] px-2 py-0.5 text-[8px] text-[#f4d47d]">
                    ORIGINAL
                  </span>
                  <span className="text-xs font-semibold text-[#a7d6ca]">
                    Colección fundadora · Guardado local + respaldo JSON
                  </span>
                </div>
                <h3 className="mt-1.5 text-xl font-bold text-[#fff9e8]">
                  MUSEO 404 · siNOMBRE (Edición Original)
                </h3>
                <p className="mt-1 text-sm text-[#d0e6da]">
                  Las 6 islas originales: Patio 404, Lingüinales, Observatorio, Invernadero, Desierto y Taller.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenFlagship}
                disabled={activeMuseumId === 'flagship'}
                className={`font-pixel shrink-0 border-2 px-4 py-2.5 text-[9px] ${
                  activeMuseumId === 'flagship'
                    ? 'border-[#86d2c7] bg-[#134e5e] text-[#a7efe2]'
                    : 'border-[#f2d17b] bg-[#1d6873] text-[#fff9e8] hover:bg-[#b25f37]'
                }`}
              >
                {activeMuseumId === 'flagship' ? 'ESTÁS AQUÍ' : 'VISITAR ORIGINAL'}
              </button>
            </div>
          </section>

          {/* Mis Museos */}
          <section className="border border-[#e0d7a5]/20 bg-[#082330] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-pixel flex items-center gap-1.5 text-[10px] text-[#f4d47d]">
                <Sparkles className="h-3.5 w-3.5" />
                MIS MUSEOS EN LA NUBE
              </h3>
              {!authUser && (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center gap-1.5 border border-[#f2d17b] bg-[#1d6873] px-3 py-1.5 text-xs font-semibold text-[#fff9e8] hover:bg-[#b25f37]"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Entrar con Google para crear
                </button>
              )}
            </div>

            {!authUser ? (
              <p className="text-sm text-[#a9c7bc]">
                Inicia sesión con Google para crear tus propios museos, personalizar sus colores, subir obras o compartir piezas de otros creadores.
              </p>
            ) : myMuseums.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-[#e1c875]/35 bg-white/[0.03] p-4">
                <p className="text-sm text-[#c4ded2]">
                  Todavía no creas ningún museo en la nube. Empieza con una plantilla de música, menú o galería.
                </p>
                <button
                  type="button"
                  onClick={onOpenCreateMuseum}
                  className="inline-flex items-center gap-1.5 border border-[#f2d17b] bg-[#bd7544] px-3.5 py-2 text-xs font-semibold text-[#fff9e8] hover:bg-[#a24d2e]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear mi primer museo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {myMuseums.map((museum) => {
                  const isCurrent = activeMuseumId === museum.id;
                  const cat = CATEGORY_META[museum.category] || CATEGORY_META.personal;
                  return (
                    <div
                      key={museum.id}
                      className="flex flex-col justify-between gap-3 border border-[#e0d7a5]/25 bg-white/[0.04] p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-pixel border border-[#f4d47d]/50 bg-[#072634] px-2 py-0.5 text-[8px] text-[#f4d47d]">
                              {cat.badge}
                            </span>
                            {loanedMuseumIds.has(museum.id) && (
                              <span
                                className="font-pixel inline-flex items-center gap-1 border border-[#7fd6cc]/60 bg-[#0a3844] px-1.5 py-0.5 text-[7px] text-[#7fd6cc]"
                                title="Este museo cuenta con salas o islas en préstamo activo"
                              >
                                <Share2 className="h-2.5 w-2.5 text-[#7fd6cc]" />
                                ISLA PRESTADA
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs text-[#a9c7bc]">
                            {!museum.isPublic && <Lock className="h-3 w-3 text-[#f4d47d]" />}
                            {museum.isPublic ? 'Público' : 'Privado'}
                          </span>
                        </div>
                        <h4 className="mt-2 text-lg font-bold text-[#fff9e8]">{museum.title}</h4>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[#c4ded2]">
                          {museum.subtitle || cat.hint}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 border border-black/40"
                            style={{ backgroundColor: museum.theme.skyColor }}
                            title="Cielo"
                          />
                          <span
                            className="h-3.5 w-3.5 border border-black/40"
                            style={{ backgroundColor: museum.theme.oceanColor }}
                            title="Mar"
                          />
                          <span
                            className="h-3.5 w-3.5 border border-black/40"
                            style={{ backgroundColor: museum.theme.accentColor }}
                            title="Acento"
                          />
                          <span className="ml-1 text-xs text-[#9fc4b8] tabular-nums">
                            {museum.islandCount} islas · {museum.pieceCount} piezas
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenEditorForMuseum(museum)}
                            className="inline-flex items-center gap-1 border border-[#d8c47b]/60 bg-[#062230] px-2.5 py-1.5 text-xs text-[#fff5d7] hover:bg-[#174d58]"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenCloudMuseum(museum)}
                            className={`border px-3 py-1.5 text-xs font-semibold ${
                              isCurrent
                                ? 'border-[#86d2c7] bg-[#134e5e] text-[#a7efe2]'
                                : 'border-[#f2d17b] bg-[#1d6873] text-[#fff9e8] hover:bg-[#b25f37]'
                            }`}
                          >
                            {isCurrent ? 'Abierto' : 'Visitar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Directorio Público */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-pixel text-[10px] text-[#f4d47d]">
                MUSEOS PÚBLICOS DE LA COMUNIDAD ({filteredPublic.length})
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#476c6f]" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar por nombre o creador..."
                  className="w-full border border-[#537c79] bg-[#f0eedc] py-1.5 pl-8 pr-3 text-sm text-[#183b42]"
                />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  selectedCategory === 'all'
                    ? 'border-[#f4d47d] bg-[#bd7544] text-[#fff9e8]'
                    : 'border-[#e0d7a5]/25 bg-white/5 text-[#c4ded2] hover:bg-white/10'
                }`}
              >
                Todos
              </button>
              {(Object.entries(CATEGORY_META) as [MuseumCategory, { label: string }][]).map(
                ([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCategory(key)}
                    className={`border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      selectedCategory === key
                        ? 'border-[#f4d47d] bg-[#bd7544] text-[#fff9e8]'
                        : 'border-[#e0d7a5]/25 bg-white/5 text-[#c4ded2] hover:bg-white/10'
                    }`}
                  >
                    {info.label}
                  </button>
                )
              )}
              <div className="mx-1 h-5 w-px bg-white/20" />
              <button
                type="button"
                onClick={() => setLoanedOnly((prev) => !prev)}
                aria-pressed={loanedOnly}
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  loanedOnly
                    ? 'border-[#7fd6cc] bg-[#114b59] text-[#e6fbf8] shadow-[0_0_8px_rgba(127,214,204,0.3)]'
                    : 'border-[#7fd6cc]/40 bg-white/5 text-[#a7d6ca] hover:bg-white/10'
                }`}
              >
                <Share2 className="h-3 w-3 text-[#7fd6cc]" />
                <span>Con Islas Prestadas</span>
                {loanedMuseumIds.size > 0 && (
                  <span className="font-pixel ml-0.5 rounded bg-[#072634] px-1 py-0.2 text-[8px] text-[#7fd6cc]">
                    {loanedMuseumIds.size}
                  </span>
                )}
              </button>
            </div>

            {error && (
              <p className="mb-4 border border-[#e39b7f] bg-[#4c241d] px-4 py-3 text-sm text-[#ffd9cc]">
                {error}
              </p>
            )}

            {loading && publicMuseums.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#a9c7bc]">
                Cargando museos de la comunidad...
              </p>
            ) : filteredPublic.length === 0 ? (
              <div className="border border-dashed border-[#e0d7a5]/25 bg-white/[0.03] p-6 text-center">
                <p className="text-sm text-[#c4ded2]">
                  {publicMuseums.length === 0
                    ? 'Aún no hay museos públicos publicados en la red. ¡Crea el primero!'
                    : 'Ningún museo coincide con ese filtro.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPublic.map((museum) => {
                  const isCurrent = activeMuseumId === museum.id;
                  const cat = CATEGORY_META[museum.category] || CATEGORY_META.personal;
                  return (
                    <article
                      key={museum.id}
                      className="flex flex-col justify-between gap-3 border border-[#e0d7a5]/25 bg-[#082431] p-4 transition-colors hover:border-[#e1c875]/60"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-pixel border border-[#f4d47d]/50 bg-[#0b2b39] px-2 py-0.5 text-[8px] text-[#f4d47d]">
                              {cat.badge}
                            </span>
                            {loanedMuseumIds.has(museum.id) && (
                              <span
                                className="font-pixel inline-flex items-center gap-1 border border-[#7fd6cc]/60 bg-[#0a3844] px-1.5 py-0.5 text-[7px] text-[#7fd6cc]"
                                title="Este museo cuenta con salas o islas en préstamo activo"
                              >
                                <Share2 className="h-2.5 w-2.5 text-[#7fd6cc]" />
                                ISLA PRESTADA
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className="h-3 w-3 border border-black/40"
                              style={{ backgroundColor: museum.theme.skyColor }}
                            />
                            <span
                              className="h-3 w-3 border border-black/40"
                              style={{ backgroundColor: museum.theme.oceanColor }}
                            />
                            <span
                              className="h-3 w-3 border border-black/40"
                              style={{ backgroundColor: museum.theme.accentColor }}
                            />
                          </div>
                        </div>

                        <h4 className="mt-2.5 text-lg font-bold leading-snug text-[#fff9e8]">
                          {museum.title}
                        </h4>
                        <p className="mt-0.5 text-xs font-semibold text-[#f4d47d]">
                          por {museum.authorName}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#c4ded2]">
                          {museum.subtitle || cat.hint}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                        <span className="text-xs text-[#9fc4b8] tabular-nums">
                          {museum.islandCount} islas · {museum.pieceCount} piezas
                        </span>
                        <div className="flex items-center gap-1.5">
                          {onCopyMuseumLink && (
                            <button
                              type="button"
                              onClick={() => onCopyMuseumLink(museum)}
                              title="Copiar enlace directo al museo"
                              aria-label={`Copiar enlace de ${museum.title}`}
                              className="inline-flex items-center justify-center border border-[#d8c47b]/45 bg-[#062230] p-1.5 text-[#f4d47d] hover:bg-[#174d58]"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenCloudMuseum(museum)}
                            className={`border px-3 py-1.5 text-xs font-bold ${
                              isCurrent
                                ? 'border-[#86d2c7] bg-[#134e5e] text-[#a7efe2]'
                                : 'border-[#f2d17b] bg-[#1d6873] text-[#fff9e8] hover:bg-[#b25f37]'
                            }`}
                          >
                            {isCurrent ? 'Visitando' : 'Entrar al museo'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
