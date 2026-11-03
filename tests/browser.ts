import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Browser, Page } from 'playwright';
import { videoSource } from './fixtures/video.ts';

export const artifacts = ['src', 'user'] as const;
export type Artifact = typeof artifacts[number];

declare global {
  interface Window {
    scriptResources: { listeners: number; intervals: number; scans: number };
  }
}

export interface PlayerOptions {
  segments?: string;
  duration?: number;
  path?: string;
  empty?: boolean;
  deferScript?: boolean;
}

export function segment(start: string, width: string, color = 'rgb(255, 0, 0)', property = 'left'): string {
  return `<span data-test-selector="seekbar-segment__segment" style="${property}:${start};width:${width};background-color:${color}"></span>`;
}

export const mutedRange = segment('10%', '10%');

export function playerHtml(options: PlayerOptions = {}): string {
  return `<div data-a-target="video-player"><video muted playsinline preload="auto" src="${videoSource}"></video><div data-a-target="player-seekbar">${options.segments ?? mutedRange}</div><span data-a-target="player-seekbar-duration" data-a-value="${options.duration ?? 10}"></span></div>`;
}

export async function withPlayer(browser: Browser, artifact: Artifact, run: (page: Page, code: string) => Promise<void>, options: PlayerOptions = {}): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const code = await readFile(new URL(artifact === 'src' ? '../.build/skip-twitch-muted-segments.js' : '../skip-twitch-muted-segments.user.js', import.meta.url), 'utf8');
  const html = `<!doctype html><html lang="en"><body>${options.empty ? '' : playerHtml(options)}</body></html>`;
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.addInitScript(() => {
    const resources = window.scriptResources = { listeners: 0, intervals: 0, scans: 0 };
    const events = new Set(['timeupdate', 'playing', 'seeked', 'loadedmetadata', 'durationchange', 'popstate', 'pageshow']);
    const addDocument = document.addEventListener.bind(document);
    document.addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void => {
      if (events.has(type)) resources.listeners++;
      addDocument(type, listener, options);
    };
    const addWindow = window.addEventListener.bind(window);
    window.addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void => {
      if (events.has(type)) resources.listeners++;
      addWindow(type, listener, options);
    };
    window.setInterval = new Proxy(window.setInterval.bind(window), {
      apply(target, _thisArgument: unknown, args: unknown[]): unknown {
        resources.intervals++;
        return Reflect.apply(target, window, args);
      }
    });
    document.querySelectorAll = new Proxy(document.querySelectorAll.bind(document), {
      apply(target, _thisArgument: unknown, args: unknown[]): unknown {
        if (args[0] === '[data-a-target="video-player"] video') resources.scans++;
        return Reflect.apply(target, document, args);
      }
    });
  });
  if (!options.deferScript) await page.addInitScript({ content: code });
  await page.goto(`https://www.twitch.tv${options.path ?? '/videos/123456'}`);
  if (!options.empty) {
    await ready(page);
    assert.equal(await page.evaluate(() => document.querySelector('video')?.duration), 10);
  }
  try {
    await run(page, code);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

export async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video !== null && video.readyState >= 1;
  });
}

export async function seek(page: Page, time = 1.2, play = true): Promise<void> {
  await page.evaluate(async ({ time, play }) => {
    const video = document.querySelector('video');
    if (!video) throw new Error('Missing fixture video');
    video.playbackRate = 0.0625;
    video.currentTime = time;
    await new Promise<void>(resolve => video.addEventListener('seeked', () => resolve(), { once: true }));
    if (play) await video.play();
  }, { time, play });
}

export async function assertTime(page: Page, minimum: number, maximum: number): Promise<void> {
  await page.waitForFunction(({ minimum, maximum }) => {
    const time = document.querySelector('video')?.currentTime;
    return time !== undefined && time >= minimum && time <= maximum;
  }, { minimum, maximum }, { timeout: 2500 });
  const time = await page.evaluate(() => document.querySelector('video')?.currentTime);
  assert.ok(time !== undefined && time >= minimum && time <= maximum, `Unexpected playback position ${String(time)}`);
}

export async function assertSkipped(page: Page): Promise<void> {
  await assertTime(page, 2.09, 2.49);
}
