import Dexie, { type EntityTable } from 'dexie';
import type { SaveItem } from '@savesutra/core';

/** On-device library (IndexedDB). Nothing leaves the phone unless the user connects a server or adds an AI key. */
export class LocalDb extends Dexie {
  items!: EntityTable<SaveItem, 'id'>;
  constructor(name = 'savesutra') {
    super(name);
    this.version(1).stores({ items: 'id, &seq, url, createdAt, status' });
  }
}

let instance: LocalDb | undefined;
export function localDb(): LocalDb {
  instance ??= new LocalDb();
  return instance;
}
