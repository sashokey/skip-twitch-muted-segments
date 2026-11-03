import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { artifacts, withPlayer, segment, seek, assertTime } from './browser.ts';

let browser: Browser;
before(async () => { browser = await chromium.launch({ headless: true, args: ['--mute-audio'] }); });
after(async () => { await browser.close(); });

for (const artifact of artifacts) {
  void test(`${artifact}: skips the complete adjacent muted range`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2);
    await assertTime(page, 4.09, 4.3);
  }, { segments: segment('10%', '10%') + segment('20%', '20%') }));

  void test(`${artifact}: leaves an unmuted segment playing`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2);
    await page.waitForTimeout(180);
    await assertTime(page, 1.19, 1.4);
  }, { segments: segment('10%', '10%', 'rgb(0, 128, 255)') }));

  void test(`${artifact}: does not move a paused recording`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2, false);
    await page.waitForTimeout(180);
    await assertTime(page, 1.19, 1.21);
  }));

  void test(`${artifact}: ignores seekbar data from a different duration`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2);
    await page.waitForTimeout(180);
    await assertTime(page, 1.19, 1.4);
  }, { duration: 8 }));

  void test(`${artifact}: ignores live-channel pages`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2);
    await page.waitForTimeout(180);
    await assertTime(page, 1.19, 1.4);
  }, { path: '/examplechannel' }));

  void test(`${artifact}: reads logical segment positions`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 2.2);
    await assertTime(page, 4.09, 4.3);
  }, { segments: segment('20%', '20%', 'rgb(255, 0, 0)', 'inset-inline-start') }));

  void test(`${artifact}: skips native translucent muted segments on channel recording URLs`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2);
    await assertTime(page, 2.09, 2.3);
  }, { path: '/strogo/video/2915582999', segments: segment('10%', '10%', 'rgba(212, 73, 73, 0.5)', 'inset-inline-start') }));

  void test(`${artifact}: waits for playback after a paused manual seek into a muted range`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2, false);
    await page.waitForTimeout(180);
    await assertTime(page, 1.19, 1.21);
    await page.evaluate(async () => { await document.querySelector('video')?.play(); });
    await assertTime(page, 2.09, 2.3);
  }));

  void test(`${artifact}: preserves a manual seek beyond the muted range`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 7.2);
    await page.waitForTimeout(180);
    await assertTime(page, 7.19, 7.4);
  }));

  void test(`${artifact}: ignores invisible red segments`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2);
    await page.waitForTimeout(180);
    await assertTime(page, 1.19, 1.4);
  }, { segments: segment('10%', '10%', 'rgba(255, 0, 0, 0)') }));

  void test(`${artifact}: clips the final seek to the recording end`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 9.2);
    await assertTime(page, 9.99, 10);
  }, { segments: segment('90%', '10%') }));

  void test(`${artifact}: waits for the new recording after SPA navigation`, () => withPlayer(browser, artifact, async page => {
    await page.evaluate(() => history.pushState({}, '', '/videos/987654'));
    await seek(page, 1.2);
    await page.waitForTimeout(180);
    await assertTime(page, 1.19, 1.4);
    await assertTime(page, 2.09, 2.4);
  }));

  void test(`${artifact}: discovers muted ranges added after initialization`, () => withPlayer(browser, artifact, async page => {
    await page.locator('[data-a-target="player-seekbar"]').evaluate((seekbar, html) => { seekbar.innerHTML = html; }, segment('10%', '10%'));
    await seek(page, 1.2);
    await assertTime(page, 2.09, 2.4);
  }, { segments: '' }));
}
