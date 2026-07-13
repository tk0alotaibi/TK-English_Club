import { del } from "@vercel/blob";
import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 300;

type RequestBody = {
  blobUrl?: string;
  fileName?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  let blobUrl = "";

  try {
    const body = (await request.json()) as RequestBody;
    blobUrl = body.blobUrl ?? "";

    if (!blobUrl || !body.fileName) {
      return NextResponse.json(
        { error: "Audio information is missing." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured in Vercel.");
    }

    const audioResponse = await fetch(blobUrl);
    if (!audioResponse.ok) {
      throw new Error("The uploaded MP3 could not be downloaded.");
    }

    const buffer = Buffer.from(await audioResponse.arrayBuffer());
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const result = await openai.audio.transcriptions.create({
      file: await toFile(buffer, body.fileName, { type: "audio/mpeg" }),
      model: "whisper-1",
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["word"]
    });

    const words = (result.words ?? []).map((item) => ({
      word: item.word,
      start: item.start,
      end: item.end
    }));

    if (!words.length) {
      throw new Error("Whisper returned no word timestamps.");
    }

    return NextResponse.json({ text: result.text, words });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Automatic timing failed."
      },
      { status: 500 }
    );
  } finally {
    if (blobUrl) {
      try {
        await del(blobUrl);
      } catch (error) {
        console.error("Temporary MP3 cleanup failed:", error);
      }
    }
  }
}
