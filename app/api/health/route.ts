import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    openai: Boolean(process.env.OPENAI_API_KEY),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  });
}
