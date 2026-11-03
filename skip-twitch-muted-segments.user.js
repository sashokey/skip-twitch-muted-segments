// ==UserScript==
// @name         Skip Twitch Muted Segments
// @namespace    local.skip-twitch-muted-segments
// @version      1.0.4
// @description  Violentmonkey userscript that automatically skips red muted segments in Twitch video recordings.
// @match        https://www.twitch.tv/*
// @noframes
// @run-at       document-start
// @inject-into  content
// @grant        none
// @homepageURL  https://github.com/sashokey/skip-twitch-muted-segments
// @updateURL    https://raw.githubusercontent.com/sashokey/skip-twitch-muted-segments/master/skip-twitch-muted-segments.user.js
// @downloadURL  https://raw.githubusercontent.com/sashokey/skip-twitch-muted-segments/master/skip-twitch-muted-segments.user.js
// ==/UserScript==
(()=>{"use strict";const e=Symbol.for("local.skip-twitch-muted-segments");if(Reflect.get(window,e))return;Reflect.set(window,e,!0);const t='[data-a-target="video-player"]',n=new WeakMap,r=()=>location.pathname.match(/^\/(?:videos\/|[^/]+\/video\/)(\d+)(?:\/|$)/)?.[1]||"";let o=r(),i=0;function a(e){return/^\d+(?:\.\d+)?%$/.test(e)?Number.parseFloat(e)/100:NaN}function s(e){const t=e.style.backgroundColor||getComputedStyle(e).backgroundColor,n=t.match(/[\d.]+/g)?.map(Number);if(!/^rgba?\(/.test(t)||!n||n.length<3||n.length>4)return!1;const[r,o,i,a=1]=n;return!(void 0===r||void 0===o||void 0===i||![r,o,i,a].every(Number.isFinite))&&a>0&&r>=150&&r>1.8*o&&r>1.8*i}function c(e){const c=performance.now(),u=r();if(u!==o&&(o=u,i=c+1e3),!o||c<i||!(e instanceof HTMLVideoElement))return;if(!e.isConnected||e.paused||e.seeking||e.ended||e.readyState<1)return;if(c-(n.get(e)??-1/0)<1e3)return;const d=e.closest(t),l=d?.querySelector('[data-a-target="player-seekbar"]'),m=Number(d?.querySelector('[data-a-target="player-seekbar-duration"]')?.getAttribute("data-a-value"));if(!l||!Number.isFinite(m)||m<=0)return;if(!Number.isFinite(e.duration)||Math.abs(e.duration-m)>1)return;const f=e.currentTime;if(!Number.isFinite(f))return;const g=function(e,t){const n=[];for(const r of e.querySelectorAll('[data-test-selector="seekbar-segment__segment"]')){if(!(r instanceof HTMLElement&&s(r)))continue;const e=a(r.style.insetInlineStart||r.style.left),o=a(r.style.width);!Number.isFinite(e)||!Number.isFinite(o)||e>=1||o<=0||o>1||e+o>1.000001||n.push([e*t,Math.min(1,e+o)*t])}n.sort((e,t)=>e[0]-t[0]);const r=[],o=Math.max(.05,1e-6*t);for(const e of n){const t=r[r.length-1];t&&e[0]<=t[1]+o?t[1]=Math.max(t[1],e[1]):r.push(e)}return r}(l,m).find(([e,t])=>f>=e&&f<t);if(!g)return;const h=Math.min(e.duration,g[1]+.1);if(!(h<=f)){n.set(e,c);try{e.currentTime=h}catch(e){console.warn("Skip Twitch Muted Segments: could not seek",e)}}}function u(){for(const e of document.querySelectorAll(`${t} video`))c(e)}for(const e of["timeupdate","playing","seeked","loadedmetadata","durationchange"])document.addEventListener(e,({target:e})=>c(e),!0);window.addEventListener("popstate",u),window.addEventListener("pageshow",u),u()})();
