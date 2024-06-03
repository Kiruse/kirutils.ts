import { Event } from '@kiruse/typed-events';
import { DateTime } from 'luxon';
import path from 'path';
import { findFiles } from './misc.js';

export interface ScheduledTask {
  /** Schedule either as interval or as HH:MM time. It is not very complex unlike cron jobs.
   * Intervals are calculated from the start of the day at midnight. Meaning an interval of 7m will
   * last run at 23:55, and then again at 00:07 the next day.
   *
   * Can be either in format `<number>[m|h]`, a string in minutes, or a string in HH:MM format, or
   * an array of multiple of these values. When in HH:MM format, you can use '*' as a wildcard. Thus,
   * you can use '**:30' to run at every half hour, or '12:*0' to run every 10 minutes between
   * 12:00 and 12:59.
   *
   * By default, tasks run on an hourly schedule.
   */
  schedule?: string | number | (string | number)[];
  handler(): Promise<void> | void;
}

/**
 * Runs `.coffee` scripts in the specified directory as scheduled tasks. These tasks are dynamically
 * imported, and are expected to expose an interface matching `ScheduledTask`.
 *
 * Example script:
 * ```coffee
 * export schedule = '**:00' # run the script at every full hour
 * export handler = ->
 *   # do something
 * ```
 *
 * The schedule can also be denominated in `'<number>[m|h]'` and as an array of multiple values.
 * For example, `['6:00', '18:00']` will run the script at 6:00 and 18:00.
 *
 * Scripts do not take any arguments. This scheduler makes use of bun's ability to load non-js files.
 *
 * This function returns the cancellation function. Call it to stop the scheduler.
 */
export function runSchedules(basepath: string) {
  let timeout: any, interval: any;
  const onError = Event<{ file?: string, error: any }>();

  async function runner() {
    const schedules = await getSchedule(basepath);
    await Promise.all(schedules.map(async file => {
      try {
        const task: ScheduledTask = await import(path.resolve(file));
        if (isScheduled(task)) await task.handler();
      } catch (error) {
        onError.emit({ file, error });
      }
    }));
  }

  const now = Date.now();
  const target = (Math.floor(now / 60000) + 1) * 60000;
  const delay = target - now;
  timeout = setTimeout(() => {
    runner().catch((e) => onError.emit({ error: e }));
    interval = setInterval(runner, 60000);
  }, delay);

  function cancel() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  }
  cancel.onError = onError;
  return cancel;
}

const getSchedule = (basepath: string) => findFiles(basepath, file => file.endsWith('.coffee'));

function isScheduled({ schedule = 1 }: ScheduledTask): boolean {
  const now = DateTime.now().toUTC().toJSDate();
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const time = `${hour}:${minute}`;

  function pred(s: string | number | ((time: string) => boolean)) {
    if (typeof s === 'number') return Date.now() % (s * 60000) === 0;
    if (typeof s === 'string') {
      if (s.match(/^[\d*]{2}:[\d*]{2}$/)) {
        const rx = new RegExp(s.replace(/\*/g, '\\d'));
        return rx.test(time);
      } else if (s.match(/^\d{1,2}[mh]?$/)) {
        const now = Date.now();

        return s.endsWith('h')
          ? Math.floor(now / 3600000) % parseInt(s) === 0
          : Math.floor(now / 60000)   % parseInt(s) === 0;
      } else {
        throw Error(`Invalid schedule format: ${s}`);
      }
    }
    if (typeof s === 'function') {
      return s(time);
    }
    return false;
  }

  return Array.isArray(schedule) ? schedule.some(pred) : pred(schedule);
}
