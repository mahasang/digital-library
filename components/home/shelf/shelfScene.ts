import * as THREE from "three";
import { createBook, createShelf, type BookMesh } from "@/components/home/shelf/bookGeometry";
import {
  drawCover,
  drawSpine,
  loadCover,
  resolveFontFamilies,
  SHELF_COVER,
} from "@/components/home/shelf/bookTextures";
import {
  clampOffset,
  coverWindow,
  decayVelocity,
  focusPosition,
  isClick,
  layoutBooks,
  nearestIndex,
  seedFromSlug,
  shouldHandleWheel,
  spreadPositions,
} from "@/components/home/shelf/shelfMath";
import type { ShelfBook } from "@/components/home/shelf/types";

export interface ShelfSceneOptions {
  reducedMotion: boolean;
  initialIndex: number;
  onSelect(index: number): void;
  onOpen(index: number): void;
  onError(error: unknown): void;
}

export interface ShelfSceneHandle {
  /** resolve เมื่อวาดสันครบแล้ว แสดง canvas ได้โดยไม่เห็นหนังสือเปล่า */
  ready: Promise<void>;
  goTo(index: number): void;
  resize(width: number, height: number): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

const CAMERA_FOV = 24;
const CAMERA_DISTANCE = 7.4;
const CAMERA_HEIGHT = 1.2;
const PULL_FORWARD_Z = 0.5;
const PULL_MARGIN = 0.16;
const OFFSET_EASE_MS = 90;
const PULL_EASE_MS = 120;
const MIN_COAST_SPEED = 0.0004;
const WHEEL_IDLE_MS = 140;
const SETTLED = 0.0005;
const MAX_FRAME_MS = 50;

function ease(current: number, target: number, dtMs: number, easeMs: number): number {
  return target + (current - target) * Math.exp(-dtMs / easeMs);
}

function canvasTexture(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function applyTexture(material: THREE.MeshStandardMaterial, texture: THREE.Texture): void {
  material.map?.dispose();
  material.map = texture;
  material.color.set("#ffffff");
  material.needsUpdate = true;
}

export function createShelfScene(
  canvas: HTMLCanvasElement,
  books: ShelfBook[],
  options: ShelfSceneOptions,
): ShelfSceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 40);
  camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
  camera.lookAt(0, CAMERA_HEIGHT, 0);

  scene.add(new THREE.HemisphereLight("#fff4e2", "#3a2a20", 2.1));
  const keyLight = new THREE.DirectionalLight("#ffe9cc", 1.5);
  keyLight.position.set(-3, 5, 6);
  scene.add(keyLight);

  const meshes: BookMesh[] = books.map((book) => createBook(seedFromSlug(book.id)));
  const { centers, totalWidth } = layoutBooks(meshes.map((mesh) => mesh.thickness));
  const extras = meshes.map((mesh) => mesh.width + PULL_MARGIN - mesh.thickness);
  const pulls = meshes.map(() => 0);

  const shelf = new THREE.Group();
  meshes.forEach((mesh) => shelf.add(mesh.group));
  scene.add(shelf, createShelf(totalWidth));

  let index = Math.min(Math.max(options.initialIndex, 0), books.length - 1);
  let offset = centers[index];
  let target = offset;
  let velocity = 0;
  let dragging = false;
  let wheeling = false;
  let visible = true;
  let disposed = false;
  let frame = 0;
  let lastFrame = 0;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let fonts = "";
  const coversRequested = new Set<number>();

  function worldPerPixel(): number {
    const visibleHeight = 2 * CAMERA_DISTANCE * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
    return visibleHeight / Math.max(canvas.clientHeight, 1);
  }

  function select(next: number): void {
    if (next === index) return;
    index = next;
    options.onSelect(next);
    requestCovers();
  }

  function requestCovers(): void {
    if (!fonts) return;
    coverWindow(index, books.length).forEach((bookIndex) => {
      if (coversRequested.has(bookIndex)) return;
      coversRequested.add(bookIndex);

      const book = books[bookIndex];
      const mesh = meshes[bookIndex];
      applyTexture(mesh.cover, canvasTexture(drawCover(book, mesh.cloth, fonts, SHELF_COVER), anisotropy));
      invalidate();

      if (!book.coverUrl) return;
      loadCover(book.coverUrl, SHELF_COVER)
        .then((cover) => {
          if (disposed) return;
          applyTexture(mesh.cover, canvasTexture(cover, anisotropy));
          invalidate();
        })
        // ปกเสียไม่ใช่ error ของชั้น เล่มนี้แค่คงปกเรียงพิมพ์ไว้
        .catch(() => undefined);
    });
  }

  function updateBooks(dtMs: number): boolean {
    const moving = dragging || wheeling || velocity !== 0;
    let settled = true;

    meshes.forEach((_, bookIndex) => {
      const wanted = !moving && bookIndex === index ? 1 : 0;
      pulls[bookIndex] = options.reducedMotion ? wanted : ease(pulls[bookIndex], wanted, dtMs, PULL_EASE_MS);
      if (Math.abs(pulls[bookIndex] - wanted) > SETTLED) settled = false;
      else pulls[bookIndex] = wanted;
    });

    const positions = spreadPositions(centers, extras, pulls);
    const focus = focusPosition(offset, centers, positions);

    meshes.forEach((mesh, bookIndex) => {
      const pull = pulls[bookIndex];
      mesh.group.position.x = positions[bookIndex] - focus;
      mesh.group.position.z = THREE.MathUtils.lerp(-mesh.width / 2, PULL_FORWARD_Z, pull);
      mesh.group.rotation.y = (-Math.PI / 2) * pull;
    });
    return settled;
  }

  function updateOffset(dtMs: number): boolean {
    if (dragging) return false;

    if (velocity !== 0) {
      offset = clampOffset(offset + velocity * dtMs, centers);
      velocity = decayVelocity(velocity, dtMs);
      select(nearestIndex(offset, centers));
      if (Math.abs(velocity) < MIN_COAST_SPEED) {
        velocity = 0;
        target = centers[index];
      }
      return false;
    }

    offset = options.reducedMotion ? target : ease(offset, target, dtMs, OFFSET_EASE_MS);
    if (Math.abs(offset - target) > SETTLED) return false;
    offset = target;
    return !wheeling;
  }

  function tick(now: number): void {
    frame = 0;
    if (disposed || !visible) return;

    const dtMs = Math.min(now - lastFrame, MAX_FRAME_MS);
    lastFrame = now;
    const offsetSettled = updateOffset(dtMs);
    const booksSettled = updateBooks(dtMs);
    renderer.render(scene, camera);
    if (!offsetSettled || !booksSettled) invalidate();
  }

  /** เรนเดอร์เมื่อมีการเปลี่ยนแปลงเท่านั้น ชั้นที่นิ่งไม่กิน GPU */
  function invalidate(): void {
    if (frame || disposed || !visible) return;
    lastFrame = lastFrame || performance.now();
    frame = requestAnimationFrame(tick);
  }

  function goTo(next: number): void {
    velocity = 0;
    target = centers[next];
    select(next);
    invalidate();
  }

  function bookAt(clientX: number, clientY: number): number {
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(shelf.children, true);
    return hit ? meshes.findIndex((mesh) => mesh.group === hit.object.parent) : -1;
  }

  let pointerId: number | null = null;
  let dragStartX = 0;
  let dragDistance = 0;
  let lastPointerX = 0;
  let lastPointerTime = 0;

  function onPointerDown(event: PointerEvent): void {
    if (pointerId !== null || event.button !== 0) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    dragStartX = lastPointerX = event.clientX;
    lastPointerTime = event.timeStamp;
    dragDistance = 0;
    velocity = 0;
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    dragDistance = Math.max(dragDistance, Math.abs(event.clientX - dragStartX));
    if (isClick(dragDistance)) return;

    dragging = true;
    const delta = (lastPointerX - event.clientX) * worldPerPixel();
    const elapsed = Math.max(event.timeStamp - lastPointerTime, 1);
    velocity = options.reducedMotion ? 0 : delta / elapsed;
    offset = clampOffset(offset + delta, centers);
    target = offset;
    lastPointerX = event.clientX;
    lastPointerTime = event.timeStamp;
    select(nearestIndex(offset, centers));
    invalidate();
  }

  function endDrag(): void {
    dragging = false;
    pointerId = null;
    if (velocity === 0) target = centers[index];
    invalidate();
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const wasClick = isClick(dragDistance);
    endDrag();
    if (!wasClick) return;

    const hit = bookAt(event.clientX, event.clientY);
    if (hit === -1) return;
    if (hit === index) options.onOpen(hit);
    else goTo(hit);
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === pointerId) endDrag();
  }

  function onWheel(event: WheelEvent): void {
    if (!shouldHandleWheel(event.deltaX, event.deltaY)) return;
    event.preventDefault();

    wheeling = true;
    velocity = 0;
    target = clampOffset(target + event.deltaX * worldPerPixel(), centers);
    select(nearestIndex(target, centers));
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheeling = false;
      target = centers[index];
      invalidate();
    }, WHEEL_IDLE_MS);
    invalidate();
  }

  function onContextLost(event: Event): void {
    event.preventDefault();
    options.onError(new Error("WebGL context lost"));
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", onContextLost);

  function resize(width: number, height: number): void {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    invalidate();
  }

  function dispose(): void {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(wheelTimer);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("webglcontextlost", onContextLost);

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials: THREE.MeshStandardMaterial[] = [object.material].flat();
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    });
    renderer.dispose();
  }

  resize(canvas.clientWidth, canvas.clientHeight);
  updateBooks(0);

  const ready = resolveFontFamilies().then((families) => {
    if (disposed) return;
    fonts = families;
    meshes.forEach((mesh, bookIndex) => {
      const spine = drawSpine(books[bookIndex], mesh.cloth, fonts, mesh);
      applyTexture(mesh.spine, canvasTexture(spine, anisotropy));
    });
    requestCovers();
    renderer.render(scene, camera);
    invalidate();
  });

  return {
    ready,
    goTo,
    resize,
    setVisible(next) {
      visible = next;
      if (next) {
        lastFrame = performance.now();
        invalidate();
      }
    },
    dispose,
  };
}
