import React from 'react';
import { Island, IslandBiome, IslandShapeStyle } from '../types/museum';

interface IslandArtworkSvgProps {
  biome: IslandBiome;
  cx: number;
  cy: number;
  scale?: number;
  islandStyle?: IslandShapeStyle;
}

/**
 * Renderiza el arte vectorial pixel-art isométrico de una isla centrado alrededor de (cx, cy)
 * dentro del viewBox 1440x900 del archipiélago.
 */
export const IslandArtworkSvg: React.FC<IslandArtworkSvgProps> = ({
  biome,
  cx,
  cy,
  scale = 1,
  islandStyle = 'cliffs',
}) => {
  // Cada grupo original tiene su centro visual aproximado en (205, 110)
  const tx = cx - 205 * scale;
  const ty = cy - 110 * scale;

  return (
    <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
      {islandStyle === 'floating' && (
        <>
          <ellipse
            cx="205"
            cy="242"
            rx="172"
            ry="32"
            fill="none"
            stroke="#8ef5ff"
            strokeWidth="5"
            opacity="0.72"
            filter="url(#softGlow)"
          />
          <path
            d="M45 142 L205 272 L365 142 L205 210Z"
            fill="#2d4c5c"
            stroke="#1d3544"
            strokeWidth="4"
          />
        </>
      )}
      {islandStyle === 'terraced' && (
        <path
          d="M2 132 L205 244 L408 132 L408 158 L205 270 L2 158Z"
          fill="#cbb994"
          stroke="#5f513d"
          strokeWidth="4"
        />
      )}
      {biome === 'forest' && (
        <>
          <ellipse cx="205" cy="192" rx="205" ry="42" fill="#001c2a" opacity=".35" filter="url(#islandShadow)" />
          <path d="M20 100 L190 10 L390 94 L208 190Z" fill="#583f3a" stroke="#3d3637" strokeWidth="5" />
          <path d="M20 100 L208 190 L208 226 L30 135Z" fill="#7d523b" stroke="#3e3836" strokeWidth="4" />
          <path d="M208 190 L390 94 L390 132 L208 226Z" fill="#543e3c" stroke="#3e3836" strokeWidth="4" />
          <path d="M20 100 L190 10 L390 94 L208 190Z" fill="url(#grass)" stroke="#317c52" strokeWidth="4" />
          <path d="M20 100 L190 10 L390 94 L208 190Z" fill="url(#pixelDots)" opacity=".7" />
          <path d="M55 103 L192 42 L342 103 L211 167Z" fill="none" stroke="#d2d48a" strokeWidth="10" opacity=".6" />
          <g stroke="#58402f" strokeWidth="5">
            <path d="M92 82v45m42-65v49m186-2v48m-67-85v42" />
          </g>
          <g fill="#2f7848" stroke="#225b42" strokeWidth="4">
            <rect x="66" y="49" width="42" height="34" />
            <rect x="79" y="32" width="32" height="31" />
            <rect x="118" y="16" width="44" height="34" />
            <rect x="100" y="39" width="38" height="34" />
            <rect x="264" y="54" width="44" height="33" />
            <rect x="282" y="34" width="37" height="32" />
            <rect x="305" y="85" width="34" height="26" />
          </g>
          <g fill="#6dbd67">
            <rect x="76" y="43" width="17" height="12" />
            <rect x="127" y="23" width="20" height="13" />
            <rect x="276" y="42" width="18" height="12" />
            <rect x="310" y="90" width="14" height="9" />
          </g>
          <g>
            <rect x="176" y="96" width="14" height="24" fill="#e2c17c" />
            <rect x="169" y="83" width="29" height="17" fill="#b54d67" />
            <rect x="174" y="76" width="19" height="12" fill="#f0bb85" />
          </g>
          <g fill="#e4d47b" stroke="#a88c4c" strokeWidth="2">
            <rect x="233" y="111" width="12" height="11" />
            <rect x="250" y="120" width="9" height="9" />
          </g>
        </>
      )}

      {biome === 'observatory' && (
        <>
          <ellipse cx="195" cy="215" rx="205" ry="40" fill="#001b2b" opacity=".36" filter="url(#islandShadow)" />
          <path d="M15 115 L188 25 L390 115 L204 212Z" fill="#544346" stroke="#353841" strokeWidth="5" />
          <path d="M15 115 L204 212 L204 248 L24 148Z" fill="#866047" stroke="#443b3c" strokeWidth="4" />
          <path d="M204 212 L390 115 L390 153 L204 248Z" fill="#594048" stroke="#443b3c" strokeWidth="4" />
          <path d="M15 115 L188 25 L390 115 L204 212Z" fill="#61a968" stroke="#32775d" strokeWidth="4" />
          <path d="M47 116 L186 45 L355 120 L205 193Z" fill="none" stroke="#a9d68d" strokeWidth="8" opacity=".65" />
          <g stroke="#213d54" strokeWidth="4">
            <rect x="74" y="66" width="34" height="74" fill="#3f647b" />
            <rect x="113" y="50" width="42" height="90" fill="#273a5b" />
            <rect x="158" y="28" width="44" height="124" fill="#3c476d" />
            <rect x="209" y="55" width="38" height="90" fill="#385d6c" />
            <rect x="256" y="76" width="30" height="68" fill="#334965" />
            <rect x="82" y="47" width="18" height="19" fill="#7d69aa" />
            <rect x="125" y="38" width="18" height="12" fill="#d75f88" />
            <rect x="172" y="12" width="18" height="16" fill="#c179d2" />
            <rect x="218" y="41" width="20" height="14" fill="#e07d98" />
          </g>
          <g fill="#75e4dc">
            <rect x="81" y="81" width="7" height="9" />
            <rect x="94" y="81" width="7" height="9" />
            <rect x="121" y="66" width="8" height="10" />
            <rect x="139" y="66" width="8" height="10" />
            <rect x="169" y="51" width="9" height="10" />
            <rect x="185" y="51" width="9" height="10" />
            <rect x="220" y="72" width="8" height="9" />
          </g>
          <g stroke="#514267" strokeWidth="4">
            <rect x="172" y="-10" width="36" height="58" fill="#8d67aa" />
            <path d="M169 -8 L190 -48 L211 -8Z" fill="#673b8f" />
          </g>
          <g fill="#f2d079" filter="url(#softGlow)">
            <rect x="187" y="7" width="7" height="12" />
            <rect x="181" y="78" width="6" height="7" />
          </g>
        </>
      )}

      {biome === 'ice' && (
        <>
          <ellipse cx="190" cy="205" rx="205" ry="38" fill="#001b2a" opacity=".35" filter="url(#islandShadow)" />
          <path d="M12 100 L184 16 L376 98 L202 190Z" fill="#496a78" stroke="#42617a" strokeWidth="5" />
          <path d="M12 100 L202 190 L202 226 L18 137Z" fill="#769baa" stroke="#436579" strokeWidth="4" />
          <path d="M202 190 L376 98 L376 133 L202 226Z" fill="#4f7289" stroke="#3f6079" strokeWidth="4" />
          <path d="M12 100 L184 16 L376 98 L202 190Z" fill="url(#ice)" stroke="#a7e5e7" strokeWidth="5" />
          <path d="M44 100 L184 35 L341 101 L202 172Z" fill="none" stroke="#f2ffff" strokeWidth="9" opacity=".65" />
          <g stroke="#547d9c" strokeWidth="4">
            <rect x="152" y="40" width="90" height="80" fill="#b9e7ef" />
            <rect x="126" y="62" width="31" height="56" fill="#c4edf1" />
            <rect x="239" y="65" width="29" height="55" fill="#c0e7ee" />
            <path d="M143 42 L169 4 L195 42Z" fill="#8fd0e3" />
            <path d="M195 42 L220 4 L247 42Z" fill="#8fd0e3" />
            <path d="M123 64 L141 32 L159 64Z" fill="#70b5d2" />
            <path d="M237 65 L253 34 L270 65Z" fill="#70b5d2" />
            <rect x="183" y="73" width="25" height="47" fill="#5485a4" />
            <path d="M180 73 L195 53 L211 73Z" fill="#5988a9" />
          </g>
          <g fill="#4a7897">
            <rect x="164" y="57" width="9" height="18" />
            <rect x="220" y="58" width="9" height="18" />
            <rect x="135" y="77" width="8" height="14" />
            <rect x="249" y="80" width="8" height="14" />
          </g>
        </>
      )}

      {biome === 'patio' && (
        <>
          <ellipse cx="210" cy="224" rx="230" ry="43" fill="#001b2a" opacity=".4" filter="url(#islandShadow)" />
          <path d="M0 105 L204 0 L425 108 L218 220Z" fill="#59483f" stroke="#3a3939" strokeWidth="5" />
          <path d="M0 105 L218 220 L218 265 L6 148Z" fill="#956345" stroke="#493b38" strokeWidth="4" />
          <path d="M218 220 L425 108 L425 151 L218 265Z" fill="#64453d" stroke="#493b38" strokeWidth="4" />
          <path d="M0 105 L204 0 L425 108 L218 220Z" fill="url(#grass)" stroke="#418b58" strokeWidth="5" />
          <path d="M28 106 L205 19 L393 109 L217 202Z" fill="none" stroke="#b8db8b" strokeWidth="10" opacity=".75" />
          <path d="M139 106 L204 72 L271 106 L205 142Z" fill="#d5c99b" stroke="#877b63" strokeWidth="4" />
          <path d="M178 105 L205 91 L232 105 L205 119Z" fill="#85d8df" stroke="#3c8d9b" strokeWidth="3" />
          <path d="M194 94 L205 83 L216 94 L205 100Z" fill="#e2f7e7" />
          <g fill="#d3ead0" opacity=".9">
            <rect x="202" y="73" width="5" height="18" />
            <rect x="197" y="67" width="5" height="9" />
            <rect x="208" y="63" width="5" height="13" />
          </g>
          <g stroke="#65462f" strokeWidth="8">
            <path d="M304 97 L304 52 M304 71 L277 43 M304 70 L331 40" />
          </g>
          <g fill="#337e4e" stroke="#236341" strokeWidth="4">
            <rect x="266" y="26" width="35" height="32" />
            <rect x="287" y="9" width="39" height="36" />
            <rect x="316" y="27" width="37" height="31" />
            <rect x="296" y="38" width="39" height="30" />
          </g>
          <g fill="#8dca6e">
            <rect x="278" y="29" width="12" height="9" />
            <rect x="300" y="15" width="17" height="11" />
          </g>
        </>
      )}

      {biome === 'desert' && (
        <>
          <ellipse cx="185" cy="180" rx="200" ry="34" fill="#001b2a" opacity=".36" filter="url(#islandShadow)" />
          <path d="M12 80 L178 0 L370 83 L195 175Z" fill="#58423c" stroke="#3c3738" strokeWidth="5" />
          <path d="M12 80 L195 175 L195 211 L18 119Z" fill="#9a6844" stroke="#4e3c39" strokeWidth="4" />
          <path d="M195 175 L370 83 L370 120 L195 211Z" fill="#65473d" stroke="#4e3c39" strokeWidth="4" />
          <path d="M12 80 L178 0 L370 83 L195 175Z" fill="url(#sand)" stroke="#bd8d55" strokeWidth="5" />
          <path d="M50 88 L181 25 L332 89 L197 157Z" fill="none" stroke="#f8e1a0" strokeWidth="9" opacity=".6" />
          <path d="M113 98 L174 30 L244 98Z" fill="#c28b51" stroke="#8d603d" strokeWidth="4" />
          <path d="M174 30 L244 98 L181 107Z" fill="#8e6040" stroke="#714b39" strokeWidth="3" />
          <path d="M163 82 L174 68 L187 83 L187 106 L163 106Z" fill="#5b4540" />
          <g fill="#397b52" stroke="#245a43" strokeWidth="3">
            <rect x="55" y="75" width="12" height="40" />
            <rect x="43" y="85" width="12" height="8" />
            <rect x="43" y="75" width="8" height="16" />
            <rect x="65" y="91" width="12" height="8" />
          </g>
          <g fill="#b9854e" stroke="#805738" strokeWidth="2">
            <rect x="276" y="92" width="25" height="18" />
            <rect x="282" y="82" width="12" height="12" />
          </g>
        </>
      )}

      {biome === 'workshop' && (
        <>
          <ellipse cx="195" cy="184" rx="206" ry="37" fill="#001b2a" opacity=".38" filter="url(#islandShadow)" />
          <path d="M8 82 L185 0 L390 88 L204 179Z" fill="#4e3c43" stroke="#342f38" strokeWidth="5" />
          <path d="M8 82 L204 179 L204 218 L15 121Z" fill="#8d583e" stroke="#49383b" strokeWidth="4" />
          <path d="M204 179 L390 88 L390 125 L204 218Z" fill="#593d42" stroke="#49383b" strokeWidth="4" />
          <path d="M8 82 L185 0 L390 88 L204 179Z" fill="url(#neon)" stroke="#774b4b" strokeWidth="5" />
          <path d="M40 87 L186 19 L351 92 L205 160Z" fill="none" stroke="#dca474" strokeWidth="8" opacity=".6" />
          <g stroke="#3f3544" strokeWidth="4">
            <rect x="65" y="49" width="45" height="74" fill="#7d584e" />
            <rect x="112" y="35" width="44" height="91" fill="#45556a" />
            <rect x="164" y="21" width="52" height="115" fill="#a55a4b" />
            <rect x="223" y="52" width="40" height="73" fill="#4c4d60" />
            <rect x="267" y="69" width="36" height="60" fill="#82544a" />
          </g>
          <g fill="#f4d36e">
            <rect x="76" y="62" width="9" height="11" />
            <rect x="91" y="62" width="9" height="11" />
            <rect x="123" y="50" width="9" height="12" />
            <rect x="176" y="38" width="9" height="12" />
            <rect x="193" y="38" width="9" height="12" />
          </g>
          <g fill="#68e0d4" filter="url(#softGlow)">
            <rect x="116" y="78" width="36" height="7" />
            <rect x="170" y="58" width="41" height="8" />
            <rect x="231" y="91" width="28" height="7" />
          </g>
          <g fill="#d17d5e" stroke="#573b43" strokeWidth="3">
            <rect x="301" y="42" width="17" height="63" />
            <rect x="316" y="31" width="12" height="74" />
          </g>
        </>
      )}

      {biome === 'volcano' && (
        <>
          <ellipse cx="195" cy="188" rx="205" ry="38" fill="#001824" opacity=".42" filter="url(#islandShadow)" />
          <path d="M10 88 L186 6 L388 92 L202 186Z" fill="#3a1e22" stroke="#241417" strokeWidth="5" />
          <path d="M10 88 L202 186 L202 224 L16 128Z" fill="#5c2e28" stroke="#36171b" strokeWidth="4" />
          <path d="M202 186 L388 92 L388 128 L202 224Z" fill="#421e20" stroke="#36171b" strokeWidth="4" />
          <path d="M10 88 L186 6 L388 92 L202 186Z" fill="url(#volcano)" stroke="#6e2d26" strokeWidth="5" />
          <path d="M42 92 L185 24 L348 96 L204 165Z" fill="none" stroke="#e05438" strokeWidth="6" opacity=".7" />
          {/* Volcanic crater caldera */}
          <path d="M130 96 L186 42 L250 96 L186 130Z" fill="#200d11" stroke="#4a1815" strokeWidth="4" />
          <path d="M152 92 L186 58 L224 92 L186 114Z" fill="#ff4d2e" stroke="#ffa347" strokeWidth="3" filter="url(#softGlow)" />
          <rect x="180" y="76" width="12" height="12" fill="#fff099" />
          {/* Magma rivulets */}
          <path d="M186 114 L186 156 L202 176" fill="none" stroke="#ff5c33" strokeWidth="3" />
          <path d="M152 92 L112 110 L94 130" fill="none" stroke="#ff733b" strokeWidth="3" />
          {/* Obsidian pillars */}
          <g fill="#1a0f14" stroke="#472322" strokeWidth="3">
            <rect x="78" y="70" width="16" height="38" />
            <rect x="296" y="68" width="18" height="42" />
            <rect x="264" y="44" width="14" height="32" />
          </g>
        </>
      )}

      {biome === 'crypt' && (
        <>
          <ellipse cx="195" cy="188" rx="205" ry="38" fill="#001824" opacity=".4" filter="url(#islandShadow)" />
          <path d="M12 90 L188 12 L386 94 L204 188Z" fill="#363042" stroke="#231f2b" strokeWidth="5" />
          <path d="M12 90 L204 188 L204 224 L18 130Z" fill="#524a61" stroke="#2d2838" strokeWidth="4" />
          <path d="M204 188 L386 94 L386 128 L204 224Z" fill="#3c3547" stroke="#2d2838" strokeWidth="4" />
          <path d="M12 90 L188 12 L386 94 L204 188Z" fill="url(#crypt)" stroke="#5d5270" strokeWidth="5" />
          <path d="M44 94 L186 32 L346 98 L204 168Z" fill="none" stroke="#8e82a6" strokeWidth="7" opacity=".65" />
          {/* Gothic stone crypt / mausoleum */}
          <g stroke="#262230" strokeWidth="4">
            <rect x="146" y="38" width="88" height="82" fill="#504861" />
            <rect x="162" y="16" width="56" height="26" fill="#3d374a" />
            <path d="M160 16 L190 -8 L220 16Z" fill="#675d7d" />
            <rect x="178" y="68" width="24" height="52" fill="#1b1724" />
          </g>
          {/* Eerie spirit lantern */}
          <rect x="186" y="78" width="8" height="12" fill="#9df5e8" filter="url(#softGlow)" />
          {/* Mossy stone pillars and tombs */}
          <g fill="#433d52" stroke="#282433" strokeWidth="3">
            <rect x="74" y="66" width="18" height="52" />
            <rect x="104" y="80" width="26" height="24" />
            <rect x="268" y="70" width="18" height="48" />
            <rect x="298" y="82" width="28" height="22" />
          </g>
          {/* Ivy / moss accents */}
          <g fill="#5d856c">
            <rect x="76" y="76" width="6" height="8" />
            <rect x="148" y="52" width="8" height="6" />
            <rect x="272" y="82" width="7" height="6" />
          </g>
        </>
      )}

      {biome === 'coral' && (
        <>
          <ellipse cx="195" cy="188" rx="205" ry="38" fill="#001824" opacity=".35" filter="url(#islandShadow)" />
          <path d="M12 90 L188 12 L386 94 L204 188Z" fill="#205c58" stroke="#143b38" strokeWidth="5" />
          <path d="M12 90 L204 188 L204 224 L18 130Z" fill="#368781" stroke="#1d4d49" strokeWidth="4" />
          <path d="M204 188 L386 94 L386 128 L204 224Z" fill="#256b66" stroke="#1d4d49" strokeWidth="4" />
          <path d="M12 90 L188 12 L386 94 L204 188Z" fill="url(#coral)" stroke="#45b8ad" strokeWidth="5" />
          <path d="M44 94 L186 32 L346 98 L204 168Z" fill="none" stroke="#bbf5eb" strokeWidth="8" opacity=".7" />
          {/* Turquoise tidal pool */}
          <ellipse cx="190" cy="106" rx="36" ry="20" fill="#32c7be" stroke="#e0fcf7" strokeWidth="3" />
          <ellipse cx="190" cy="106" rx="22" ry="11" fill="#75faed" />
          {/* Coral towers and sea anemone structures */}
          <g stroke="#802a42" strokeWidth="3">
            <rect x="110" y="52" width="22" height="46" fill="#e85d75" />
            <rect x="104" y="44" width="14" height="18" fill="#f0788d" />
            <rect x="122" y="38" width="16" height="22" fill="#f58e9f" />
            <rect x="254" y="58" width="24" height="42" fill="#eb6b56" />
            <rect x="246" y="48" width="16" height="18" fill="#f28877" />
            <rect x="268" y="42" width="14" height="22" fill="#faa193" />
          </g>
          {/* Pearl & sea glass highlights */}
          <g fill="#ffffff" filter="url(#softGlow)">
            <circle cx="118" cy="46" r="3" />
            <circle cx="262" cy="52" r="3.5" />
            <circle cx="190" cy="106" r="2.5" />
          </g>
        </>
      )}
    </g>
  );
};

export function buildBridgePaths(islands: Island[]): Array<{ key: string; d: string }> {
  const hub = islands.find((i) => i.id === 'patio') || islands[0];
  if (!hub) return [];

  const hx = hub.x * 14.4;
  const hy = hub.y * 9;

  return islands
    .filter((isl) => isl.id !== hub.id)
    .map((isl) => {
      const ix = isl.x * 14.4;
      const iy = isl.y * 9;
      const mx = (hx + ix) / 2;
      const my = (hy + iy) / 2 - 18;
      return {
        key: `${hub.id}-${isl.id}`,
        d: `M${hx.toFixed(0)} ${hy.toFixed(0)} L${mx.toFixed(0)} ${my.toFixed(0)} L${ix.toFixed(0)} ${iy.toFixed(0)}`,
      };
    });
}
