import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { isSoftwareRenderer } from "@/components/home/shelf/capability";
import {
  createBook,
  createShelf,
  createSharedTextures,
  createWall,
  type BookMesh,
} from "@/components/home/shelf/bookGeometry";
import {
  drawCover,
  drawSpine,
  INSPECT_COVER,
  loadCover,
  resolveFontFamilies,
  SHELF_COVER,
  type CoverSize,
} from "@/components/home/shelf/bookTextures";
import {
  clampOffset,
  coverWindow,
  createCoverTracker,
  decayVelocity,
  entranceProgress,
  focusPosition,
  isClick,
  layoutBooks,
  leanAngle,
  nearestIndex,
  pullPose,
  seedFromSlug,
  shouldHandleWheel,
  spreadPositions,
  springStep,
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
  inspect(index: number): void;
  closeInspect(): void;
  resize(width: number, height: number): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

const CAMERA_FOV = 24;
const CAMERA_DISTANCE = 9.2;
const CAMERA_HEIGHT = 1.3;
const LOOK_HEIGHT = 1.05;
const PARALLAX_X = 0.22;
const PARALLAX_Y = 0.1;
const INSPECT_CAMERA_X = -1.7;
const INSPECT_CAMERA_LIFT = 0.35;
const INSPECT_CAMERA_Z = 8;
const INSPECT_MIN_DISTANCE = 3.5;
const INSPECT_MAX_DISTANCE = 11;

const PULL_FORWARD_Z = 0.85;
const PULL_MARGIN = 0.18;
const HOVER_FORWARD_Z = 0.1;
const ENTRANCE_BACK_Z = 1.2;
/** บนจอกว้างเล่มที่เลือกอยู่ขวากลาง เพื่อเว้นซ้ายให้ชื่อเรื่อง */
const WIDE_ASPECT = 1.45;
const WIDE_SHIFT = 0.13;

const OFFSET_EASE_MS = 90;
const INSPECT_EASE_MS = 150;
const CAMERA_EASE_MS = 80;
const LEAN_EASE_MS = 130;
const HOVER_EASE_MS = 90;
const SHIFT_EASE_MS = 120;
const MIN_COAST_SPEED = 0.0004;
const WHEEL_IDLE_MS = 140;
const DRAG_STALE_MS = 80;
const ENTRANCE_TOTAL_MS = 1500;
const SETTLED = 0.0005;
const SETTLED_SPEED = 0.002;
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
  const { reducedMotion } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const gl = renderer.getContext();
  const rendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const lowPower = isSoftwareRenderer(
    rendererInfo ? String(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)) : "",
  );
  renderer.setPixelRatio(
    lowPower ? 1 : Math.min(window.devicePixelRatio, coarsePointer ? 1.5 : 2),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const scene = new THREE.Scene();
  let environment: THREE.WebGLRenderTarget | undefined;
  if (lowPower) {
    scene.add(new THREE.HemisphereLight("#fff4e2", "#3a2a20", 2.1));
  } else {
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.55;
  }

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 40);
  camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
  const look = new THREE.Vector3(0, LOOK_HEIGHT, 0);
  camera.lookAt(look);

  const keyLight = new THREE.DirectionalLight("#ffeeda", 1.9);
  keyLight.position.set(-3, 6, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(coarsePointer ? 1024 : 2048, coarsePointer ? 1024 : 2048);
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -4;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 22;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.radius = 7;
  scene.add(keyLight);

  const textures = createSharedTextures();
  const meshes: BookMesh[] = books.map((book) => createBook(seedFromSlug(book.id), textures));
  const { centers, totalWidth } = layoutBooks(meshes.map((mesh) => mesh.thickness));
  const extras = meshes.map((mesh) => mesh.width + PULL_MARGIN - mesh.thickness);
  const pulls = meshes.map(() => 0);
  const pullSpeeds = meshes.map(() => 0);
  const hovers = meshes.map(() => 0);

  const shelf = new THREE.Group();
  meshes.forEach((mesh) => shelf.add(mesh.group));
  const plank = createShelf(totalWidth);
  const wall = createWall();
  scene.add(shelf, plank, wall);

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
  let inspecting = false;
  let inspectAmount = 0;
  let lean = 0;
  let stageShift = 0;
  let hovered = -1;
  let entranceStart: number | null = null;
  let controls: OrbitControls | undefined;
  const parallax = { x: 0, y: 0 };
  const coversRequested = new Set<number>();
  const detailedCovers = new Set<number>();
  const coverTracker = createCoverTracker();

  function visibleHeight(): number {
    return 2 * CAMERA_DISTANCE * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
  }

  function worldPerPixel(): number {
    return visibleHeight() / Math.max(canvas.clientHeight, 1);
  }

  function select(next: number): void {
    if (next === index) return;
    index = next;
    options.onSelect(next);
    requestCovers();
  }

  function paintCover(bookIndex: number, size: CoverSize): void {
    const book = books[bookIndex];
    const mesh = meshes[bookIndex];
    if (coverTracker.needsTypeset(bookIndex)) {
      applyTexture(mesh.cover, canvasTexture(drawCover(book, mesh.cloth, fonts, size), anisotropy));
      invalidate();
    }

    if (!book.coverUrl) return;
    loadCover(book.coverUrl, size)
      .then((cover) => {
        if (disposed || !coverTracker.accept(bookIndex, size.width)) return;
        applyTexture(mesh.cover, canvasTexture(cover, anisotropy));
        invalidate();
      })
      // ปกเสียไม่ใช่ error ของชั้น เล่มนี้แค่คงปกเรียงพิมพ์ไว้
      .catch(() => undefined);
  }

  function requestCovers(): void {
    if (!fonts) return;
    coverWindow(index, books.length).forEach((bookIndex) => {
      if (coversRequested.has(bookIndex) || detailedCovers.has(bookIndex)) return;
      coversRequested.add(bookIndex);
      paintCover(bookIndex, SHELF_COVER);
    });
  }

  function updateBooks(dtMs: number, now: number): boolean {
    const moving = dragging || wheeling || velocity !== 0;
    let settled = true;

    meshes.forEach((_, bookIndex) => {
      const wanted = !moving && bookIndex === index ? 1 : 0;
      if (reducedMotion) {
        pulls[bookIndex] = wanted;
        pullSpeeds[bookIndex] = 0;
      } else {
        const next = springStep(pulls[bookIndex], pullSpeeds[bookIndex], wanted, dtMs);
        pulls[bookIndex] = next.value;
        pullSpeeds[bookIndex] = next.velocity;
      }
      if (
        Math.abs(pulls[bookIndex] - wanted) > SETTLED ||
        Math.abs(pullSpeeds[bookIndex]) > SETTLED_SPEED
      ) {
        settled = false;
      } else {
        pulls[bookIndex] = wanted;
        pullSpeeds[bookIndex] = 0;
      }

      const wantedHover = !moving && bookIndex === hovered && bookIndex !== index ? 1 : 0;
      hovers[bookIndex] = reducedMotion
        ? wantedHover
        : ease(hovers[bookIndex], wantedHover, dtMs, HOVER_EASE_MS);
      if (Math.abs(hovers[bookIndex] - wantedHover) > SETTLED) settled = false;
      else hovers[bookIndex] = wantedHover;
    });

    const wantedInspect = inspecting ? 1 : 0;
    inspectAmount = reducedMotion
      ? wantedInspect
      : ease(inspectAmount, wantedInspect, dtMs, INSPECT_EASE_MS);
    if (Math.abs(inspectAmount - wantedInspect) > SETTLED) settled = false;
    else inspectAmount = wantedInspect;

    const wantedLean = reducedMotion || !moving ? 0 : leanAngle(velocity);
    lean = ease(lean, wantedLean, dtMs, LEAN_EASE_MS);
    if (Math.abs(lean - wantedLean) > SETTLED / 10) settled = false;
    else lean = wantedLean;

    const wide = camera.aspect > WIDE_ASPECT ? visibleHeight() * camera.aspect * WIDE_SHIFT : 0;
    const wantedShift = wide * (1 - inspectAmount);
    stageShift = reducedMotion ? wantedShift : ease(stageShift, wantedShift, dtMs, SHIFT_EASE_MS);
    if (Math.abs(stageShift - wantedShift) > SETTLED) settled = false;
    else stageShift = wantedShift;
    shelf.position.x = stageShift;

    const entering = entranceStart !== null && now - entranceStart < ENTRANCE_TOTAL_MS;
    if (entering) settled = false;

    const positions = spreadPositions(centers, extras, pulls);
    const focus = focusPosition(offset, centers, positions);

    meshes.forEach((mesh, bookIndex) => {
      const pose = pullPose(pulls[bookIndex]);
      const entered =
        entranceStart === null
          ? 1
          : entranceProgress(now - entranceStart, Math.abs(bookIndex - index));
      const shelved =
        THREE.MathUtils.lerp(-mesh.width / 2, PULL_FORWARD_Z, pose.slide) +
        hovers[bookIndex] * HOVER_FORWARD_Z;
      const inspected = bookIndex === index ? inspectAmount : 0;

      mesh.group.position.x = positions[bookIndex] - focus;
      mesh.group.position.y = pose.lift;
      mesh.group.position.z =
        THREE.MathUtils.lerp(shelved, 0, inspected) - (1 - entered) * ENTRANCE_BACK_Z;
      mesh.group.rotation.y = (-Math.PI / 2) * pose.turn;
      mesh.group.rotation.z = lean * (1 - pose.slide);
    });
    return settled;
  }

  /** กล้องไล่ตามเป้าเสมอ ปิด dialog หลังหมุนเล่มแล้วจึงไม่กระตุก */
  function updateCamera(dtMs: number): boolean {
    if (controls) return true;

    const bookCenter = meshes[index].height / 2;
    const wanted = new THREE.Vector3(
      THREE.MathUtils.lerp(parallax.x * PARALLAX_X, INSPECT_CAMERA_X, inspectAmount),
      THREE.MathUtils.lerp(
        CAMERA_HEIGHT + parallax.y * PARALLAX_Y,
        bookCenter + INSPECT_CAMERA_LIFT,
        inspectAmount,
      ),
      THREE.MathUtils.lerp(CAMERA_DISTANCE, INSPECT_CAMERA_Z, inspectAmount),
    );
    const wantedLook = new THREE.Vector3(
      0,
      THREE.MathUtils.lerp(LOOK_HEIGHT, bookCenter, inspectAmount),
      0,
    );

    const follow = reducedMotion ? 1 : 1 - Math.exp(-dtMs / CAMERA_EASE_MS);
    camera.position.lerp(wanted, follow);
    look.lerp(wantedLook, follow);
    camera.lookAt(look);

    return camera.position.distanceTo(wanted) < SETTLED && look.distanceTo(wantedLook) < SETTLED;
  }

  /** เริ่มหลังเล่มเข้าที่แล้ว ระหว่างเคลื่อนกล้องจึงไม่แย่งตำแหน่งกับ OrbitControls */
  function startOrbit(): void {
    if (controls) return;
    controls = new OrbitControls(camera, canvas);
    controls.target.copy(look);
    controls.enablePan = false;
    controls.minDistance = INSPECT_MIN_DISTANCE;
    controls.maxDistance = INSPECT_MAX_DISTANCE;
    controls.addEventListener("change", invalidate);
    controls.update();
  }

  function stopOrbit(): void {
    if (controls) look.copy(controls.target);
    controls?.removeEventListener("change", invalidate);
    controls?.dispose();
    controls = undefined;
    // OrbitControls ตั้งค่านี้ไว้บน canvas ต้องคืนให้ class ของชั้นทำงานเหมือนเดิม
    canvas.style.touchAction = "";
  }

  function setShelfVisible(shown: boolean): void {
    plank.visible = shown;
    wall.visible = shown;
    meshes.forEach((mesh, bookIndex) => {
      mesh.group.visible = shown || bookIndex === index;
    });
  }

  function inspect(next: number): void {
    dragging = false;
    wheeling = false;
    pointerId = null;
    hovered = -1;
    clearTimeout(wheelTimer);
    goTo(next);
    inspecting = true;
    setShelfVisible(false);

    if (fonts && !detailedCovers.has(next)) {
      detailedCovers.add(next);
      paintCover(next, INSPECT_COVER);
    }
    invalidate();
  }

  function closeInspect(): void {
    stopOrbit();
    inspecting = false;
    setShelfVisible(true);
    invalidate();
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

    offset = reducedMotion ? target : ease(offset, target, dtMs, OFFSET_EASE_MS);
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
    const booksSettled = updateBooks(dtMs, now);
    const cameraSettled = updateCamera(dtMs);
    if (inspecting && inspectAmount === 1 && booksSettled && cameraSettled) startOrbit();
    renderer.render(scene, camera);
    if (!offsetSettled || !booksSettled || !cameraSettled) invalidate();
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
    if (inspecting || pointerId !== null || event.button !== 0) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    dragStartX = lastPointerX = event.clientX;
    lastPointerTime = event.timeStamp;
    dragDistance = 0;
    velocity = 0;
  }

  /** เมาส์ที่ขยับโดยไม่ลาก: กล้องเอียงตามเล็กน้อย และเล่มใต้เมาส์ขยับออกมารอ */
  function onPointerHover(event: PointerEvent): void {
    if (inspecting || reducedMotion || event.pointerType === "touch") return;

    const rect = canvas.getBoundingClientRect();
    parallax.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    parallax.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    hovered = bookAt(event.clientX, event.clientY);
    canvas.style.cursor = hovered === -1 ? "" : "pointer";
    invalidate();
  }

  function onPointerLeave(): void {
    parallax.x = 0;
    parallax.y = 0;
    hovered = -1;
    canvas.style.cursor = "";
    invalidate();
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId === null) {
      onPointerHover(event);
      return;
    }
    if (event.pointerId !== pointerId) return;
    dragDistance = Math.max(dragDistance, Math.abs(event.clientX - dragStartX));
    if (isClick(dragDistance)) return;

    dragging = true;
    const delta = (lastPointerX - event.clientX) * worldPerPixel();
    const elapsed = Math.max(event.timeStamp - lastPointerTime, 1);
    velocity = reducedMotion ? 0 : delta / elapsed;
    offset = clampOffset(offset + delta, centers);
    target = offset;
    lastPointerX = event.clientX;
    lastPointerTime = event.timeStamp;
    select(nearestIndex(offset, centers));
    invalidate();
  }

  function endDrag(timeStamp: number): void {
    dragging = false;
    pointerId = null;
    // ถ้าหยุดมือก่อนปล่อย ชั้นต้องไม่ไหลต่อด้วยความเร็วเก่า
    if (timeStamp - lastPointerTime > DRAG_STALE_MS) velocity = 0;
    if (velocity === 0) target = centers[index];
    invalidate();
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const wasClick = isClick(dragDistance);
    endDrag(event.timeStamp);
    if (!wasClick) return;

    const hit = bookAt(event.clientX, event.clientY);
    if (hit === -1) return;
    if (hit === index) options.onOpen(hit);
    else goTo(hit);
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === pointerId) endDrag(event.timeStamp);
  }

  function onWheel(event: WheelEvent): void {
    if (inspecting || !shouldHandleWheel(event.deltaX, event.deltaY)) return;
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
  canvas.addEventListener("lostpointercapture", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", onContextLost);

  function resize(width: number, height: number): void {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    // setSize ล้างภาพ ต้องวาดทันทีเพื่อไม่ให้เห็นเฟรมว่าง
    if (fonts && visible) renderer.render(scene, camera);
    invalidate();
  }

  function dispose(): void {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(wheelTimer);
    stopOrbit();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("lostpointercapture", onPointerCancel);
    canvas.removeEventListener("pointerleave", onPointerLeave);
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
    textures.weave.dispose();
    textures.pageEdge.dispose();
    environment?.dispose();
    renderer.dispose();
  }

  resize(canvas.clientWidth, canvas.clientHeight);
  updateBooks(0, performance.now());

  const ready = resolveFontFamilies().then((families) => {
    if (disposed) return;
    fonts = families;
    meshes.forEach((mesh, bookIndex) => {
      const spine = drawSpine(books[bookIndex], mesh.cloth, fonts, mesh);
      applyTexture(mesh.spine, canvasTexture(spine, anisotropy));
    });
    requestCovers();
    if (!reducedMotion && !lowPower) entranceStart = performance.now();
    updateBooks(0, performance.now());
    renderer.render(scene, camera);
    invalidate();
  });

  return {
    ready,
    goTo,
    inspect,
    closeInspect,
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
