import { apiBase } from './config.js';

const frame = document.querySelector('#frame');
const picture = document.querySelector('#picture');
const portrait = document.querySelector('#portrait');
const details = Array.from(document.querySelectorAll('.detail'));
const status = document.querySelector('#status');
const zoomIn = document.querySelector('#zoom-in');
const reset = document.querySelector('#reset');
const fingers = new Map();
const target = { x: 0.742, y: 0.3245 };
const maxScale = 10;
const preferredScale = 7;
let view = { scale: 1, x: 0, y: 0 };
let pinch = null;
let tap = null;

function paint(scale, x, y) {
  const clamped = Math.max(1, Math.min(maxScale, scale));
  view = {
    scale: clamped,
    x: Math.min(0, Math.max(frame.clientWidth * (1 - clamped), x)),
    y: Math.min(0, Math.max(frame.clientHeight * (1 - clamped), y)),
  };
  picture.style.transform = `translate(${view.x}px, ${view.y}px) scale(${clamped})`;
  picture.classList.toggle('is-zoomed', clamped >= 2.8);
  reset.disabled = clamped === 1;
  zoomIn.disabled = clamped >= preferredScale;
}

function zoomAt(relativePoint = target) {
  paint(preferredScale, frame.clientWidth * (0.5 - relativePoint.x * preferredScale),
    frame.clientHeight * (0.5 - relativePoint.y * preferredScale));
}

function contact(event) {
  const rect = frame.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function geometry() {
  const [first, second] = fingers.values();
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2,
    distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)) };
}

frame.addEventListener('pointerdown', event => {
  if (event.button !== 0 || fingers.size >= 2) return;
  frame.setPointerCapture(event.pointerId);
  const point = contact(event);
  fingers.set(event.pointerId, point);
  if (fingers.size === 1) tap = { ...point, id: event.pointerId };
  if (fingers.size === 2) {
    const start = geometry();
    pinch = { ...start, scale: view.scale, imageX: (start.x - view.x) / view.scale,
      imageY: (start.y - view.y) / view.scale };
    tap = null;
  }
});

frame.addEventListener('pointermove', event => {
  const previous = fingers.get(event.pointerId);
  if (!previous) return;
  const point = contact(event);
  fingers.set(event.pointerId, point);
  if (tap && Math.hypot(point.x - tap.x, point.y - tap.y) > 12) tap = null;
  if (pinch) {
    const next = geometry();
    const scale = Math.max(1, Math.min(maxScale, pinch.scale * next.distance / pinch.distance));
    paint(scale, next.x - pinch.imageX * scale, next.y - pinch.imageY * scale);
  } else if (view.scale > 1) {
    paint(view.scale, view.x + point.x - previous.x, view.y + point.y - previous.y);
  }
});

function release(event) {
  if (!fingers.delete(event.pointerId)) return;
  if (fingers.size < 2) pinch = null;
  if (event.type === 'pointerup' && tap?.id === event.pointerId && view.scale === 1) {
    const x = tap.x / frame.clientWidth;
    const y = tap.y / frame.clientHeight;
    if (y > .27 && y < .39) {
      if (x > .61 && x < .87) zoomAt();
      if (x > .13 && x < .39) zoomAt({ x: .257, y: target.y });
    }
  }
  tap = null;
}

frame.addEventListener('pointerup', release);
frame.addEventListener('pointercancel', release);
frame.addEventListener('lostpointercapture', release);
zoomIn.addEventListener('click', () => zoomAt());
reset.addEventListener('click', () => paint(1, 0, 0));
new ResizeObserver(() => paint(1, 0, 0)).observe(frame);

function setStatus(message = '') {
  status.textContent = message;
  status.hidden = !message;
}

async function loadShow(id) {
  // Ghi nhận ảnh đã mở sau khi trình duyệt tải và giải mã ảnh.
  try {
    await portrait.decode();
  } catch {
    setStatus('Không tải được ảnh. Anh/chị có thể mở lại liên kết.');
    return;
  }

  const endpoint = new URL(`/p/${id}`, apiBase || location.origin);
  let timer = 0;
  let active = false;
  let ended = false;
  let failures = 0;
  let currentLayer = '';

  async function refresh() {
    if (active || ended || document.hidden) return;
    clearTimeout(timer);
    active = true;
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!['waiting', 'ready', 'ended'].includes(data.state)) throw new Error('Invalid response');
      failures = 0;
      if (data.state === 'ended') {
        ended = true;
        for (const detail of details) detail.hidden = true;
        setStatus('Liên kết này đã hết hạn.');
      } else {
        setStatus();
        if (data.layer && data.layer !== currentLayer && data.layer.startsWith('data:image/svg+xml,')) {
          for (const detail of details) {
            detail.src = data.layer;
            detail.hidden = false;
          }
          currentLayer = data.layer;
        }
      }
    } catch {
      failures += 1;
      if (failures >= 3) setStatus('Kết nối đang gián đoạn. Vui lòng giữ ảnh mở.');
    } finally {
      active = false;
      if (!ended && !document.hidden) timer = setTimeout(refresh, failures ? 1700 : currentLayer ? 4500 : 700);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else refresh();
  });
  window.addEventListener('online', refresh);
  await refresh();
}

const id = new URLSearchParams(location.search).get('p');
if (id && /^[a-f0-9]{32}\.[a-f0-9]{24}$/.test(id)) loadShow(id);
else if (id) setStatus('Liên kết ảnh chưa đúng.');
