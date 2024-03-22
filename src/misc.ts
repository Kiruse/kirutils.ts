import fs from 'fs/promises';
import path from 'path';

export function envar(name: string): string;
export function envar(name: string, defaultValue: string): string;
export function envar(...args: any[]): string {
  if (args.length === 1) {
    const [name] = args;
    if (!process.env[name]) {
      throw new Error(`Environment variable ${name} is not set`);
    }
    return process.env[name]!;
  } else {
    const [name, defaultValue] = args;
    return process.env[name] ?? defaultValue;
  }
}

export function envarBool(name: string): boolean;
export function envarBool(name: string, defaultValue: boolean): boolean;
export function envarBool(...args: any[]): boolean {
  //@ts-ignore
  const value: any = envar(...args);
  return value === 'true' || value === true || value === '1' || value === 1;
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

export const findPackageRoot = async (dir: string) => path.dirname(await findAncestorFile(dir, 'package.json'));

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
