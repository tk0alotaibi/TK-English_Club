import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const lower = pathname.toLowerCase();
        if (!lower.endsWith(".mp3")) {
          throw new Error("Only MP3 files are allowed.");
        }

        return {
          allowedContentTypes: ["audio/mpeg", "audio/mp3"],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: "transcription" })
        };
      },
      onUploadCompleted: async () => {
        // Processing starts from the browser after the upload returns.
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 }
    );
  }
}
