import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

const LOGDIR = path.join(__dirname, '..', 'logs');
await fs.mkdir(LOGDIR, { recursive: true });

interface DumpObject {
  cat: string;
  subcat?: string;
}

export const logger = {
  testmode: false,
  debug: (...data: any[]) => {
    console.log(chalk.hex('6A04E8')(`[${timestamp()} DEBUG]`), ...data);
  },
  info: (...data: any[]) => {
    console.log(chalk.white(`[${timestamp()} INFO]`), ...data);
  },
  log: (...data: any[]) => {
    console.log(chalk.grey(`[${timestamp()} LOG]`), ...data);
  },
  warn: (...data: any[]) => {
    console.log(chalk.yellow(`[${timestamp()} WARN]`), ...data);
  },
  error: (...data: any[]) => {
    console.log(chalk.red(`[${timestamp()} ERROR]`), ...data);
  },
  dump: async<T extends DumpObject>(data: T) => {
    if (logger.testmode) return;
    console.log(chalk.hex('6A04E8')(`[${timestamp()} DUMP]`), data);
    await fs.appendFile(`${LOGDIR}/${datestamp()}.log`, `[${timestamp(false)}] ${JSON.stringify(data, null, 2)}\n\n`);
  },
};

function timestamp(withDate = true) {
  const now = new Date(Date.now());
  const date = `${now.getFullYear() % 100}/${now.getMonth() + 1}/${now.getDate()}`;
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  return withDate
    ? `${date} ${time}`
    : time;
}

function datestamp() {
  const now = new Date(Date.now());
  return `${now.getFullYear() % 100}-${now.getMonth() + 1}-${now.getDate()}`;
}
