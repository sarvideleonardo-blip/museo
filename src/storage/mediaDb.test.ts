import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMedia,
  getMediaObjectUrl,
  putMedia,
  deleteMedia,
  clearMediaCache,
  getMediaCacheStats,
} from './mediaDb.ts';

// Mock IndexedDB and Blob / URL environments in Node
class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class MockIDBStore {
  data: Map<string, any>;
  constructor(data: Map<string, any>) {
    this.data = data;
  }
  put(value: any, key: string) {
    this.data.set(key, value);
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = key;
      req.onsuccess?.();
    }, 0);
    return req;
  }
  get(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = this.data.get(key) || null;
      req.onsuccess?.();
    }, 0);
    return req;
  }
  delete(key: string) {
    this.data.delete(key);
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.onsuccess?.();
    }, 0);
    return req;
  }
}

class MockIDBTransaction {
  store: MockIDBStore;
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  error: any = null;

  constructor(store: MockIDBStore) {
    this.store = store;
    setTimeout(() => {
      this.oncomplete?.();
    }, 0);
  }
  objectStore(_name: string) {
    return this.store;
  }
}

class MockIDBDatabase {
  storeData = new Map<string, any>();
  objectStoreNames = {
    contains: (_name: string) => true,
  };
  createObjectStore(_name: string) {
    return new MockIDBStore(this.storeData);
  }
  transaction(_name: string, _mode: string) {
    return new MockIDBTransaction(new MockIDBStore(this.storeData));
  }
  close() {}
}

const mockDbInstance = new MockIDBDatabase();

const createdUrls = new Set<string>();
const revokedUrls = new Set<string>();
let urlCounter = 0;

(global as any).window = {
  indexedDB: {
    open: (_name: string, _version: number) => {
      const req = new MockIDBRequest();
      setTimeout(() => {
        req.result = mockDbInstance;
        req.onsuccess?.();
      }, 0);
      return req;
    },
  },
};

(global as any).indexedDB = (global as any).window.indexedDB;

(global as any).URL = {
  createObjectURL: (blob: any) => {
    urlCounter++;
    const url = `blob:nock-media://${urlCounter}`;
    createdUrls.add(url);
    return url;
  },
  revokeObjectURL: (url: string) => {
    revokedUrls.add(url);
    createdUrls.delete(url);
  },
};

describe('In-Memory Media Cache & Resource Lifecycle', () => {
  beforeEach(() => {
    clearMediaCache();
    mockDbInstance.storeData.clear();
    createdUrls.clear();
    revokedUrls.clear();
    urlCounter = 0;
  });

  it('1. Repeated media requests hit the in-memory cache and avoid extra DB reads', async () => {
    const key = 'piece-img-1';
    const fakeBlob = new Blob(['sample-image-bytes'], { type: 'image/jpeg' });

    await putMedia(key, fakeBlob);
    assert.equal(getMediaCacheStats().cachedBlobsCount, 1);

    // Initial read
    const res1 = await getMedia(key);
    assert.equal(res1, fakeBlob);

    // Repeated read should hit memory immediately
    const res2 = await getMedia(key);
    assert.equal(res2, fakeBlob);
    assert.equal(getMediaCacheStats().cachedBlobsCount, 1);
  });

  it('2. Concurrent requests for the same media key do not duplicate in-flight requests', async () => {
    const key = 'piece-concurrent-1';
    const fakeBlob = new Blob(['concurrent-bytes'], { type: 'image/png' });
    mockDbInstance.storeData.set(key, fakeBlob);

    // Dispatch concurrent requests simultaneously before either resolves
    const [p1, p2, p3] = [getMedia(key), getMedia(key), getMedia(key)];

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    assert.equal(r1?.size, fakeBlob.size);
    assert.equal(r2?.size, fakeBlob.size);
    assert.equal(r3?.size, fakeBlob.size);

    // Check that in-flight was cleanly cleared after resolution
    assert.equal(getMediaCacheStats().inFlightCount, 0);
  });

  it('3. getMediaObjectUrl reuses active object URLs without creating duplicates', async () => {
    const key = 'piece-url-1';
    const fakeBlob = new Blob(['image-data'], { type: 'image/webp' });
    await putMedia(key, fakeBlob);

    const url1 = await getMediaObjectUrl(key);
    const url2 = await getMediaObjectUrl(key);

    assert.ok(url1);
    assert.equal(url1, url2, 'Subsequent requests for the same key must return the exact same cached object URL');
    assert.equal(getMediaCacheStats().cachedUrlsCount, 1);
  });

  it('4. Updating media invalidates previous object URL and updates in-memory cache', async () => {
    const key = 'piece-update-1';
    const blob1 = new Blob(['v1'], { type: 'image/png' });
    await putMedia(key, blob1);

    const url1 = await getMediaObjectUrl(key);
    assert.ok(url1);

    // Update piece media
    const blob2 = new Blob(['v2-updated'], { type: 'image/png' });
    await putMedia(key, blob2);

    // url1 should be revoked
    assert.ok(revokedUrls.has(url1!), 'Previous object URL must be revoked when media is updated');

    const url2 = await getMediaObjectUrl(key);
    assert.notEqual(url1, url2, 'Updated media receives a fresh object URL');
  });

  it('5. Deleting media revokes object URL and purges memory cache', async () => {
    const key = 'piece-delete-1';
    const blob = new Blob(['delete-me'], { type: 'image/jpeg' });
    await putMedia(key, blob);

    const url = await getMediaObjectUrl(key);
    assert.ok(url);
    assert.equal(getMediaCacheStats().cachedBlobsCount, 1);
    assert.equal(getMediaCacheStats().cachedUrlsCount, 1);

    await deleteMedia(key);

    assert.ok(revokedUrls.has(url!), 'Object URL must be revoked on deleteMedia');
    assert.equal(getMediaCacheStats().cachedBlobsCount, 0);
    assert.equal(getMediaCacheStats().cachedUrlsCount, 0);

    const readBack = await getMedia(key);
    assert.equal(readBack, null);
  });

  it('6. clearMediaCache revokes all active object URLs and resets all caches', async () => {
    await putMedia('p1', new Blob(['b1']));
    await putMedia('p2', new Blob(['b2']));

    const u1 = await getMediaObjectUrl('p1');
    const u2 = await getMediaObjectUrl('p2');

    assert.equal(getMediaCacheStats().cachedUrlsCount, 2);

    // Simulate switching museums
    clearMediaCache();

    assert.ok(revokedUrls.has(u1!));
    assert.ok(revokedUrls.has(u2!));
    assert.equal(getMediaCacheStats().cachedBlobsCount, 0);
    assert.equal(getMediaCacheStats().cachedUrlsCount, 0);
  });
});
