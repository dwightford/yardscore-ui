import { NextRequest, NextResponse } from "next/server";

const PLANTNET_API_KEY = process.env.PLANTNET_API_KEY || "";
const PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all";

export async function POST(req: NextRequest) {
  if (!PLANTNET_API_KEY) {
    return NextResponse.json({ error: "PlantNet API key not configured" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Build PlantNet request
    const plantnetForm = new FormData();
    plantnetForm.append("images", file);
    plantnetForm.append("organs", "auto");

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
