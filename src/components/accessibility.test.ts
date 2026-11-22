import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// WCAG relative luminance formula
function luminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(...hexToRgb(hex1));
  const l2 = luminance(...hexToRgb(hex2));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('Accessibility & WCAG AA Compliance Tests', () => {
  it('WCAG AA Normal Text Contrast: all key UI text exceeds 4.5:1 ratio', () => {
    const pairings = [
      { name: 'Top bar button text on dark header', fg: '#fff9e6', bg: '#053143', min: 4.5 },
      { name: 'Top bar button accent yellow on dark header', fg: '#f4d47d', bg: '#053143', min: 4.5 },
      { name: 'Top bar salir button muted teal text on dark header', fg: '#d0e6da', bg: '#053143', min: 4.5 },
      { name: 'Modal editorial accent rust on cream header', fg: '#8b3a1a', bg: '#e6e3ca', min: 4.5 },
      { name: 'Modal subtitle teal on cream header', fg: '#35575b', bg: '#e6e3ca', min: 4.5 },
      { name: 'Modal tab text unselected on cream nav', fg: '#35575b', bg: '#ebe8d1', min: 4.5 },
      { name: 'Modal tab text selected on dialog background', fg: '#8b3a1a', bg: '#f1efd9', min: 4.5 },
      { name: 'Modal primary body text on cream dialog', fg: '#1c343a', bg: '#f1efd9', min: 4.5 },
      { name: 'RoomExplorer2D header controls on dark slate', fg: '#fff5d7', bg: '#0d3545', min: 4.5 },
      { name: 'RoomExplorer2D subtext & footer on deep blue', fg: '#9dc4ba', bg: '#051d29', min: 4.5 },
      { name: 'Editor sidebar room count on dark navy', fg: '#9fc4b8', bg: '#082532', min: 4.5 },
    ];

    for (const pair of pairings) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      assert.ok(
        ratio >= pair.min,
        `${pair.name}: contrast ratio ${ratio.toFixed(2)} is less than required ${pair.min}:1`
      );
    }
  });

  it('WCAG AA Focus Rings: dark and light surfaces have high-contrast :focus-visible outlines', () => {
    const darkFocusRatio = contrastRatio('#f4d47d', '#0b2b39');
    assert.ok(
      darkFocusRatio >= 3.0,
      `Dark focus outline #f4d47d against dark surface #0b2b39 has ratio ${darkFocusRatio.toFixed(2)}, expected >= 3.0:1`
    );

    const lightFocusRatio = contrastRatio('#163d4a', '#f1efd9');
    assert.ok(
      lightFocusRatio >= 3.0,
      `Light focus outline #163d4a against cream surface #f1efd9 has ratio ${lightFocusRatio.toFixed(2)}, expected >= 3.0:1`
    );
  });

  it('Touch Targets: RoomExplorer2D mobile D-pad and action buttons have min 44x44px hit areas', () => {
    const file = readFileSync(
      resolve(process.cwd(), 'src/components/RoomExplorer2D.tsx'),
      'utf-8'
    );

    // Directional buttons must have min 44px
    assert.ok(
      file.includes('min-h-[44px] min-w-[44px]'),
      'RoomExplorer2D must declare min-h-[44px] min-w-[44px] on mobile directional and action controls'
    );
    assert.ok(
      file.includes('touch-manipulation'),
      'RoomExplorer2D mobile buttons must declare touch-manipulation to eliminate tap delay'
    );
  });

  it('Modal Dialog Accessibility: all modals declare role="dialog", aria-modal="true" and use focus trap hook', () => {
    const modalFiles = [
      'AboutGuideModal.tsx',
      'CharacterSelectorModal.tsx',
      'ContentModal.tsx',
      'CreateMuseumModal.tsx',
      'GuestbookModal.tsx',
      'LoanInviteModal.tsx',
      'MuseumDirectoryModal.tsx',
      'MuseumEditor.tsx',
      'SharePieceModal.tsx',
      'SupportProjectModal.tsx',
    ];

    for (const fileName of modalFiles) {
      const content = readFileSync(
        resolve(process.cwd(), `src/components/${fileName}`),
        'utf-8'
      );
      assert.ok(
        content.includes('role="dialog"') || content.includes("role=\"dialog\""),
        `${fileName} must declare role="dialog"`
      );
      assert.ok(
        content.includes('aria-modal="true"'),
        `${fileName} must declare aria-modal="true"`
      );
      assert.ok(
        content.includes('useModalFocusTrap'),
        `${fileName} must implement useModalFocusTrap for keyboard trapping and focus restoration`
      );
    }
  });

  it('Touch Targets: modal close buttons have min-h-[44px] min-w-[44px]', () => {
    const modalFilesWithCloseButtons = [
      'AboutGuideModal.tsx',
      'CharacterSelectorModal.tsx',
      'ContentModal.tsx',
      'CreateMuseumModal.tsx',
      'GuestbookModal.tsx',
      'LoanInviteModal.tsx',
      'MuseumDirectoryModal.tsx',
      'MuseumEditor.tsx',
      'SharePieceModal.tsx',
      'SupportProjectModal.tsx',
      'IslandDrawer.tsx',
    ];

    for (const fileName of modalFilesWithCloseButtons) {
      const content = readFileSync(
        resolve(process.cwd(), `src/components/${fileName}`),
        'utf-8'
      );
      assert.ok(
        content.includes('min-h-[44px] min-w-[44px]'),
        `${fileName} close button must meet 44x44px minimum touch target size`
      );
    }
  });
});
