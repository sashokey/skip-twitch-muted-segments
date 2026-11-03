import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { artifacts, withPlayer, mutedRange, playerHtml, ready, seek, assertSkipped } from './browser.ts';

let browser: Browser;
before(async () => { browser = await chromium.launch({ headless: true, args: ['--mute-audio'] }); });
after(async () => { await browser.close(); });

for (const artifact of artifacts) {
  void test(`${artifact}: repeated execution preserves a single set of resources`, () => withPlayer(browser, artifact, async (page, code) => {
    const before = await page.evaluate(() => ({ ...window.scriptResources }));
    await page.evaluate(code);
    await page.evaluate(code);
    const after = await page.evaluate(() => ({ ...window.scriptResources }));
    assert.deepEqual(after, before);
    await seek(page);
    await assertSkipped(page);
  }));

  void test(`${artifact}: stays idle without a player`, () => withPlayer(browser, artifact, async page => {
    const before = await page.evaluate(() => ({ ...window.scriptResources }));
    await page.evaluate(() => {
      for (let index = 0; index < 20; index++) document.body.append(document.createElement('div'));
    });
    await page.waitForTimeout(1200);
    assert.deepEqual(await page.evaluate(() => ({ ...window.scriptResources })), { listeners: before.listeners, intervals: 0, scans: before.scans });
  }, { empty: true }));

  void test(`${artifact}: stops scanning after the player is removed`, () => withPlayer(browser, artifact, async page => {
    await page.evaluate(() => document.querySelector('[data-a-target="video-player"]')?.remove());
    const before = await page.evaluate(() => window.scriptResources.scans);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.scriptResources.scans), before);
    assert.equal(await page.evaluate(() => window.scriptResources.intervals), 0);
  }));

  void test(`${artifact}: processes a player already playing when initialized`, () => withPlayer(browser, artifact, async (page, code) => {
    await seek(page);
    await page.evaluate(code);
    await assertSkipped(page);
  }, { deferScript: true }));

  void test(`${artifact}: discovers a late player through its media events`, () => withPlayer(browser, artifact, async page => {
    const scans = await page.evaluate(() => window.scriptResources.scans);
    await page.evaluate(html => { document.body.innerHTML = html; }, playerHtml());
    await ready(page);
    await seek(page);
    await assertSkipped(page);
    assert.equal(await page.evaluate(() => window.scriptResources.scans), scans);
  }, { empty: true }));

  void test(`${artifact}: follows a replaced player and seekbar`, () => withPlayer(browser, artifact, async page => {
    await seek(page);
    await assertSkipped(page);
    await page.evaluate(html => {
      const player = document.querySelector('[data-a-target="video-player"]');
      if (!player) throw new Error('Missing fixture player');
      player.outerHTML = html;
    }, playerHtml().replace('width:10%', 'width:30%'));
    await ready(page);
    await seek(page);
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video !== null && video.currentTime >= 4.09;
    }, null, { timeout: 3000 });
    assert.ok(await page.evaluate(() => {
      const video = document.querySelector('video');
      return video !== null && video.currentTime < 4.5;
    }));
  }));

  void test(`${artifact}: safely ignores missing seekbars until a later media event`, () => withPlayer(browser, artifact, async page => {
    await page.locator('[data-a-target="player-seekbar"]').evaluate(seekbar => seekbar.remove());
    await seek(page);
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => {
      const video = document.querySelector('video');
      return video !== null && video.currentTime < 1.4;
    }));
    await page.evaluate(html => {
      const player = document.querySelector('[data-a-target="video-player"]');
      if (!player) throw new Error('Missing fixture player');
      player.insertAdjacentHTML('beforeend', html);
    }, `<div data-a-target="player-seekbar">${mutedRange}</div>`);
    await assertSkipped(page);
  }));

  void test(`${artifact}: ignores live SPA routes and resumes on a recording route`, () => withPlayer(browser, artifact, async page => {
    await page.evaluate(() => history.pushState({}, '', '/examplechannel'));
    await seek(page);
    await page.waitForTimeout(1100);
    assert.ok(await page.evaluate(() => {
      const video = document.querySelector('video');
      return video !== null && video.currentTime < 1.4;
    }));
    await page.evaluate(() => history.pushState({}, '', '/examplechannel/video/654321'));
    await assertSkipped(page);
  }));
}
