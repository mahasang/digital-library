interface CapabilityInput {
  webgl2: boolean;
  saveData?: boolean;
  deviceMemory?: number;
}

const MIN_DEVICE_MEMORY_GB = 4;

export function shouldEnable3D({ webgl2, saveData, deviceMemory }: CapabilityInput): boolean {
  if (!webgl2 || saveData) return false;
  return deviceMemory === undefined || deviceMemory >= MIN_DEVICE_MEMORY_GB;
}

/** เครื่องที่เรนเดอร์ด้วย CPU รับเงาและ environment map ไม่ไหว ต้องใช้โหมดเบา */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|basic render/i.test(renderer);
}

function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  const context = document.createElement("canvas").getContext("webgl2");
  if (!context) return false;
  // คืน context ทันที เบราว์เซอร์จำกัดจำนวน context ต่อหน้า
  context.getExtension("WEBGL_lose_context")?.loseContext();
  return true;
}

export function detectCapability(): CapabilityInput {
  if (typeof navigator === "undefined") return { webgl2: false };

  // ทั้งสองค่านี้ไม่อยู่ใน lib.dom และไม่มีใน Safari/Firefox
  const device = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };

  return {
    webgl2: hasWebGL2(),
    saveData: device.connection?.saveData,
    deviceMemory: device.deviceMemory,
  };
}
