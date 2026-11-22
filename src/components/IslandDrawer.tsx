import React, { useEffect, useState } from 'react';
import { X, Compass, ArrowLeft, Share2, BookOpen } from 'lucide-react';
import { getMedia } from '../storage/mediaDb';
import { Island, MuseumPiece, MuseumThemeConfig, Room } from '../types/museum';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface IslandDrawerProps {
  island: Island | null;
  rooms: Room[];
  selectedRoomId: string | null;
  piecesByRoom: Record<string, MuseumPiece[]>;
  theme?: MuseumThemeConfig;
  onSelectRoom: (roomId: string | null) => void;
  onOpenPiece: (piece: MuseumPiece) => void;
  onEnter2DMode: (islandId: string, roomId: string) => void;
  onOpenGuestbook?: (island: Island, room: Room | null) => void;
  onOpenOriginMuseum?: (url: string, sourceMuseumId?: string) => void;
  onClose: () => void;
}

const PieceThumbnail: React.FC<{ mediaKey?: string | null; mediaDataUrl?: string | null }> = ({
  mediaKey,
  mediaDataUrl,
}) => {
  const [url, setUrl] = useState<string | null>(mediaDataUrl || null);

  useEffect(() => {
    if (mediaDataUrl) {
      setUrl(mediaDataUrl);
      return;
    }
    if (!mediaKey) {
      setUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    getMedia(mediaKey).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaKey, mediaDataUrl]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="h-12 w-12 shrink-0 border-2 border-[#d6b85d] bg-[#163b48] object-cover"
    />
  );
};

export const IslandDrawer: React.FC<IslandDrawerProps> = ({
  island,
  rooms,
  selectedRoomId,
  piecesByRoom,
  theme,
  onSelectRoom,
  onOpenPiece,
  onEnter2DMode,
  onOpenGuestbook,
  onOpenOriginMuseum,
  onClose,
}) => {
  const drawerRef = useModalFocusTrap({ isOpen: Boolean(island), onClose });

  if (!island) return null;

  const activeRoom =
    rooms.find((r) => r.id === selectedRoomId) || (rooms.length === 1 ? rooms[0] : null);

  const totalPieces = rooms.reduce(
    (sum, r) => sum + (piecesByRoom[r.id]?.length || 0),
    0
  );

  const activePieces = activeRoom ? piecesByRoom[activeRoom.id] || [] : [];
  const accentColor = theme?.accentColor || '#f4d47d';
  const surfaceColor = theme?.surfaceColor || '#08232f';

  return (
    <aside
      ref={drawerRef}
      aria-live="polite"
      aria-label="Colección de la isla"
      style={{
        backgroundColor: `${surfaceColor}f2`,
        borderColor: accentColor,
      }}
      className="fixed bottom-3 left-3 right-3 z-30 flex max-h-[68vh] flex-col border-[3px] text-[#f8f3df] shadow-[0_12px_35px_rgba(0,20,31,0.45),8px_8px_0_rgba(4,27,39,0.4)] md:bottom-auto md:left-auto md:right-8 md:top-1/2 md:max-h-[78vh] md:w-[390px] md:-translate-y-1/2"
    >
      <div className="relative border-b border-[#f3d889]/30 bg-gradient-to-br from-[#24686f]/55 to-[#072b3a]/30 px-5 pb-4 pt-5">
        <p className="font-pixel text-[9px] tracking-wide" style={{ color: accentColor }}>
          {island.eyebrow || 'ARCHIVO INSULAR'}
        </p>
        <h2 className="mt-2 pr-9 text-2xl font-bold leading-tight text-[#fff9e8]">
          {activeRoom ? activeRoom.name : island.title}
        </h2>
        <p className="mt-1.5 text-[15px] leading-snug text-[#d0e6da]">
          {activeRoom ? activeRoom.description || island.description : island.description}
        </p>

        {island.loaned && (() => {
          const originHref =
            island.loaned.sourceMuseumUrl ||
            (island.loaned.sourceMuseumId
              ? `?museum=${encodeURIComponent(island.loaned.sourceMuseumId)}`
              : '#');
          const isExternal = /^https?:\/\//i.test(originHref);
          return (
            <div className="mt-3 border border-white/45 bg-white/10 px-3 py-2 text-xs text-[#edf5f7]">
              <p className="font-semibold text-[#fff9e6]">
                Isla Prestada · por {island.loaned.sourceMuseumTitle}
              </p>
              <a
                href={originHref}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (
                    onOpenOriginMuseum &&
                    !isExternal &&
                    (island.loaned?.sourceMuseumId || originHref.startsWith('?museum='))
                  ) {
                    e.preventDefault();
                    onOpenOriginMuseum(originHref, island.loaned?.sourceMuseumId);
                  }
                }}
                className="mt-1 inline-block font-semibold underline decoration-[#f4d47d] underline-offset-2 hover:text-[#f4d47d]"
                style={{ color: accentColor }}
              >
                → Ver en {island.loaned.sourceMuseumTitle}
              </a>
            </div>
          );
        })()}

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/45 bg-black/25 text-white transition-colors hover:bg-[#b25f37]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {rooms.length > 0 && (
            <button
              type="button"
              onClick={() => onEnter2DMode(island.id, (activeRoom || rooms[0]).id)}
              style={{ borderColor: accentColor }}
              className="font-pixel flex min-h-[44px] flex-1 items-center justify-center gap-2 border-2 bg-[#1d6873] px-3 py-2.5 text-[9px] text-[#fff9e8] transition-colors hover:bg-[#b25f37]"
            >
              <Compass className="h-3.5 w-3.5 shrink-0" />
              <span>EXPLORAR 2D</span>
            </button>
          )}
          {onOpenGuestbook && (
            <button
              type="button"
              onClick={() => onOpenGuestbook(island, activeRoom)}
              className="font-pixel inline-flex min-h-[44px] items-center justify-center gap-1.5 border-2 border-white/55 bg-[#0a3646] px-3 py-2.5 text-[9px] text-[#fff9e8] transition-colors hover:bg-[#175566]"
              title="Abrir libro de visitas de esta sala o isla"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
              <span>VISITAS</span>
            </button>
          )}
        </div>
      </div>

      <div className="museum-scroll flex-1 overflow-y-auto px-3 py-2.5">
        {!activeRoom ? (
          rooms.length === 0 ? (
            <p className="p-3 text-sm text-[#a9c7bc]">
              Esta isla todavía no tiene salas. Abre el Editor para crear una.
            </p>
          ) : (
            rooms.map((room, index) => (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className="my-1 flex w-full items-center gap-3 border border-[#e0d7a5]/20 bg-white/[0.045] px-3 py-3 text-left transition-colors hover:border-[#e3cc7d] hover:bg-[#82c29b]/15"
              >
                <span
                  style={{ backgroundColor: accentColor }}
                  className="font-pixel flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-bold text-[#1b3540] tabular-nums"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold leading-tight text-[#f8f3df]">
                    {room.name}
                  </span>
                  <span className="mt-1 block text-xs text-[#a7c5bc] tabular-nums">
                    {(piecesByRoom[room.id] || []).length} piezas · Entrar a la sala
                  </span>
                </span>
              </button>
            ))
          )
        ) : activePieces.length === 0 ? (
          <p className="p-3 text-sm leading-relaxed text-[#a9c7bc]">
            Esta sala está vacía. Puedes cargar textos, imágenes, audio, vídeo o enlaces desde «Editar museo».
          </p>
        ) : (
          activePieces.map((item, index) => {
            const sale = item.saleStatus && item.saleStatus !== 'not_for_sale' ? item.saleStatus : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenPiece(item)}
                className="my-1 flex w-full items-center gap-3 border border-[#e0d7a5]/20 bg-white/[0.045] px-3 py-2.5 text-left transition-colors hover:border-[#e3cc7d] hover:bg-[#82c29b]/15"
              >
                {item.mediaDataUrl || item.mediaKey ? (
                  <PieceThumbnail mediaKey={item.mediaKey} mediaDataUrl={item.mediaDataUrl} />
                ) : (
                  <span
                    style={{ backgroundColor: accentColor }}
                    className="font-pixel flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-bold text-[#1b3540] tabular-nums"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-base font-semibold leading-tight text-[#f8f3df]">
                      {item.title}
                    </span>
                    {sale && (
                      <span
                        className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-bold uppercase tabular-nums ${
                          sale === 'for_sale'
                            ? 'border-[#75e4dc]/60 bg-[#124e59] text-[#a5f5ee]'
                            : sale === 'reserved'
                              ? 'border-[#f4d47d]/60 bg-[#4b3e1b] text-[#f8e196]'
                              : 'border-[#e08b79]/60 bg-[#522721] text-[#ffd4cb]'
                        }`}
                      >
                        {sale === 'for_sale'
                          ? item.priceLabel || 'En venta'
                          : sale === 'reserved'
                            ? 'Reservada'
                            : 'Vendida'}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#a7c5bc]">
                    {item.subtitle || 'Abrir pieza'}
                  </span>
                  {item.curatedFrom && (
                    <span
                      className="mt-1 inline-flex items-center gap-1 text-[11px]"
                      style={{ color: accentColor }}
                    >
                      <Share2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">De «{item.curatedFrom.sourceMuseumTitle}»</span>
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#f3d889]/25 px-4 py-2.5 text-xs text-[#9dbeb5]">
        {activeRoom && rooms.length > 1 ? (
          <button
            type="button"
            onClick={() => onSelectRoom(null)}
            className="inline-flex items-center gap-1.5 border border-[#d8c47b]/60 bg-[#051d28] px-2.5 py-1 text-xs text-[#fff5d7] hover:bg-[#174d58]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Ver salas ({rooms.length})
          </button>
        ) : (
          <span>{island.footer || 'Selecciona una pieza para abrirla.'}</span>
        )}
        <span className="tabular-nums text-[#d0e6da]">
          {rooms.length} salas · {totalPieces} piezas
        </span>
      </div>
    </aside>
  );
};
