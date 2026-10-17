import { channels } from './channel-data.js';
import { profileImageFallback } from './profile-image.js';

'use strict';

const profileImageLinks = [
'https://pin.it/7ld2kaYvo','https://pin.it/17dcZ7W9T','https://pin.it/51mUN25G8','https://pin.it/BH8UzYgog','https://pin.it/6Fww6HJyb','https://pin.it/5J0Pvv2T1','https://pin.it/6d7x3wRUP','https://pin.it/52hJRLOO6','https://pin.it/45CuyAVqW','https://pin.it/292sL0yxk','https://pin.it/6nLJr9eNC','https://pin.it/3UeSJW8So','https://pin.it/2I6nqpEk1','https://pin.it/3Svc2yCLy','https://pin.it/7sCRtmWL7','https://pin.it/7GUE1fVw9','https://pin.it/1MX50iVzw','https://pin.it/7gfVWxMcW','https://pin.it/4cb3LTFE7','https://pin.it/6BvFwVm9z','https://pin.it/4THPotKTF'
];
const profileGallery = document.getElementById('profile-gallery');
const imagePreviewQueue = [];
const profileFeature = document.getElementById('profile-feature-image');
if (profileFeature && profileFeature.complete && profileFeature.naturalWidth === 0) profileFeature.src = profileImageFallback;
profileFeature?.addEventListener('error', () => { profileFeature.src = profileImageFallback; }, { once: true });
profileImageLinks.forEach((url, index) => {
  const card = document.createElement('a');
  card.className = 'pin-card'; card.href = url; card.target = '_blank'; card.rel = 'noopener noreferrer';
  card.setAttribute('aria-label', `Open Pinterest image ${index + 1} in a new tab`);
  const image = document.createElement('img');
  image.className = 'pin-image'; image.alt = `Profile image ${index + 1} for Muhammad Bakhtawar Khan`; image.loading = 'lazy'; image.decoding = 'async';
  image.src = profileImageFallback;
  image.onload = () => card.classList.add('has-image');
  // Keep gallery tiles image-only: no archive labels, numbering, or overlay text.
  card.append(image); profileGallery.appendChild(card);
  imagePreviewQueue.push({ url, image, card });
});
// Pinterest short links are webpage URLs, not image files. Ask a metadata preview service
// for each pin's actual Open Graph image, then display that image inside this single-file page.
async function loadPinterestPreview(item) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const endpoint = 'https://api.microlink.io/?url=' + encodeURIComponent(item.url);
    const response = await fetch(endpoint, { mode: 'cors', signal: controller.signal });
    if (!response.ok) throw new Error('Preview unavailable');
    const result = await response.json();
    const imageUrl = result && result.data && result.data.image && result.data.image.url;
    if (!imageUrl || !/^https:\/\//i.test(imageUrl)) throw new Error('No image metadata');
    item.image.onload = () => item.card.classList.add('has-image');
    item.image.onerror = () => { item.image.src = profileImageFallback; };
    item.image.src = imageUrl;
    if (item === imagePreviewQueue[0]) {
      const feature = document.getElementById('profile-feature-image');
      const portrait = feature && feature.closest('.profile-portrait-feature');
      if (feature && portrait && !feature.getAttribute('src')) {
        feature.onload = () => portrait.classList.add('has-photo');
        feature.onerror = () => feature.removeAttribute('src');
        feature.src = imageUrl;
      }
    }
  } catch (_) {
    // Keep the card useful and clickable if Pinterest or the preview service blocks access.
  } finally {
    clearTimeout(timeout);
  }
}
let previewIndex = 0;
async function runPinterestPreviewQueue() {
  const workers = Array.from({ length: 3 }, async () => {
    while (previewIndex < imagePreviewQueue.length) {
      const item = imagePreviewQueue[previewIndex++];
      await loadPinterestPreview(item);
    }
  });
  await Promise.all(workers);
}
runPinterestPreviewQueue();
function routeProfilePage() {
  const isProfile = location.hash === '#profile';
  document.body.classList.toggle('profile-open', isProfile);
  const profile = document.getElementById('profile-page');
  profile.classList.toggle('is-visible', isProfile);
  profile.setAttribute('aria-hidden', String(!isProfile));
  if (isProfile || location.hash === '#home' || !location.hash) window.scrollTo(0, 0);
  else if (location.hash === '#directory') document.getElementById('directory').scrollIntoView();
}
window.addEventListener('hashchange', routeProfilePage);
routeProfilePage();

const ALLOWED_STREAM_HOSTS = new Set([
  'cdn12isb.tamashaweb.com','cdn23lhr.tamashaweb.com','cdn22lhr.tamashaweb.com',
  'cdn21lhr.tamashaweb.com','cdn07isb.tamashaweb.com','cdn06khi.tamashaweb.com'
]);
const ALLOWED_LOGO_HOSTS = new Set(['canvas.tamashaweb.com','upload.wikimedia.org']);

const video = document.getElementById('video');
const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('player-title');
const searchEl = document.getElementById('search');
const retryBtn = document.getElementById('retry');
let hls = null;
let currentChannel = null;
let activeCategory = 'all';

function safeUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.username || url.password) return null;
    return url.href;
  } catch (_) { return null; }
}
function setStatus(message) { statusEl.textContent = message; }
function stopPlayback() {
  if (hls) { hls.destroy(); hls = null; }
  video.pause();
  video.removeAttribute('src');
  video.load();
}
function makeLogo(channel) {
  const wrap = document.createElement('div');
  wrap.className = 'logo';
  const src = safeUrl(channel.logo, ALLOWED_LOGO_HOSTS);
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.remove(); wrap.textContent = channel.name.slice(0,1).toUpperCase(); };
    wrap.appendChild(img);
  } else { wrap.textContent = channel.name.slice(0,1).toUpperCase(); }
  return wrap;
}
let libraryMode = 'all';
const FAVORITES_KEY = 'mbk-tv-favorites-v1';
const RECENT_KEY = 'mbk-tv-recent-v1';
function readSaved(key) {
  try { const parsed = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch (_) { return []; }
}
let favorites = new Set(readSaved(FAVORITES_KEY));
let recentChannels = readSaved(RECENT_KEY);
function persistSaved(key, values) { try { localStorage.setItem(key, JSON.stringify(values)); } catch (_) {} }
function updateLibraryCounts() {
  const all = document.getElementById('all-count');
  const saved = document.getElementById('saved-count');
  const recent = document.getElementById('recent-count');
  if (all) all.textContent = String(channels.length);
  if (saved) saved.textContent = String(favorites.size);
  if (recent) recent.textContent = String(recentChannels.length);
  document.querySelectorAll('.library-mode').forEach(button => {
    const active = button.dataset.mode === libraryMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function renderChannels() {
  const query = searchEl.value.trim().toLocaleLowerCase();
  let filtered = channels.filter(ch =>
    (activeCategory === 'all' || ch.cat === activeCategory) &&
    (ch.name.toLocaleLowerCase().includes(query) || ch.cat.toLocaleLowerCase().includes(query))
  );
  if (libraryMode === 'favorites') filtered = filtered.filter(ch => favorites.has(ch.name));
  if (libraryMode === 'recent') filtered = recentChannels.map(name => channels.find(ch => ch.name === name)).filter(Boolean).filter(ch =>
    activeCategory === 'all' || ch.cat === activeCategory
  ).filter(ch => !query || ch.name.toLocaleLowerCase().includes(query) || ch.cat.toLocaleLowerCase().includes(query));
  if (sortMode === 'az') filtered = [...filtered].sort((a,b) => a.name.localeCompare(b.name));
  grid.replaceChildren();
  document.getElementById('count').textContent = `${filtered.length} / ${channels.length}`;
  updateLibraryCounts();
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    const heading = document.createElement('strong');
    const message = document.createElement('span');
    if (libraryMode === 'favorites') { heading.textContent = 'Your saved channels live here.'; message.textContent = 'Tap the star on any channel to build your personal watchlist.'; }
    else if (libraryMode === 'recent') { heading.textContent = 'Your viewing history starts here.'; message.textContent = 'Play a channel and it will appear here for quick access next time.'; }
    else { heading.textContent = 'Nothing on this frequency.'; message.textContent = 'Try another search term or choose a different category.'; }
    empty.append(heading, message); grid.appendChild(empty); return;
  }
  filtered.forEach((ch) => {
    const shell = document.createElement('div'); shell.className = 'channel-shell';
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'channel' + (currentChannel && currentChannel.name === ch.name ? ' active' : '');
    card.setAttribute('aria-label', `Play ${ch.name}`);
    card.setAttribute('aria-pressed', String(Boolean(currentChannel && currentChannel.name === ch.name)));
    card.appendChild(makeLogo(ch));
    const copy = document.createElement('div'); copy.className = 'channel-copy';
    const name = document.createElement('div'); name.className = 'name'; name.textContent = ch.name;
    const foot = document.createElement('div'); foot.className = 'channel-foot';
    const cat = document.createElement('span'); cat.className = 'cat'; cat.textContent = ch.cat;
    const indexLabel = document.createElement('span'); indexLabel.className = 'channel-index'; indexLabel.textContent = String(channels.indexOf(ch) + 1).padStart(2, '0');
    const arrow = document.createElement('span'); arrow.className = 'channel-arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗';
    foot.append(cat, indexLabel, arrow); copy.append(name, foot); card.appendChild(copy);
    card.addEventListener('click', () => playChannel(ch));
    const save = document.createElement('button'); save.type = 'button'; save.className = 'favorite-toggle' + (favorites.has(ch.name) ? ' is-saved' : '');
    save.textContent = favorites.has(ch.name) ? '★' : '☆'; save.setAttribute('aria-label', `${favorites.has(ch.name) ? 'Remove' : 'Save'} ${ch.name} ${favorites.has(ch.name) ? 'from' : 'to'} favourites`);
    save.setAttribute('aria-pressed', String(favorites.has(ch.name))); save.title = favorites.has(ch.name) ? 'Remove from saved channels' : 'Save channel';
    save.addEventListener('click', () => {
      if (favorites.has(ch.name)) favorites.delete(ch.name); else favorites.add(ch.name);
      persistSaved(FAVORITES_KEY, [...favorites]); renderChannels();
    });
    shell.append(card, save); grid.appendChild(shell);
  });
}
function playChannel(ch) {
  const streamUrl = safeUrl(ch.link, ALLOWED_STREAM_HOSTS);
  if (!streamUrl) { setStatus('Blocked: stream URL failed security validation.'); return; }
  currentChannel = ch;
  recentChannels = [ch.name, ...recentChannels.filter(name => name !== ch.name)].slice(0, 12);
  persistSaved(RECENT_KEY, recentChannels);
  document.getElementById('player-stage').classList.add('is-tuned');
  titleEl.textContent = ch.name;
  retryBtn.style.display = 'inline-block';
  setStatus('Connecting to stream…');
  stopPlayback();
  renderChannels();
  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30, maxBufferLength: 30, maxMaxBufferLength: 60 });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        setStatus('Stream error or server unavailable. Check connection and retry.');
        retryBtn.style.display = 'inline-block';
        hls.destroy(); hls = null;
      }
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus(`Stream loaded · ${ch.name}`);
      video.play().catch(() => setStatus('Tap Play on the video to start playback.'));
    });
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', () => {
      setStatus(`Stream loaded · ${ch.name}`);
      video.play().catch(() => setStatus('Tap Play on the video to start playback.'));
    }, {once:true});
    video.addEventListener('error', () => setStatus('Playback failed. The stream may be offline or unavailable.'), {once:true});
  } else { setStatus('This browser does not support HLS playback.'); }
}
function renderFilters() {
  const filters = document.getElementById('filters');
  filters.replaceChildren();
  const categories = ['all', ...new Set(channels.map(ch => ch.cat))];
  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter' + (activeCategory === category ? ' active' : '');
    button.textContent = category === 'all' ? 'All channels' : category;
    button.setAttribute('aria-pressed', String(activeCategory === category));
    button.addEventListener('click', () => { activeCategory = category; renderFilters(); renderCategorySpotlight(); renderChannels(); });
    filters.appendChild(button);
  });
}
searchEl.addEventListener('input', renderChannels);
document.querySelectorAll('.library-mode').forEach(button => button.addEventListener('click', () => { libraryMode = button.dataset.mode; renderChannels(); }));
document.getElementById('clear-search').addEventListener('click', () => { searchEl.value = ''; activeCategory = 'all'; libraryMode = 'all'; if (sortModeEl) { sortModeEl.value = 'featured'; sortMode = 'featured'; } renderFilters(); renderCategorySpotlight(); renderChannels(); searchEl.focus(); });
document.addEventListener('keydown', event => {
  const target = event.target;
  const typing = target && (target.matches('input, textarea, select') || target.isContentEditable);
  if (event.key === '/' && !typing && location.hash !== '#profile') { event.preventDefault(); searchEl.focus(); searchEl.select(); }
  if (event.key === 'Escape' && target === searchEl) { searchEl.value = ''; renderChannels(); searchEl.blur(); }
});
retryBtn.addEventListener('click', () => { if (currentChannel) playChannel(currentChannel); });
video.addEventListener('waiting', () => setStatus('Buffering…'));
video.addEventListener('playing', () => setStatus(`Playing · ${currentChannel ? currentChannel.name : 'Live stream'}`));
video.addEventListener('error', () => { if (currentChannel) setStatus('Video playback error. The stream may be offline or blocked by the provider.'); });
// Dynamic category discovery: counts always reflect the actual channel data.
if (!window.Hls) { setStatus('Playback engine could not load. Check your connection and reload the page.'); }
const categorySpotlight = document.getElementById('category-spotlight');
const categorySymbols = {news:'◉',sports:'↗',entertainment:'✦',movies:'▣',music:'♫',kids:'✳',religious:'✧',documentary:'⌕',lifestyle:'◇'};
function renderCategorySpotlight() {
  if (!categorySpotlight) return;
  const counts = new Map();
  channels.forEach(ch => counts.set(ch.cat, (counts.get(ch.cat) || 0) + 1));
  const topCategories = [...counts.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,6);
  categorySpotlight.replaceChildren();
  const addTile = (category, count, label, symbol) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-tile' + (activeCategory === category ? ' active' : '');
    button.setAttribute('aria-pressed', String(activeCategory === category));
    const icon = document.createElement('span'); icon.className = 'category-icon'; icon.setAttribute('aria-hidden','true'); icon.textContent = symbol;
    const copy = document.createElement('span');
    const name = document.createElement('span'); name.className = 'category-name'; name.textContent = label;
    const meta = document.createElement('span'); meta.className = 'category-count'; meta.textContent = `${count} ${count === 1 ? 'channel' : 'channels'}`;
    copy.append(name, meta); button.append(icon, copy);
    button.addEventListener('click', () => {
      activeCategory = category; libraryMode = 'all';
      renderFilters(); renderCategorySpotlight(); renderChannels();
      document.getElementById('filters').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'nearest'});
    });
    categorySpotlight.appendChild(button);
  };
  addTile('all', channels.length, 'All channels', '⌘');
  topCategories.slice(0,5).forEach(([category,count]) => addTile(category,count,category,categorySymbols[category] || '◇'));
}
function shareMBKTV() {
  const shareData = { title: 'MBK TV — Your World of Television', text: 'Explore MBK TV, a digital media project by MBK Global.' , url: location.href.split('#')[0] };
  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareData.url).then(() => setStatus('MBK TV link copied. Share it with your friends.')).catch(() => setStatus('Copy this page URL from your browser to share MBK TV.'));
  } else {
    setStatus('Copy this page URL from your browser to share MBK TV.');
  }
}
document.getElementById('share-site')?.addEventListener('click', shareMBKTV);
document.getElementById('footer-share')?.addEventListener('click', shareMBKTV);
const sortModeEl = document.getElementById('sort-mode');
let sortMode = 'featured';
sortModeEl?.addEventListener('change', () => { sortMode = sortModeEl.value; renderChannels(); });
document.getElementById('clear-history')?.addEventListener('click', () => {
  recentChannels = []; persistSaved(RECENT_KEY, recentChannels);
  if (libraryMode === 'recent') renderChannels(); else updateLibraryCounts();
  setStatus('Recently watched history cleared on this browser.');
});
// Update visible channel totals from the source data, not hard-coded copy.
document.getElementById('header-channel-count').textContent = String(channels.length);
document.getElementById('hero-channel-count').textContent = String(channels.length).padStart(3,'0');
renderFilters();
renderCategorySpotlight();
renderChannels();
