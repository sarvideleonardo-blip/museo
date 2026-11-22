import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CloudMuseum, IslandInvite, MuseumCategory } from '../types/museum.ts';

// Helper mock creator for tests
function createMockMuseum(overrides: Partial<CloudMuseum> = {}): CloudMuseum {
  return {
    id: overrides.id || 'm-default',
    ownerId: overrides.ownerId || 'u-default',
    authorName: overrides.authorName || 'Author',
    title: overrides.title || 'Museum Title',
    subtitle: overrides.subtitle || 'Museum Subtitle',
    category: (overrides.category as MuseumCategory) || 'arte',
    templateId: 'blank',
    theme: {
      presetId: 'classic',
      skyColor: '#6ec9da',
      oceanColor: '#2caac0',
      accentColor: '#f4d47d',
      surfaceColor: '#072634',
      roomThemeId: 'classic',
    },
    defaultCharacterId: 'explorador',
    isPublic: overrides.isPublic !== undefined ? overrides.isPublic : true,
    islands: overrides.islands || [],
    rooms: overrides.rooms || [],
    islandCount: overrides.islandCount !== undefined ? overrides.islandCount : 1,
    pieceCount: overrides.pieceCount !== undefined ? overrides.pieceCount : 0,
  };
}

function createMockLoan(overrides: Partial<IslandInvite> = {}): IslandInvite {
  return {
    id: overrides.id || 'loan-1',
    museumId: overrides.museumId || 'm-1',
    museumTitle: overrides.museumTitle || 'Museum Title',
    hostUid: overrides.hostUid || 'host-1',
    hostName: overrides.hostName || 'Host Name',
    islandId: overrides.islandId || 'isl-1',
    islandTitle: overrides.islandTitle || 'Island Title',
    status: overrides.status || 'accepted',
    guestUid: overrides.guestUid !== undefined ? overrides.guestUid : 'guest-1',
    guestName: overrides.guestName || 'Guest Name',
    sourceMuseumId: overrides.sourceMuseumId || 'm-origin',
    sourceMuseumTitle: overrides.sourceMuseumTitle || 'Origin Museum',
    sourceMuseumUrl: overrides.sourceMuseumUrl || '?museum=m-origin',
    createdAt: overrides.createdAt || '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-01-01T00:00:00.000Z',
  };
}

/**
 * Filter function implementing the exact logic in MuseumDirectoryModal
 */
function filterMuseums(params: {
  museums: CloudMuseum[];
  acceptedLoans: IslandInvite[];
  searchText: string;
  selectedCategory: 'all' | MuseumCategory;
  loanedOnly: boolean;
}): { filtered: CloudMuseum[]; loanedIds: Set<string> } {
  const { museums, acceptedLoans, searchText, selectedCategory, loanedOnly } = params;

  // Authoritative set of museum IDs with active accepted loans
  const loanedIds = new Set<string>();
  for (const loan of acceptedLoans) {
    if (loan.status === 'accepted' && loan.museumId) {
      loanedIds.add(loan.museumId);
    }
  }

  const q = searchText.trim().toLowerCase();
  const filtered = museums.filter((m) => {
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    if (loanedOnly && !loanedIds.has(m.id)) return false;
    if (!q) return true;
    return (
      m.title.toLowerCase().includes(q) ||
      m.authorName.toLowerCase().includes(q) ||
      m.subtitle.toLowerCase().includes(q)
    );
  });

  return { filtered, loanedIds };
}

describe('Museum Directory Loan Filter and Active Badge Logic', () => {
  it('correctly builds authoritative loanedIds set from accepted loans only', () => {
    const loans: IslandInvite[] = [
      createMockLoan({ id: 'l1', museumId: 'm-active-1', status: 'accepted' }),
      createMockLoan({ id: 'l2', museumId: 'm-pending', status: 'pending' }),
      createMockLoan({ id: 'l3', museumId: 'm-revoked', status: 'revoked' }),
      createMockLoan({ id: 'l4', museumId: 'm-active-2', status: 'accepted' }),
    ];

    const museums = [
      createMockMuseum({ id: 'm-active-1', title: 'Museum 1' }),
      createMockMuseum({ id: 'm-pending', title: 'Museum 2' }),
      createMockMuseum({ id: 'm-revoked', title: 'Museum 3' }),
      createMockMuseum({ id: 'm-active-2', title: 'Museum 4' }),
      createMockMuseum({ id: 'm-no-loans', title: 'Museum 5' }),
    ];

    const { loanedIds } = filterMuseums({
      museums,
      acceptedLoans: loans,
      searchText: '',
      selectedCategory: 'all',
      loanedOnly: false,
    });

    assert.equal(loanedIds.size, 2);
    assert.equal(loanedIds.has('m-active-1'), true, 'm-active-1 should have active loan badge');
    assert.equal(loanedIds.has('m-active-2'), true, 'm-active-2 should have active loan badge');
    assert.equal(loanedIds.has('m-pending'), false, 'Pending loan does not give badge');
    assert.equal(loanedIds.has('m-revoked'), false, 'Revoked loan does not give badge');
    assert.equal(loanedIds.has('m-no-loans'), false, 'Museum without loans has no badge');
  });

  it('filters museums by category correctly', () => {
    const museums = [
      createMockMuseum({ id: 'm1', category: 'arte' }),
      createMockMuseum({ id: 'm2', category: 'musica' }),
      createMockMuseum({ id: 'm3', category: 'gastronomia' }),
      createMockMuseum({ id: 'm4', category: 'arte' }),
    ];

    const resArte = filterMuseums({
      museums,
      acceptedLoans: [],
      searchText: '',
      selectedCategory: 'arte',
      loanedOnly: false,
    });
    assert.equal(resArte.filtered.length, 2);
    assert.deepEqual(resArte.filtered.map((m) => m.id), ['m1', 'm4']);

    const resMusica = filterMuseums({
      museums,
      acceptedLoans: [],
      searchText: '',
      selectedCategory: 'musica',
      loanedOnly: false,
    });
    assert.equal(resMusica.filtered.length, 1);
    assert.equal(resMusica.filtered[0].id, 'm2');

    const resAll = filterMuseums({
      museums,
      acceptedLoans: [],
      searchText: '',
      selectedCategory: 'all',
      loanedOnly: false,
    });
    assert.equal(resAll.filtered.length, 4);
  });

  it('filters museums by loanedOnly correctly using authoritative status', () => {
    const museums = [
      createMockMuseum({ id: 'm-with-active-loan', title: 'Colaborativo' }),
      createMockMuseum({ id: 'm-with-revoked-loan', title: 'Antiguo' }),
      createMockMuseum({ id: 'm-alone', title: 'Solitario' }),
    ];

    const loans = [
      createMockLoan({ museumId: 'm-with-active-loan', status: 'accepted' }),
      createMockLoan({ museumId: 'm-with-revoked-loan', status: 'revoked' }),
    ];

    const result = filterMuseums({
      museums,
      acceptedLoans: loans,
      searchText: '',
      selectedCategory: 'all',
      loanedOnly: true,
    });

    assert.equal(result.filtered.length, 1);
    assert.equal(result.filtered[0].id, 'm-with-active-loan');
  });

  it('combines category, search, and loanedOnly filters properly', () => {
    const museums = [
      createMockMuseum({ id: 'm1', title: 'Arte Contemporáneo', authorName: 'Elena', category: 'arte' }),
      createMockMuseum({ id: 'm2', title: 'Arte Digital', authorName: 'Carlos', category: 'arte' }),
      createMockMuseum({ id: 'm3', title: 'Música Pop', authorName: 'Elena', category: 'musica' }),
      createMockMuseum({ id: 'm4', title: 'Arte Abstracto', authorName: 'Elena', category: 'arte' }),
    ];

    const loans = [
      createMockLoan({ museumId: 'm1', status: 'accepted' }),
      createMockLoan({ museumId: 'm3', status: 'accepted' }),
    ];

    // Filter: category = 'arte', loanedOnly = true, search = 'elena'
    const res = filterMuseums({
      museums,
      acceptedLoans: loans,
      searchText: 'elena',
      selectedCategory: 'arte',
      loanedOnly: true,
    });

    assert.equal(res.filtered.length, 1);
    assert.equal(res.filtered[0].id, 'm1');
  });

  it('handles empty results and empty acceptedLoans array cleanly without exceptions', () => {
    const museums: CloudMuseum[] = [];
    const res = filterMuseums({
      museums,
      acceptedLoans: [],
      searchText: 'nonexistent',
      selectedCategory: 'literatura',
      loanedOnly: true,
    });

    assert.equal(res.filtered.length, 0);
    assert.equal(res.loanedIds.size, 0);
  });
});
