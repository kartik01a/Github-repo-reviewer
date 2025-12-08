import { NextRequest, NextResponse } from "next/server";
import { detectTechStack, fetchRepoFiles } from "@/lib/github";
import { reviewRepository } from "@/lib/review";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { repoUrl, branch, techStackOverride } = await req.json();

    if (!repoUrl || !branch) {
      return NextResponse.json(
        { error: "repoUrl and branch are required" },
        { status: 400 }
      );
    }

    const files = await fetchRepoFiles(repoUrl, branch);
    if (!files.length) {
      return NextResponse.json(
        { error: "No files found in repo/branch (or none matched filters)" },
        { status: 404 }
      );
    }

    const detectedTechStack = detectTechStack(files);

    const review = await reviewRepository({
      files,
      detectedTechStack,
      techStackOverride,
    });

    return NextResponse.json(
      {
        review,
        detectedTechStack,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Review API error", err);
    return NextResponse.json(
      {
        error: err?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
