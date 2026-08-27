export type ScanPoint = { x: number; y: number };
export type ScanCorners = {
  topLeft: ScanPoint;
  topRight: ScanPoint;
  bottomRight: ScanPoint;
  bottomLeft: ScanPoint;
};

type CornerKey = keyof ScanCorners;

export interface ResponsiveCornerEditor {
  getCorners(): ScanCorners;
  setCorners(corners: ScanCorners): boolean;
  destroy(): void;
}

interface EditorOptions {
  container: HTMLElement;
  image: HTMLImageElement;
  corners: ScanCorners;
  onChange?: (corners: ScanCorners) => void;
}

const keys: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
const labels: Record<CornerKey, string> = {
  topLeft: 'Top-left corner',
  topRight: 'Top-right corner',
  bottomRight: 'Bottom-right corner',
  bottomLeft: 'Bottom-left corner',
};

const cloneCorners = (corners: ScanCorners): ScanCorners => ({
  topLeft: { ...corners.topLeft },
  topRight: { ...corners.topRight },
  bottomRight: { ...corners.bottomRight },
  bottomLeft: { ...corners.bottomLeft },
});

const isValidQuad = (corners: ScanCorners) => {
  const points = keys.map((key) => corners[key]);
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  const crosses = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const after = points[(index + 2) % points.length];
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
  });
  const direction = Math.sign(crosses.find((value) => Math.abs(value) > 1e-3) || 0);
  if (!direction || crosses.some((value) => Math.sign(value) !== direction || Math.abs(value) < 1e-3)) return false;
  return points.every((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y) >= 2;
  });
};

export function createResponsiveCornerEditor({ container, image, corners: initialCorners, onChange }: EditorOptions): ResponsiveCornerEditor {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('The corner editor image must be decoded first.');

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%',
    pointerEvents: 'none', userSelect: 'none', webkitUserSelect: 'none',
  });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');

  const savedPosition = container.style.position;
  const savedTouchAction = container.style.touchAction;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  // Scoped to the crop interaction layer. This prevents Safari/Android gestures
  // from interrupting an active handle without affecting normal page scrolling.
  container.style.touchAction = 'none';
  container.appendChild(canvas);

  const handles = {} as Record<CornerKey, HTMLButtonElement>;
  const visibleHandles = {} as Record<CornerKey, HTMLSpanElement>;
  for (const key of keys) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.dataset.corner = key;
    handle.setAttribute('aria-label', labels[key]);
    Object.assign(handle.style, {
      position: 'absolute', width: '52px', height: '52px', margin: '0', padding: '0',
      border: '0', borderRadius: '999px', background: 'transparent',
      transform: 'translate(-50%, -50%)', touchAction: 'none', userSelect: 'none',
      webkitUserSelect: 'none', cursor: 'grab', zIndex: '2', transition: 'none',
    });
    const visible = document.createElement('span');
    Object.assign(visible.style, {
      position: 'absolute', left: '50%', top: '50%', width: '32px', height: '32px',
      boxSizing: 'border-box', border: '2px solid #a78bfa', borderRadius: '999px',
      background: '#fff', boxShadow: '0 2px 8px rgba(2,6,23,.55)',
      transform: 'translate(-50%, -50%)', pointerEvents: 'none', transition: 'none',
    });
    handle.appendChild(visible);
    container.appendChild(handle);
    handles[key] = handle;
    visibleHandles[key] = visible;
  }

  let current = cloneCorners(initialCorners);
  let destroyed = false;
  let frame = 0;
  let changePending = false;
  let active: { key: CornerKey; pointerId: number; grabOffset: ScanPoint; pointer: ScanPoint } | null = null;
  let view = { width: 1, height: 1, scale: 1, offsetX: 0, offsetY: 0 };

  const sourceToView = (point: ScanPoint): ScanPoint => ({
    x: view.offsetX + point.x * view.scale,
    y: view.offsetY + point.y * view.scale,
  });

  const eventToView = (event: PointerEvent): ScanPoint => {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const viewToSource = (point: ScanPoint): ScanPoint => ({
    x: (point.x - view.offsetX) / view.scale,
    y: (point.y - view.offsetY) / view.scale,
  });

  const fitCanvas = () => {
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const availableWidth = Math.max(1, width - 24);
    const availableHeight = Math.max(1, height - 24);
    const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
    const imageWidth = sourceWidth * scale;
    const imageHeight = sourceHeight * scale;
    view = {
      width, height, scale,
      offsetX: (width - imageWidth) / 2,
      offsetY: (height - imageHeight) / 2,
    };
  };

  const drawMagnifier = () => {
    if (!active) return;
    const size = Math.min(144, Math.max(108, view.width * .34));
    const radius = size / 2;
    const zoom = 3;
    const selected = current[active.key];
    const selectedView = sourceToView(selected);
    const placeRight = selectedView.x < view.width / 2;
    let centerX = placeRight ? view.width - radius - 10 : radius + 10;
    let centerY = selectedView.y < view.height / 2 ? view.height - radius - 10 : radius + 10;
    centerX = Math.max(radius + 2, Math.min(view.width - radius - 2, centerX));
    centerY = Math.max(radius + 2, Math.min(view.height - radius - 2, centerY));
    const sourceSize = size / zoom / view.scale;
    const sourceX = selected.x - sourceSize / 2;
    const sourceY = selected.y - sourceSize / 2;

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#020617';
    context.fillRect(centerX - radius, centerY - radius, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, centerX - radius, centerY - radius, size, size);
    context.strokeStyle = '#fff';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(centerX - 12, centerY);
    context.lineTo(centerX + 12, centerY);
    context.moveTo(centerX, centerY - 12);
    context.lineTo(centerX, centerY + 12);
    context.stroke();
    context.restore();
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  };

  const render = () => {
    frame = 0;
    if (destroyed) return;
    context.clearRect(0, 0, view.width, view.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, sourceWidth, sourceHeight, view.offsetX, view.offsetY, sourceWidth * view.scale, sourceHeight * view.scale);
    const points = keys.map((key) => sourceToView(current[key]));
    context.save();
    context.fillStyle = 'rgba(2,6,23,.62)';
    context.beginPath();
    context.rect(0, 0, view.width, view.height);
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
    context.fill('evenodd');
    context.strokeStyle = '#a78bfa';
    context.lineWidth = 2.5;
    context.lineJoin = 'round';
    context.stroke();
    context.restore();
    keys.forEach((key, index) => {
      handles[key].style.left = `${points[index].x}px`;
      handles[key].style.top = `${points[index].y}px`;
    });
    drawMagnifier();
    if (changePending) {
      changePending = false;
      onChange?.(cloneCorners(current));
    }
  };

  const scheduleRender = (changed = false) => {
    changePending ||= changed;
    if (!frame) frame = requestAnimationFrame(render);
  };

  const moveCorner = (key: CornerKey, point: ScanPoint) => {
    const candidate = cloneCorners(current);
    candidate[key] = {
      x: Math.max(0, Math.min(sourceWidth - 1, point.x)),
      y: Math.max(0, Math.min(sourceHeight - 1, point.y)),
    };
    if (!isValidQuad(candidate)) return false;
    current = candidate;
    scheduleRender(true);
    return true;
  };

  const endDrag = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const handle = handles[active.key];
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    handle.style.cursor = 'grab';
    visibleHandles[active.key].style.background = '#fff';
    active = null;
    scheduleRender();
  };

  for (const key of keys) {
    const handle = handles[key];
    handle.addEventListener('pointerdown', (event) => {
      if (destroyed || active) return;
      event.preventDefault();
      const pointerView = eventToView(event);
      const pointerSource = viewToSource(pointerView);
      active = {
        key,
        pointerId: event.pointerId,
        pointer: pointerView,
        grabOffset: { x: pointerSource.x - current[key].x, y: pointerSource.y - current[key].y },
      };
      handle.setPointerCapture(event.pointerId);
      handle.style.cursor = 'grabbing';
      visibleHandles[key].style.background = '#a78bfa';
      handle.focus({ preventScroll: true });
      scheduleRender();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!active || active.key !== key || event.pointerId !== active.pointerId) return;
      event.preventDefault();
      const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
      const sample = coalesced[coalesced.length - 1] || event;
      const pointerView = eventToView(sample);
      const pointerSource = viewToSource(pointerView);
      active.pointer = pointerView;
      moveCorner(key, {
        x: pointerSource.x - active.grabOffset.x,
        y: pointerSource.y - active.grabOffset.y,
      });
    });
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', (event) => endDrag(event as PointerEvent));
    handle.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 10 : 1;
      const delta = event.key === 'ArrowLeft' ? [-step, 0]
        : event.key === 'ArrowRight' ? [step, 0]
          : event.key === 'ArrowUp' ? [0, -step]
            : event.key === 'ArrowDown' ? [0, step] : null;
      if (!delta) return;
      event.preventDefault();
      moveCorner(key, { x: current[key].x + delta[0], y: current[key].y + delta[1] });
    });
    handle.addEventListener('focus', () => { visibleHandles[key].style.boxShadow = '0 0 0 4px rgba(167,139,250,.38), 0 2px 8px rgba(2,6,23,.55)'; });
    handle.addEventListener('blur', () => { visibleHandles[key].style.boxShadow = '0 2px 8px rgba(2,6,23,.55)'; });
  }

  const resizeObserver = new ResizeObserver(() => { fitCanvas(); scheduleRender(); });
  resizeObserver.observe(container);
  fitCanvas();
  render();

  return {
    getCorners: () => cloneCorners(current),
    setCorners(next) {
      if (!isValidQuad(next)) return false;
      current = cloneCorners(next);
      scheduleRender(true);
      return true;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.remove();
      keys.forEach((key) => handles[key].remove());
      container.style.position = savedPosition;
      container.style.touchAction = savedTouchAction;
    },
  };
}
