import { writable, get } from 'svelte/store';

export const camera = writable({ x: 0, y: 0, zoom: 1.5 });
export const hoveredTile = writable<{ x: number; y: number } | null>(null);
export const terrainDirty = writable(true);
export const worldDirty = writable(true);

const TILE = 16;

// Mark both layers dirty on camera change
camera.subscribe(() => {
  terrainDirty.set(true);
  worldDirty.set(true);
});

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

export function setupCameraControls(canvas: HTMLCanvasElement, onClick?: (tile: { x: number; y: number }, e: MouseEvent) => void): () => void {
  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let cameraStartX = 0, cameraStartY = 0;
  let hasDragged = false;

  function onMouseDown(e: MouseEvent) {
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
  }

  function onMouseMove(e: MouseEvent) {
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
  }

  function onMouseUp(e: MouseEvent) {
    if (dragging && !hasDragged && e.button === 0 && onClick) {
      const tile = screenToTile(e.clientX, e.clientY, canvas);
      onClick(tile, e);
    }
    dragging = false;
  }

  function onWheel(e: WheelEvent) {
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
  }

  // Keyboard pan
  const KEYS_DOWN = new Set<string>();
  const PAN_SPEED = 5;

  function onKeyDown(e: KeyboardEvent) { KEYS_DOWN.add(e.key); }
  function onKeyUp(e: KeyboardEvent) { KEYS_DOWN.delete(e.key); }

  let keyPanId: number;
  function keyPan() {
    keyPanId = requestAnimationFrame(keyPan);
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

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  keyPanId = requestAnimationFrame(keyPan);

  // Return cleanup function
  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    cancelAnimationFrame(keyPanId);
  };
}
