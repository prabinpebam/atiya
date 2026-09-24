export interface CapabilityProbe {
  webgl2: boolean;
  /** True when a WebGL2 context can only be created with a major performance caveat (e.g. software rendering). */
  majorPerformanceCaveat: boolean;
  saveData: boolean;
}

export type GateDecision =
  | { kind: 'load' }
  | { kind: 'offer'; reason: 'software-rendering' | 'save-data' }
  | { kind: 'fallback'; reason: 'no-webgl2' };

export function decide(p: CapabilityProbe): GateDecision {
  if (!p.webgl2) return { kind: 'fallback', reason: 'no-webgl2' };
  if (p.majorPerformanceCaveat) return { kind: 'offer', reason: 'software-rendering' };
  if (p.saveData) return { kind: 'offer', reason: 'save-data' };
  return { kind: 'load' };
}

function tryContext(attrs?: WebGLContextAttributes): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Browser-only probe. Kept free of three/React imports so the gate stays tiny. */
export function probeCapabilities(): CapabilityProbe {
  const webgl2 = tryContext();
  const fast = webgl2 && tryContext({ failIfMajorPerformanceCaveat: true });
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return { webgl2, majorPerformanceCaveat: webgl2 && !fast, saveData: Boolean(conn?.saveData) };
}
