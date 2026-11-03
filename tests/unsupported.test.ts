import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { artifacts, withPlayer, seek } from './browser.ts';

let browser: Browser;
before(async () => { browser = await chromium.launch({ headless: true, args: ['--mute-audio'] }); });
after(async () => { await browser.close(); });

for (const artifact of artifacts) {
  void test(`${artifact}: ignores non-HTML seekbar markers instead of seeking`, () => withPlayer(browser, artifact, async page => {
    await seek(page, 1.2);
    await page.waitForTimeout(180);
    const time = await page.evaluate(() => document.querySelector('video')?.currentTime);
    assert.ok(time !== undefined && time >= 1.19 && time <= 1.4, `Unexpected playback position ${String(time)}`);
  }, { segments: '<svg><rect data-test-selector="seekbar-segment__segment" style="inset-inline-start:10%;width:10%;background-color:rgba(212,73,73,0.5)"></rect></svg>' }));
}
