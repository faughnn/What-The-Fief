import { writable, get } from 'svelte/store';

export const camera = writable({ x: 0, y: 0, zoom: 1.5 });
export const hoveredTile = writable<{ x: number; y: number } | null>(null);

const TILE = 16;

export function screenToTile(sx: number, sy: number, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cam = get(camera);
  const tileSize = TILE * cam.zoom;
  return {
    x: Math.floor((sx - rect.left + cam.x * tileSize) / tileSize),
    y: Math.floor((sy - rect.top + cam.y * tileSize) / tileSize),
  };
}

export function centerOnTile(x: number, y: number, canvasWidth: number, canvasHeight: number) {
  camera.update(cam => {
    const ts = TILE * cam.zoom;
    return {
      ...cam,
      x: x - canvasWidth / ts / 2,
      y: y - canvasHeight / ts / 2,
    };
  });
}

export function setupCameraControls(canvas: HTMLCanvasElement, onClick?: (tile: { x: number; y: number }, e: MouseEvent) => void) {
  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let cameraStartX = 0, cameraStartY = 0;
  let hasDragged = false;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      dragging = true;
      hasDragged = false;
      const cam = get(camera);
      dragStartX = e.clientX; dragStartY = e.clientY;
      cameraStartX = cam.x; cameraStartY = cam.y;
      e.preventDefault();
    } else if (e.button === 0) {
      dragging = true;
      hasDragged = false;
      const cam = get(camera);
      dragStartX = e.clientX; dragStartY = e.clientY;
      cameraStartX = cam.x; cameraStartY = cam.y;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
      const cam = get(camera);
      const tileSize = TILE * cam.zoom;
      camera.set({
        ...cam,
        x: cameraStartX - dx / tileSize,
        y: cameraStartY - dy / tileSize,
      });
    }
    const rect = canvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      hoveredTile.set(screenToTile(e.clientX, e.clientY, canvas));
    } else {
      hoveredTile.set(null);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (dragging && !hasDragged && e.button === 0 && onClick) {
      const tile = screenToTile(e.clientX, e.clientY, canvas);
      onClick(tile, e);
    }
    dragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.update(cam => {
      const oldZoom = cam.zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(4, cam.zoom * delta));
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / (TILE * oldZoom) + cam.x;
      const my = (e.clientY - rect.top) / (TILE * oldZoom) + cam.y;
      return {
        zoom: newZoom,
        x: mx - (e.clientX - rect.left) / (TILE * newZoom),
        y: my - (e.clientY - rect.top) / (TILE * newZoom),
      };
    });
  });

  // Keyboard pan
  const KEYS_DOWN = new Set<string>();
  const PAN_SPEED = 5;
  window.addEventListener('keydown', (e) => KEYS_DOWN.add(e.key));
  window.addEventListener('keyup', (e) => KEYS_DOWN.delete(e.key));

  function keyPan() {
    requestAnimationFrame(keyPan);
    let dx = 0, dy = 0;
    if (KEYS_DOWN.has('ArrowLeft') || KEYS_DOWN.has('a')) dx -= PAN_SPEED;
    if (KEYS_DOWN.has('ArrowRight') || KEYS_DOWN.has('d')) dx += PAN_SPEED;
    if (KEYS_DOWN.has('ArrowUp') || KEYS_DOWN.has('w')) dy -= PAN_SPEED;
    if (KEYS_DOWN.has('ArrowDown') || KEYS_DOWN.has('s')) dy += PAN_SPEED;
    if (dx || dy) {
      camera.update(cam => {
        const tileSize = TILE * cam.zoom;
        return { ...cam, x: cam.x + dx / tileSize, y: cam.y + dy / tileSize };
      });
    }
  }
  keyPan();
}
