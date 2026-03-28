/**
 * In-browser YOLO detection via ONNX Runtime Web.
 *
 * The ONNX Runtime is loaded via <script> tag in the scan page to avoid
 * Next.js/webpack bundling issues. This module accesses it via window.ort.
 *
 * Architecture:
 *   LOCAL (instant, ~5-15 fps)        SERVER (every 3s, for persistence)
 *   ─────────────────────────         ────────────────────────────────
 *   YOLO detects broad classes:        Deeper analysis:
 *     trees, shrubs, structures,         species, health, scoring,
 *     vehicles, ground regions           entity tracking, recommendations
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Access ONNX Runtime from the global scope (loaded via script tag)
function getOrt(): any {
  return (window as any).ort;
}

// ── COCO class names (80 classes from YOLOv8) ──────────────────────────────

const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
  "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
  "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
  "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
  "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
  "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush",
];

// ── Yard-relevant category mapping ─────────────────────────────────────────

export type YardCategory =
  | "tree" | "shrub" | "flower" | "structure"
  | "vehicle" | "person" | "animal" | "furniture" | "other";

const CATEGORY_MAP: Record<string, { category: YardCategory; minAreaRatio?: number }> = {
  "potted plant": { category: "tree", minAreaRatio: 0.02 },
  "vase": { category: "flower" },
  "broccoli": { category: "shrub" },
  "bench": { category: "structure" },
  "chair": { category: "furniture" },
  "couch": { category: "furniture" },
  "dining table": { category: "structure" },
  "car": { category: "vehicle" },
  "truck": { category: "vehicle" },
  "motorcycle": { category: "vehicle" },
  "bicycle": { category: "vehicle" },
  "bus": { category: "vehicle" },
  "person": { category: "person" },
  "bird": { category: "animal" },
  "cat": { category: "animal" },
  "dog": { category: "animal" },
};

// ── Detection types ────────────────────────────────────────────────────────

export interface Detection {
  class: string;
  category: YardCategory;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  size: "large" | "medium" | "small";
}

export interface DetectionResult {
  detections: Detection[];
  counts: Record<YardCategory, number>;
  treeSizes: { large: number; medium: number; small: number };
  inferenceMs: number;
}

// ── Model state ────────────────────────────────────────────────────────────

const MODEL_URL = "/models/yolov8n.onnx";
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

let session: any = null;
let loading = false;
let loadError: string | null = null;

/**
 * Load the ONNX Runtime script and then the YOLO model.
 */
export async function loadModel(): Promise<boolean> {
  if (session) return true;
  if (loading) return false;
  if (loadError) return false;

  loading = true;

  try {
    // Ensure ONNX Runtime script is loaded
    if (!getOrt()) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/ort.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load ONNX Runtime"));
        document.head.appendChild(script);
      });
    }

    const ort = getOrt();
    if (!ort) throw new Error("ONNX Runtime not available");

    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = "/";

    session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });

    loading = false;
    return true;
  } catch (err) {
    loading = false;
    loadError = err instanceof Error ? err.message : "Failed to load model";
    console.error("YOLO model load failed:", err);
    return false;
  }
}

export function isModelLoaded(): boolean {
  return session !== null;
}

export function getLoadError(): string | null {
  return loadError;
}

/**
 * Run detection on a video element's current frame.
 */
export async function detectFromVideo(video: HTMLVideoElement): Promise<DetectionResult | null> {
  if (!session) return null;
  const ort = getOrt();
  if (!ort) return null;

  const start = performance.now();

  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
  const nw = Math.round(vw * scale);
  const nh = Math.round(vh * scale);
  const dx = (INPUT_SIZE - nw) / 2;
  const dy = (INPUT_SIZE - nh) / 2;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(video, dx, dy, nw, nh);

  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = imageData.data;
  const numPixels = INPUT_SIZE * INPUT_SIZE;
  const float32Data = new Float32Array(3 * numPixels);

  for (let i = 0; i < numPixels; i++) {
    const pi = i * 4;
    float32Data[i] = pixels[pi] / 255.0;
    float32Data[i + numPixels] = pixels[pi + 1] / 255.0;
    float32Data[i + 2 * numPixels] = pixels[pi + 2] / 255.0;
  }

  const inputTensor = new ort.Tensor("float32", float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]);

  let output: any;
  try {
    output = await session.run({ images: inputTensor });
  } catch {
    try {
      output = await session.run({ input: inputTensor });
    } catch (err) {
      console.error("YOLO inference failed:", err);
      return null;
    }
  }

  const outputData = output[Object.keys(output)[0]];
  if (!outputData) return null;

  const data = outputData.data as Float32Array;
  const numFeatures = outputData.dims[1] as number;
  const numDetections = outputData.dims[2] as number;

  const rawDetections: Detection[] = [];

  for (let i = 0; i < numDetections; i++) {
    let maxConf = 0;
    let maxClassIdx = 0;
    for (let c = 4; c < numFeatures; c++) {
      const conf = data[c * numDetections + i];
      if (conf > maxConf) {
        maxConf = conf;
        maxClassIdx = c - 4;
      }
    }
    if (maxConf < CONF_THRESHOLD) continue;

    const cx = data[0 * numDetections + i];
    const cy = data[1 * numDetections + i];
    const w = data[2 * numDetections + i];
    const h = data[3 * numDetections + i];

    const x1 = (cx - w / 2 - dx) / scale;
    const y1 = (cy - h / 2 - dy) / scale;
    const bw = w / scale;
    const bh = h / scale;

    const className = COCO_CLASSES[maxClassIdx] || "unknown";
    const mapping = CATEGORY_MAP[className];
    const category: YardCategory = mapping?.category || "other";
    const areaRatio = (bw * bh) / (vw * vh);

    if (mapping?.minAreaRatio && areaRatio < mapping.minAreaRatio) continue;

    let size: "large" | "medium" | "small" = "small";
    if (areaRatio > 0.08) size = "large";
    else if (areaRatio > 0.03) size = "medium";

    rawDetections.push({ class: className, category, confidence: maxConf, bbox: { x: x1, y: y1, w: bw, h: bh }, size });
  }

  const detections = nms(rawDetections, IOU_THRESHOLD);

  const counts: Record<YardCategory, number> = {
    tree: 0, shrub: 0, flower: 0, structure: 0,
    vehicle: 0, person: 0, animal: 0, furniture: 0, other: 0,
  };
  const treeSizes = { large: 0, medium: 0, small: 0 };

  for (const det of detections) {
    counts[det.category]++;
    if (det.category === "tree") treeSizes[det.size]++;
  }

  return { detections, counts, treeSizes, inferenceMs: performance.now() - start };
}

// ── NMS ────────────────────────────────────────────────────────────────────

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.bbox.x, b.bbox.x);
  const y1 = Math.max(a.bbox.y, b.bbox.y);
  const x2 = Math.min(a.bbox.x + a.bbox.w, b.bbox.x + b.bbox.w);
  const y2 = Math.min(a.bbox.y + a.bbox.h, b.bbox.y + b.bbox.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.bbox.w * a.bbox.h + b.bbox.w * b.bbox.h - intersection;
  return union > 0 ? intersection / union : 0;
}

function nms(detections: Detection[], threshold: number): Detection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const keep: Detection[] = [];
  for (const det of sorted) {
    let suppressed = false;
    for (const kept of keep) {
      if (det.category === kept.category && iou(det, kept) > threshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) keep.push(det);
  }
  return keep;
}
