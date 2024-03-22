import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import YAML from 'yaml';

export const USER_ADDRESS_BOOK = path.join(os.homedir(), '.address-book.yaml');

export interface AddressBook {
  [id: string]: string | {
    address: string;
    note?: string;
  };
}

export function addr(book: AddressBook, name: string): string {
  const entry = book[name];
  if (typeof entry === 'string') return entry;
  if (entry) return entry.address;
  throw new Error(`No address found for ${name}`);
}

export function note(book: AddressBook, name: string): string | undefined {
  const entry = book[name];
  if (typeof entry === 'string') return undefined;
  if (entry) return entry.note;
  throw new Error(`No address found for ${name}`);
}

export function combineAddressBooks(...books: AddressBook[]): AddressBook {
  return Object.assign({}, ...books);
}

export async function loadAddressBook(filepath: string): Promise<AddressBook> {
  try {
    const content = await fs.readFile(filepath, 'utf8');
    return YAML.parse(content);
  } catch {
    return {};
  }
}

export async function loadAddressBooks(...filepaths: string[]): Promise<AddressBook> {
  return combineAddressBooks(...await Promise.all(filepaths.map(loadAddressBook)));
}
