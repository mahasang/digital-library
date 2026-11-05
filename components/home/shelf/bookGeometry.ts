import * as THREE from "three";
import { bookDimensions, clothIndex } from "@/components/home/shelf/shelfMath";

export interface Cloth {
  base: string;
  deep: string;
  foil: string;
}

/** ผ้าปกสีหม่นโทนอุ่น เลือกให้ตัดกับพื้น hero สีกรมท่า จึงไม่มีสีน้ำเงิน */
const CLOTH_PALETTE: Cloth[] = [
  { base: "#6E2F2B", deep: "#55211E", foil: "#E9D9B8" },
  { base: "#5E6B4A", deep: "#475238", foil: "#EFE6CF" },
  { base: "#B08A45", deep: "#8E6C31", foil: "#2E2415" },
  { base: "#3F6470", deep: "#2E4C56", foil: "#EDE3CC" },
  { base: "#A8674A", deep: "#875038", foil: "#F4E9D6" },
  { base: "#CFC3A8", deep: "#B3A68A", foil: "#3A2F22" },
];

const BOARD = 0.022;
const PAGE_COLOR = "#EFE6D2";

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

function clothMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0 });
}

/**
 * แกนของเล่ม: ความหนาตาม X ความสูงตาม Y ความกว้างปกตาม Z สันหันไป +Z ปกหน้าหันไป +X
 * หมุน -90° รอบ Y แล้วปกหน้าจะหันเข้ากล้องโดยสันอยู่ซ้าย ตรงกับหนังสือจริง
 */
export function createBook(seed: number): BookMesh {
  const { height, width, thickness } = bookDimensions(seed);
  const cloth = CLOTH_PALETTE[clothIndex(seed, CLOTH_PALETTE.length)];
  const group = new THREE.Group();

  const plain = clothMaterial(cloth.deep);
  const cover = clothMaterial(cloth.base);
  const spine = clothMaterial(cloth.base);

  const front = new THREE.Mesh(new THREE.BoxGeometry(BOARD, height, width), [
    cover,
    plain,
    plain,
    plain,
    plain,
    plain,
  ]);
  front.position.set(thickness / 2 - BOARD / 2, height / 2, 0);

  const back = new THREE.Mesh(new THREE.BoxGeometry(BOARD, height, width), plain);
  back.position.set(-thickness / 2 + BOARD / 2, height / 2, 0);

  const spineMesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, BOARD), [
    plain,
    plain,
    plain,
    plain,
    spine,
    plain,
  ]);
  spineMesh.position.set(0, height / 2, width / 2 - BOARD / 2);

  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(thickness - BOARD * 2, height * 0.97, width * 0.965),
    new THREE.MeshStandardMaterial({ color: PAGE_COLOR, roughness: 0.95 }),
  );
  pages.position.set(0, height / 2, -width * 0.012);

  group.add(front, back, spineMesh, pages);
  return { group, cover, spine, cloth, height, width, thickness };
}

function walnutTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#5A3A26";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // ลายเสี้ยนไม้แบบคงที่ เพื่อให้ชั้นหน้าตาเหมือนกันทุกครั้ง
    for (let line = 0; line < 90; line += 1) {
      const y = (line * 37) % canvas.height;
      const x = (line * 211) % canvas.width;
      context.strokeStyle = line % 3 === 0 ? "rgba(30,16,8,0.22)" : "rgba(150,104,70,0.14)";
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
  texture.repeat.set(6, 1);
  return texture;
}

/** ชั้นต่อเนื่องยาวเกินหนังสือทั้งสองด้าน จึงไม่เห็นปลายชั้นเมื่อเลื่อนสุด */
export function createShelf(totalWidth: number): THREE.Mesh {
  const shelfDepth = 2.3;
  // หนาพอให้ขอบล่างพ้นกรอบกล้อง ไม้จึงต่อกับขอบล่างของแถบพอดี
  const shelfHeight = 0.6;
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth + 60, shelfHeight, shelfDepth),
    new THREE.MeshStandardMaterial({ map: walnutTexture(), roughness: 0.62 }),
  );
  plank.position.set(0, -shelfHeight / 2, 0.2 - shelfDepth / 2);
  return plank;
}
