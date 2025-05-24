import { openDB } from 'idb';

/** Open `gymDB` and make sure the `logs` store exists. */
export const getDB = () => openDB('gymDB', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('logs')) {
      db.createObjectStore('logs', { autoIncrement: true });
    }
  },
});
