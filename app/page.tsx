// app/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type ReviewResult = {
  summary: string;
  techStack: string[];
  risks: string[];
  suggestions: { title: string; details: string }[];
  files: { path: string; issues: string[] }[];
};

type ApiResponse = {
  review: ReviewResult;
  detectedTechStack: string[];
};

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [techStackOverride, setTechStackOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setData(null);

    if (!repoUrl.trim() || !branch.trim()) {
      setError("Please provide both Repo URL and Branch.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          branch,
          techStackOverride,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong.");
      } else {
        setData(json as ApiResponse);
      }
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const review = data?.review;
  const detectedTechStack = data?.detectedTechStack ?? [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            AI Code Reviewer for GitHub
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Paste a public GitHub repository URL and branch. The app will fetch
            the code, detect the tech stack, and run an AI-powered review with
            practical suggestions.
          </p>
        </header>

        <Card className="border-slate-200 bg-white/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Repository details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="repoUrl">GitHub Repo URL</Label>
                  <Input
                    id="repoUrl"
                    placeholder="https://github.com/user/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Public repos only for now. Example:
                    https://github.com/vercel/next.js
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Usually <code>main</code> or <code>master</code>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="techOverride">
                  Tech stack override (optional)
                </Label>
                <Textarea
                  id="techOverride"
                  placeholder="Example: Next.js, React, TypeScript, Tailwind CSS, Node.js"
                  value={techStackOverride}
                  onChange={(e) => setTechStackOverride(e.target.value)}
                  className="min-h-[70px]"
                />
                <p className="text-xs text-slate-500">
                  We auto-detect frameworks from files like{" "}
                  <code>package.json</code>, but you can refine it here. Use
                  comma-separated values.
                </p>
              </div>

              {detectedTechStack.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Detected stack</Label>
                  <div className="flex flex-wrap gap-2">
                    {detectedTechStack.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Reviewing…" : "Run Code Review"}
                </Button>
                {error && (
                  <p className="text-xs text-red-600">
                    Error: <span className="font-medium">{error}</span>
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <Card className="border-slate-200 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Running review…</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Fetching repository files and sending them to the AI reviewer.
                This may take a few seconds for larger repos.
              </p>
            </CardContent>
          </Card>
        )}

        {review && !loading && (
          <section className="grid gap-4 md:grid-cols-[2fr,1.3fr]">
            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Summary
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {review.summary}
                  </p>
                </div>

                {review.techStack?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      AI-understood tech stack
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {review.techStack.map((t) => (
                        <Badge key={t} className="border-slate-200">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {review.risks?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Key risks
                    </h3>
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                      {review.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.suggestions?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Suggestions
                    </h3>
                    <div className="mt-2 space-y-2">
                      {review.suggestions.map((s, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-2"
                        >
                          <p className="text-xs font-semibold text-slate-800">
                            {s.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-700">
                            {s.details}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Per-file issues</CardTitle>
              </CardHeader>
              <CardContent>
                {review.files?.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No specific per-file issues reported.
                  </p>
                ) : (
                  <ScrollArea className="h-[320px] pr-2">
                    <div className="space-y-3">
                      {review.files.map((file, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-2"
                        >
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {file.path}
                          </p>
                          {file.issues?.length ? (
                            <ul className="mt-1 list-disc pl-4 text-xs text-slate-700">
                              {file.issues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">
                              No specific issues listed.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
