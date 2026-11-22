const DB_NAME = 'Museo404Media';
const DB_STORE = 'files';

// In-memory cache for media Blobs and active Object URLs
// Bounded size to prevent unbounded memory growth in large sessions
const MAX_CACHE_ENTRIES = 120;
const blobCache = new Map<string, Blob>();
const objectUrlCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<Blob | null>>();

function evictOldestIfFull(): void {
  if (blobCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = blobCache.keys().next().value;
    if (oldestKey) {
      blobCache.delete(oldestKey);
      const url = objectUrlCache.get(oldestKey);
      if (url) {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
        objectUrlCache.delete(oldestKey);
      }
    }
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB.'));
  });
}

/**
 * Persists a media blob to IndexedDB and updates the in-memory cache.
 * If an object URL was cached for this key, it is invalidated and revoked.
 */
export async function putMedia(key: string, blob: Blob): Promise<void> {
  // Invalidate previous object URL if any
  const existingUrl = objectUrlCache.get(key);
  if (existingUrl) {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(existingUrl);
    }
    objectUrlCache.delete(key);
  }

  // Update in-memory blob cache
  evictOldestIfFull();
  blobCache.set(key, blob);

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(blob, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('No se pudo guardar el archivo multimedia.'));
    };
  });
}

/**
 * Retrieves a media Blob by key.
 * Checks in-memory cache first, dedupes concurrent reads, and falls back to IndexedDB.
 */
export async function getMedia(key: string): Promise<Blob | null> {
  if (!key) return null;

  // 1. Check in-memory cache
  if (blobCache.has(key)) {
    return blobCache.get(key) || null;
  }

  // 2. Check in-flight concurrent requests to avoid duplicate reads
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)!;
  }

  // 3. Read from IndexedDB
  const readPromise = (async () => {
    try {
      const db = await openDB();
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as Blob) || null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      });

      if (blob) {
        evictOldestIfFull();
        blobCache.set(key, blob);
      }
      return blob;
    } catch {
      return null;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, readPromise);
  return readPromise;
}

/**
 * Gets or creates a cached object URL for a media key.
 * Avoids creating duplicate Object URLs across multiple components.
 */
export async function getMediaObjectUrl(key: string): Promise<string | null> {
  if (!key) return null;

  if (objectUrlCache.has(key)) {
    return objectUrlCache.get(key)!;
  }

  const blob = await getMedia(key);
  if (!blob) return null;

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(key, url);
    return url;
  }
  return null;
}

/**
 * Deletes media from IndexedDB and clears all associated cache entries and object URLs.
 */
export async function deleteMedia(key: string): Promise<void> {
  // Clear in-memory caches and revoke URL
  blobCache.delete(key);
  const existingUrl = objectUrlCache.get(key);
  if (existingUrl) {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(existingUrl);
    }
    objectUrlCache.delete(key);
  }
  inFlightRequests.delete(key);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silenciar errores si IndexedDB no está disponible
  }
}

/**
 * Clears the in-memory cache and revokes all active object URLs.
 * Useful when switching museums or unmounting heavy views.
 */
export function clearMediaCache(): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    for (const url of objectUrlCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }
  }
  objectUrlCache.clear();
  blobCache.clear();
  inFlightRequests.clear();
}

/**
 * Inspect cache metrics (useful for profiling and automated tests).
 */
export function getMediaCacheStats(): {
  cachedBlobsCount: number;
  cachedUrlsCount: number;
  inFlightCount: number;
} {
  return {
    cachedBlobsCount: blobCache.size,
    cachedUrlsCount: objectUrlCache.size,
    inFlightCount: inFlightRequests.size,
  };
}

export async function compactImage(file: File): Promise<Blob> {
  if (!file || !file.type?.startsWith('image/') || !('createImageBitmap' in window)) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.86)
    );
    return blob || file;
  } catch {
    return file;
  }
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Error al leer archivo.'));
    reader.readAsDataURL(blob);
  });
}

export function dataURLToBlob(dataURL: string): Blob {
  const [meta, data] = dataURL.split(',');
  const mimeMatch = meta?.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(data || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function compactImageToDataUrl(file: File, maxChars = 155000): Promise<string> {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido.');
  }
  if (!('createImageBitmap' in window)) {
    const raw = await blobToDataURL(file);
    if (raw.length > maxChars) {
      throw new Error('La imagen es demasiado pesada para compartir en la nube.');
    }
    return raw;
  }

  const bitmap = await createImageBitmap(file);
  try {
    let maxSide = 760;
    let quality = 0.78;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo procesar la imagen en el navegador.');
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxChars) {
        return dataUrl;
      }
      maxSide = Math.round(maxSide * 0.76);
      quality = Math.max(0.45, quality - 0.1);
    }

    const fallback = canvas.toDataURL('image/jpeg', 0.42);
    if (fallback.length > maxChars) {
      throw new Error('La imagen sigue siendo demasiado grande; intenta con una más pequeña.');
    }
    return fallback;
  } finally {
    bitmap.close?.();
  }
}
