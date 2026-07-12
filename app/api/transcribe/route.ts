import { del } from "@vercel/blob";
import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 300;

type Body = {
  blobUrl?: string;
  fileName?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  let blobUrl = "";

  try {
    const body = (await request.json()) as Body;
    blobUrl = body.blobUrl ?? "";

    if (!blobUrl || !body.fileName) {
      return NextResponse.json({ error: "Missing audio information." }, { status: 400 });
    }

    const audioResponse = await fetch(blobUrl);
    if (!audioResponse.ok) {
      throw new Error("Could not read the uploaded MP3.");
    }

    const buffer = Buffer.from(await audioResponse.arrayBuffer());
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await client.audio.transcriptions.create({
      file: await toFile(buffer, body.fileName, { type: "audio/mpeg" }),
      model: "whisper-1",
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["word"]
    });

    const words = (transcription.words ?? []).map((word) => ({
      word: word.word,
      start: word.start,
      end: word.end
    }));

    if (!words.length) {
      throw new Error("Whisper returned no word timestamps.");
    }

    return NextResponse.json({
      text: transcription.text,
      words
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed." },
      { status: 500 }
    );
  } finally {
    if (blobUrl) {
      try {
        await del(blobUrl);
      } catch (cleanupError) {
        console.error("Temporary audio cleanup failed:", cleanupError);
      }
    }
  }
}
