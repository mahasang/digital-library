import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { bookDimensions, clothIndex } from "@/components/home/shelf/shelfMath";

export interface Cloth {
  base: string;
  deep: string;
  foil: string;
}

/** ผ้าปกสีหม่นโทนอุ่น เลือกให้เด่นบนผนังครีมและไม้วอลนัต */
const CLOTH_PALETTE: Cloth[] = [
  { base: "#6E2F2B", deep: "#55211E", foil: "#E9D9B8" },
  { base: "#5E6B4A", deep: "#475238", foil: "#EFE6CF" },
  { base: "#B08A45", deep: "#8E6C31", foil: "#2E2415" },
  { base: "#3F6470", deep: "#2E4C56", foil: "#EDE3CC" },
  { base: "#A8674A", deep: "#875038", foil: "#F4E9D6" },
  { base: "#22344F", deep: "#18263B", foil: "#E8DCC2" },
  { base: "#D8CDB4", deep: "#BDB096", foil: "#3A2F22" },
  { base: "#2F2B28", deep: "#1F1C1A", foil: "#DCCFB4" },
];

const BOARD = 0.03;
const SPINE_DEPTH = 0.06;

/** พื้นผิวที่ทุกเล่มใช้ร่วมกัน สร้างครั้งเดียวและเก็บกวาดครั้งเดียว */
export interface SharedTextures {
  weave: THREE.CanvasTexture;
  pageEdge: THREE.CanvasTexture;
}

export interface BookMesh {
  group: THREE.Group;
  /** พื้นผิวปกหน้าและสัน รอรับ texture ที่วาดทีหลัง */
  cover: THREE.MeshStandardMaterial;
  spine: THREE.MeshStandardMaterial;
  cloth: Cloth;
  height: number;
  width: number;
  thickness: number;
}

/** ลายทอผ้าแบบคงที่ ใช้เป็น bump ให้ปกจับแสงเหมือนผ้าจริง */
function weaveTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const shade = 120 + (((x * 7 + y * 13) ^ (x * y)) % 70);
        context.fillStyle = `rgb(${shade},${shade},${shade})`;
        context.fillRect(x, y, 2, 2);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  return texture;
}

/** เส้นขอบกระดาษ เนื้อกระดาษซ้อนตามแกน X เส้นจึงไล่ตามแกนนอนของ texture */
function pageEdgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 4;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#EFE6D2";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let x = 0; x < canvas.width; x += 2) {
      context.fillStyle = (x * 31) % 7 < 3 ? "rgba(120,100,70,0.28)" : "rgba(255,250,235,0.5)";
      context.fillRect(x, 0, 1, canvas.height);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSharedTextures(): SharedTextures {
  return { weave: weaveTexture(), pageEdge: pageEdgeTexture() };
}

function clothMaterial(color: string, weave: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.84,
    metalness: 0,
    bumpMap: weave,
    bumpScale: 0.6,
  });
}

function withShadows(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * แกนของเล่ม: ความหนาตาม X ความสูงตาม Y ความกว้างปกตาม Z สันหันไป +Z ปกหน้าหันไป +X
 * หมุน -90° รอบ Y แล้วปกหน้าจะหันเข้ากล้องโดยสันอยู่ซ้าย ตรงกับหนังสือจริง
 */
export function createBook(seed: number, textures: SharedTextures): BookMesh {
  const { height, width, thickness } = bookDimensions(seed);
  const cloth = CLOTH_PALETTE[clothIndex(seed, CLOTH_PALETTE.length)];
  const group = new THREE.Group();
  group.rotation.order = "YXZ";

  const plain = clothMaterial(cloth.deep, textures.weave);
  const cover = clothMaterial(cloth.base, textures.weave);
  const spine = clothMaterial(cloth.base, textures.weave);

  const board = () => new RoundedBoxGeometry(BOARD, height, width, 3, 0.012);

  const front = withShadows(
    new THREE.Mesh(board(), [cover, plain, plain, plain, plain, plain]),
  );
  front.position.set(thickness / 2 - BOARD / 2, height / 2, 0);

  const back = withShadows(new THREE.Mesh(board(), plain));
  back.position.set(-thickness / 2 + BOARD / 2, height / 2, 0);

  const spineMesh = withShadows(
    new THREE.Mesh(new RoundedBoxGeometry(thickness, height, SPINE_DEPTH, 4, 0.026), [
      plain,
      plain,
      plain,
      plain,
      spine,
      plain,
    ]),
  );
  spineMesh.position.set(0, height / 2, width / 2 - SPINE_DEPTH / 2);

  // เนื้อกระดาษร่นจากขอบปก ปกแข็งจึงยื่นออกมาเหมือนหนังสือปกแข็งจริง
  const pages = withShadows(
    new THREE.Mesh(
      new THREE.BoxGeometry(thickness - BOARD * 2, height * 0.965, width * 0.955),
      new THREE.MeshStandardMaterial({ map: textures.pageEdge, roughness: 0.95 }),
    ),
  );
  pages.position.set(0, height / 2, -width * 0.012);

  group.add(front, back, spineMesh, pages);
  return { group, cover, spine, cloth, height, width, thickness };
}

function walnutTexture(repeat: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#6A4630";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // ลายเสี้ยนไม้แบบคงที่ เพื่อให้ชั้นหน้าตาเหมือนกันทุกครั้ง
    for (let line = 0; line < 170; line += 1) {
      const y = (line * 37) % canvas.height;
      const x = (line * 211) % canvas.width;
      context.strokeStyle = line % 3 === 0 ? "rgba(30,16,8,0.2)" : "rgba(170,120,84,0.13)";
      context.lineWidth = 1 + (line % 2);
      context.beginPath();
      context.moveTo(x - 300, y);
      context.bezierCurveTo(x - 80, y + 3, x + 90, y - 3, x + 320, y + 1);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(repeat, 1);
  return texture;
}

/** ชั้นต่อเนื่องยาวเกินหนังสือทั้งสองด้าน จึงไม่เห็นปลายชั้นเมื่อเลื่อนสุด */
export function createShelf(totalWidth: number): THREE.Group {
  const length = totalWidth + 60;
  const depth = 3.1;
  const height = 0.42;
  const frontZ = 1.25;
  const shelf = new THREE.Group();

  const plank = new THREE.Mesh(
    new RoundedBoxGeometry(length, height, depth, 3, 0.03),
    new THREE.MeshStandardMaterial({ map: walnutTexture(length / 5), roughness: 0.5 }),
  );
  plank.position.set(0, -height / 2, frontZ - depth / 2);
  plank.receiveShadow = true;
  plank.castShadow = true;

  const underside = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.16, depth - 0.14),
    new THREE.MeshStandardMaterial({ color: "#2B1A10", roughness: 0.7 }),
  );
  underside.position.set(0, -height - 0.08, frontZ - depth / 2 - 0.07);

  shelf.add(plank, underside);
  return shelf;
}

/** ผนังโปร่งใสที่รับแต่เงา สีผนังจริงมาจาก CSS ของหน้าเว็บ */
export function createWall(): THREE.Mesh {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 14),
    new THREE.ShadowMaterial({ opacity: 0.2 }),
  );
  wall.position.set(0, 5, -1.84);
  wall.receiveShadow = true;
  return wall;
}
