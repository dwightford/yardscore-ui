/**
 * In-browser MobileSAM segmentation via ONNX Runtime Web.
 *
 * Two-stage inference:
 *   1. Encoder: image → embedding (runs once per frame, ~200-500ms)
 *   2. Decoder: embedding + point prompt → mask (runs per tap, ~50ms)
 *
 * Loaded on-demand when user first taps to label (not at scan start).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function getOrt(): any {
  return (window as any).ort;
}

// ── Model state ────────────────────────────────────────────────────────────

const ENCODER_URL = "/models/mobilesam-encoder.onnx";
const DECODER_URL = "/models/mobilesam-decoder.onnx";
const SAM_INPUT_SIZE = 1024;

let encoderSession: any = null;
let decoderSession: any = null;
let samLoading = false;
let samLoadError: string | null = null;

// Cache: last encoded frame embedding (avoid re-encoding same frame)
let lastEmbedding: any = null;
let lastEmbeddingTime = 0;

export function isSamLoaded(): boolean {
  return encoderSession !== null && decoderSession !== null;
}

export function isSamLoading(): boolean {
  return samLoading;
}

/**
 * Load MobileSAM encoder + decoder. Called on first tap-to-label.
 */
export async function loadSam(): Promise<boolean> {
  if (isSamLoaded()) return true;
  if (samLoading) return false;
  if (samLoadError) return false;

  samLoading = true;

  try {
    // Ensure ONNX Runtime is loaded (same script tag as YOLO uses)
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

    // Load both models in parallel
    const [enc, dec] = await Promise.all([
      ort.InferenceSession.create(ENCODER_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      }),
      ort.InferenceSession.create(DECODER_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      }),
    ]);

    encoderSession = enc;
    decoderSession = dec;
    samLoading = false;
    return true;
  } catch (err) {
    samLoading = false;
    samLoadError = err instanceof Error ? err.message : "Failed to load SAM";
    console.error("SAM load failed:", err);
    return false;
  }
}

/**
 * Segment an object at a point in the video frame.
 * Returns a binary mask as a canvas ImageData, plus the mask as a data URL.
 */
export async function segmentAtPoint(
  video: HTMLVideoElement,
  /** Tap x coordinate in video pixel space (0 to videoWidth) */
  tapX: number,
  /** Tap y coordinate in video pixel space (0 to videoHeight) */
  tapY: number,
): Promise<{ maskDataUrl: string; maskArea: number; totalArea: number } | null> {
  if (!encoderSession || !decoderSession) return null;

  const ort = getOrt();
  if (!ort) return null;

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  // --- Step 1: Encode the image (or use cache if recent) ---
  const now = Date.now();
  if (!lastEmbedding || now - lastEmbeddingTime > 2000) {
    const encCanvas = document.createElement("canvas");
    encCanvas.width = SAM_INPUT_SIZE;
    encCanvas.height = SAM_INPUT_SIZE;
    const encCtx = encCanvas.getContext("2d");
    if (!encCtx) return null;

    // Resize to 1024x1024
    encCtx.drawImage(video, 0, 0, SAM_INPUT_SIZE, SAM_INPUT_SIZE);
    const encData = encCtx.getImageData(0, 0, SAM_INPUT_SIZE, SAM_INPUT_SIZE);
    const pixels = encData.data;
    const numPixels = SAM_INPUT_SIZE * SAM_INPUT_SIZE;
    const float32 = new Float32Array(3 * numPixels);

    for (let i = 0; i < numPixels; i++) {
      const pi = i * 4;
      float32[i] = pixels[pi] / 255.0;
      float32[i + numPixels] = pixels[pi + 1] / 255.0;
      float32[i + 2 * numPixels] = pixels[pi + 2] / 255.0;
    }

    const inputTensor = new ort.Tensor("float32", float32, [1, 3, SAM_INPUT_SIZE, SAM_INPUT_SIZE]);

    try {
      const encOutput = await encoderSession.run({ image: inputTensor });
      lastEmbedding = encOutput[Object.keys(encOutput)[0]];
      lastEmbeddingTime = now;
    } catch (err) {
      console.error("SAM encoder failed:", err);
      return null;
    }
  }

  // --- Step 2: Decode mask from point prompt ---
  // Scale tap coordinates from video space to SAM input space (1024x1024)
  const samX = (tapX / vw) * SAM_INPUT_SIZE;
  const samY = (tapY / vh) * SAM_INPUT_SIZE;

  const pointCoords = new ort.Tensor("float32", new Float32Array([samX, samY]), [1, 1, 2]);
  const pointLabels = new ort.Tensor("float32", new Float32Array([1]), [1, 1]); // 1 = foreground

  let masks: any;
  try {
    const decOutput = await decoderSession.run({
      image_embeddings: lastEmbedding,
      point_coords: pointCoords,
      point_labels: pointLabels,
    });
    masks = decOutput["masks"];
  } catch (err) {
    console.error("SAM decoder failed:", err);
    return null;
  }

  if (!masks) return null;

  // --- Step 3: Convert low-res mask to image-sized mask ---
  const maskData = masks.data as Float32Array;
  const maskH = masks.dims[2] as number;
  const maskW = masks.dims[3] as number;

  // Create a canvas to render the mask at video resolution
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = vw;
  maskCanvas.height = vh;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) return null;

  // Scale mask from low-res (256x256) to video resolution
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = maskW;
  tempCanvas.height = maskH;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return null;

  const tempData = tempCtx.createImageData(maskW, maskH);
  let maskPixelCount = 0;

  // Build binary mask grid for edge detection
  const binaryMask = new Uint8Array(maskW * maskH);
  for (let i = 0; i < maskW * maskH; i++) {
    const val = maskData[i] > 0 ? 1 : 0;
    binaryMask[i] = val;
    if (val) maskPixelCount++;
  }

  // Detect edges: pixel is edge if it's in the mask but has a neighbor outside
  for (let y = 0; y < maskH; y++) {
    for (let x = 0; x < maskW; x++) {
      const idx = y * maskW + x;
      const isMask = binaryMask[idx] === 1;
      const isEdge = isMask && (
        x === 0 || x === maskW - 1 || y === 0 || y === maskH - 1 ||
        binaryMask[idx - 1] === 0 || binaryMask[idx + 1] === 0 ||
        binaryMask[idx - maskW] === 0 || binaryMask[idx + maskW] === 0
      );

      if (isEdge) {
        // Golden/amber outline
        tempData.data[idx * 4] = 255;     // R
        tempData.data[idx * 4 + 1] = 191; // G (amber)
        tempData.data[idx * 4 + 2] = 0;   // B
        tempData.data[idx * 4 + 3] = 255; // fully opaque
      } else if (isMask) {
        // Light green semi-transparent fill
        tempData.data[idx * 4] = 45;
        tempData.data[idx * 4 + 1] = 180;
        tempData.data[idx * 4 + 2] = 80;
        tempData.data[idx * 4 + 3] = 60; // lighter fill
      } else {
        tempData.data[idx * 4 + 3] = 0; // transparent
      }
    }
  }
  tempCtx.putImageData(tempData, 0, 0);

  // Scale up to video resolution
  maskCtx.imageSmoothingEnabled = false; // keep edges crisp
  maskCtx.drawImage(tempCanvas, 0, 0, vw, vh);

  const maskDataUrl = maskCanvas.toDataURL("image/png");
  const maskArea = maskPixelCount / (maskW * maskH);
  const totalArea = vw * vh;

  return { maskDataUrl, maskArea, totalArea };
}
