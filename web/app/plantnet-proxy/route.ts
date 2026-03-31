import { NextRequest, NextResponse } from "next/server";

const PLANTNET_API_KEY = process.env.PLANTNET_API_KEY || "";
const PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all";

export async function POST(req: NextRequest) {
  if (!PLANTNET_API_KEY) {
    return NextResponse.json({ error: "PlantNet API key not configured" }, { status: 500 });
  }

  try {
    const formData = await req.formData();

    // Collect all image files (supports multi-shot: file, file2, file3, etc.)
    const files: { blob: Blob; organ: string }[] = [];

    // Single file (backward compat)
    const singleFile = formData.get("file") as File | null;
    if (singleFile) {
      const bytes = await singleFile.arrayBuffer();
      files.push({ blob: new Blob([bytes], { type: "image/jpeg" }), organ: "auto" });
    }

    // Multi-shot files: file_0, file_1, file_2, etc. with organ_0, organ_1, organ_2
    for (let i = 0; i < 5; i++) {
      const f = formData.get(`file_${i}`) as File | null;
      if (f) {
        const bytes = await f.arrayBuffer();
        const organ = (formData.get(`organ_${i}`) as string) || "auto";
        files.push({ blob: new Blob([bytes], { type: "image/jpeg" }), organ });
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Build PlantNet request with multiple images
    const plantnetForm = new FormData();
    for (let i = 0; i < files.length; i++) {
      plantnetForm.append("images", files[i].blob, `capture_${i}.jpg`);
      plantnetForm.append("organs", files[i].organ);
    }

    const url = `${PLANTNET_URL}?include-related-images=false&no-reject=true&nb-results=5&lang=en&type=kt&api-key=${PLANTNET_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      body: plantnetForm,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `PlantNet API error: ${response.status}`, detail: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
