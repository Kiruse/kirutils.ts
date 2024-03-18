import fs from 'fs/promises';
import path from 'path';

export function envar(name: string): string {
  if (!process.env[name]) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return process.env[name]!;
}

export async function findAncestorFile(dir: string, file: string): Promise<string> {
  while (dir !== '/') {
    const filePath = path.join(dir, file);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error(`Failed to locate ${file} in ancestor path of "${dir}"`);
}

export const findPackageRoot = (dir: string) => findAncestorFile(dir, 'package.json');

export async function findFiles(root: string, pred: (file: string) => boolean): Promise<string[]> {
  let result: string[] = [];
  const find = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    result.push(...entries
      .filter(f => f.isFile())
      .filter(f => pred(path.join(dir, f.name)))
      .map(f => path.join(dir, f.name))
    );
    await Promise.all(entries.filter(f => f.isDirectory()).map(f => find(path.join(dir, f.name))));
  }
  await find(root);
  return result;
}

export const toCamelCase  = (str: string) => str.replace(/[_-]([a-z])/g, (_, c) => c.toUpperCase());
export const toSnakeCase  = (str: string) => toCamelCase(str).replace(/[A-Z]+/g, c => `_${c.toLowerCase()}`);
export const toShoutCase  = (str: string) => toSnakeCase(str).toUpperCase();
export const toKebabCase  = (str: string) => toCamelCase(str).replace(/[A-Z]+/g, c => `-${c.toLowerCase()}`);
export const toPascalCase = (str: string) => toCamelCase(str).replace(/^./, c => c.toUpperCase());
