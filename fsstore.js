'use strict';

/*
 * Folder auto-save via the File System Access API. Lets the app write its data
 * to a folder the user picks once and reload it later. The chosen directory
 * handle is kept in IndexedDB so it survives a refresh (re-granting read/write
 * permission may need one click). Requires a secure context (https or
 * http://localhost) and a Chromium browser. Exposed as window.FSStore; all
 * methods no-op gracefully where unsupported.
 */
(function () {
  const FILE = 'velocity-data.json';
  const DB = 'vp-fs', STORE = 'handles', KEY = 'dir';

  function supported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  function idb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function idbSet(key, val) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGet(key) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const g = tx.objectStore(STORE).get(key);
      g.onsuccess = () => res(g.result || null);
      g.onerror = () => rej(g.error);
    });
  }
  async function idbDel(key) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  // Query (and optionally request) read/write permission on a handle.
  async function permission(handle, request) {
    if (!handle) return 'denied';
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return 'granted';
    if (!request) return 'prompt';
    return await handle.requestPermission(opts);
  }

  async function connect() {
    const handle = await window.showDirectoryPicker({ id: 'velocity', mode: 'readwrite' });
    if ((await permission(handle, true)) !== 'granted') throw new Error('Permission not granted');
    await idbSet(KEY, handle);
    return handle;
  }
  async function stored() { try { return await idbGet(KEY); } catch (_) { return null; } }
  async function forget() { try { await idbDel(KEY); } catch (_) {} }

  async function write(handle, obj) {
    const fh = await handle.getFileHandle(FILE, { create: true });
    const w = await fh.createWritable();
    await w.write(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    await w.close();
  }
  async function read(handle) {
    try {
      const fh = await handle.getFileHandle(FILE, { create: false });
      const txt = await (await fh.getFile()).text();
      return txt ? JSON.parse(txt) : null;
    } catch (_) { return null; }
  }

  window.FSStore = { supported, connect, stored, forget, write, read, permission, FILE };
})();
