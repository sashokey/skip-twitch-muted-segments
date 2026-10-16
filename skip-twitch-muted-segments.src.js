// ==UserScript==
// @name         Skip Twitch Muted Segments
// @namespace    local.skip-twitch-muted-segments
// @version      1.0.1
// @description  Automatically skips red muted segments in Twitch video recordings.
// @match        https://www.twitch.tv/*
// @noframes
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/sashokey/skip-twitch-muted-segments
// @updateURL    https://raw.githubusercontent.com/sashokey/skip-twitch-muted-segments/master/skip-twitch-muted-segments.user.js
// @downloadURL  https://raw.githubusercontent.com/sashokey/skip-twitch-muted-segments/master/skip-twitch-muted-segments.user.js
// ==/UserScript==

(() => {
  'use strict';

  const playerSelector = '[data-a-target="video-player"]';
  const seekbarSelector = '[data-a-target="player-seekbar"]';
  const durationSelector = '[data-a-target="player-seekbar-duration"]';
  const segmentSelector = '[data-test-selector="seekbar-segment__segment"]';
  const lastSeek = new WeakMap();
  const getVideoId = () => location.pathname.match(/^\/(?:videos\/|[^/]+\/video\/)(\d+)(?:\/|$)/)?.[1] || '';
  let videoId = getVideoId();
  let navigationUntil = 0;

  function percentage(value) {
    return /^\d+(?:\.\d+)?%$/.test(value) ? Number.parseFloat(value) / 100 : NaN;
  }

  function isMutedSegment(segment) {
    const color = segment.style.backgroundColor || getComputedStyle(segment).backgroundColor;
    const values = color.match(/[\d.]+/g)?.map(Number);
    if (!/^rgba?\(/.test(color) || !values || values.length < 3) return false;
    const [red, green, blue, alpha = 1] = values;
    return alpha > 0 && red >= 150 && red > green * 1.8 && red > blue * 1.8;
  }

  function readSegments(seekbar, duration) {
    const ranges = [];
    for (const segment of seekbar.querySelectorAll(segmentSelector)) {
      if (!isMutedSegment(segment)) continue;
      const start = percentage(segment.style.insetInlineStart || segment.style.left);
      const width = percentage(segment.style.width);
      if (!Number.isFinite(start) || !Number.isFinite(width) || start >= 1 || width <= 0 || width > 1 || start + width > 1.000001) continue;
      ranges.push([start * duration, Math.min(1, start + width) * duration]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    const tolerance = Math.max(0.05, duration * 0.000001);
    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous && range[0] <= previous[1] + tolerance) {
        previous[1] = Math.max(previous[1], range[1]);
      } else {
        merged.push(range);
      }
    }
    return merged;
  }

  function skipMuted(video) {
    const now = performance.now();
    const nextId = getVideoId();
    if (nextId !== videoId) {
      videoId = nextId;
      navigationUntil = now + 1000;
    }
    if (!videoId || now < navigationUntil || !(video instanceof HTMLVideoElement)) return;
    if (!video.isConnected || video.paused || video.seeking || video.ended || video.readyState < 1) return;
    if (now - (lastSeek.get(video) ?? -Infinity) < 1000) return;

    const player = video.closest(playerSelector);
    const seekbar = player?.querySelector(seekbarSelector);
    const duration = Number(player?.querySelector(durationSelector)?.getAttribute('data-a-value'));
    if (!seekbar || !Number.isFinite(duration) || duration <= 0) return;
    if (!Number.isFinite(video.duration) || Math.abs(video.duration - duration) > 1) return;

    const time = video.currentTime;
    if (!Number.isFinite(time)) return;
    const range = readSegments(seekbar, duration).find(([start, end]) => time >= start && time < end);
    if (!range) return;
    const target = Math.min(video.duration, range[1] + 0.1);
    if (target <= time) return;

    lastSeek.set(video, now);
    try {
      video.currentTime = target;
    } catch (error) {
      console.warn('Skip Twitch Muted Segments: could not seek', error);
    }
  }

  function scanPlayers() {
    for (const video of document.querySelectorAll(`${playerSelector} video`)) skipMuted(video);
  }

  for (const event of ['timeupdate', 'playing', 'seeked', 'loadedmetadata', 'durationchange']) {
    document.addEventListener(event, ({ target }) => skipMuted(target), true);
  }
  window.addEventListener('popstate', scanPlayers);
  window.addEventListener('pageshow', scanPlayers);
  window.setInterval(scanPlayers, 1000);
  scanPlayers();
})();
