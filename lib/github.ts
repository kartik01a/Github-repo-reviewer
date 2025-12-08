import type { RequestInit } from "next/dist/server/web/spec-extension/request";

export type RepoFile = {
  path: string;
  content: string;
};

export type ParsedRepoUrl = {
  owner: string;
  repo: string;
};

const GITHUB_API_BASE = "https://api.github.com";

export function parseGithubUrl(url: string): ParsedRepoUrl {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("github.com")) {
      throw new Error("Not a GitHub URL");
    }
    const parts = u.pathname.replace(/^\/|\/$/g, "").split("/");
    if (parts.length < 2) throw new Error("Invalid GitHub repo URL");
    const [owner, repoRaw] = parts;
    const repo = repoRaw.replace(/\.git$/, "");
    return { owner, repo };
  } catch {
    throw new Error("Invalid GitHub URL");
  }
}

function getGithubHeaders(): RequestInit["headers"] {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

type GithubContentItem = {
  type: "file" | "dir";
  path: string;
  name: string;
  content?: string;
  encoding?: string;
};

const INCLUDED_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".java",
  ".cs",
  ".sql",
  ".sh",
  ".yml",
  ".yaml",
  ".json",
  ".md",
];

const ALWAYS_INCLUDE_FILENAMES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "poetry.lock",
  "Pipfile",
  "Pipfile.lock",
  "composer.json",
  "Gemfile",
  "Gemfile.lock",
  "go.mod",
  "go.sum",
  "Cargo.toml",
  "Cargo.lock",
];

function shouldIncludeFile(path: string, name: string) {
  const lower = name.toLowerCase();
  if (ALWAYS_INCLUDE_FILENAMES.includes(name)) return true;
  return INCLUDED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function fetchRepoFiles(
  repoUrl: string,
  branch: string
): Promise<RepoFile[]> {
  const { owner, repo } = parseGithubUrl(repoUrl);

  async function fetchDir(path: string): Promise<RepoFile[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
      path
    )}?ref=${encodeURIComponent(branch)}`;

    const res = await fetch(url, {
      headers: getGithubHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `GitHub API error (${res.status}) on ${path || "root"}: ${text}`
      );
    }

    const data = (await res.json()) as GithubContentItem | GithubContentItem[];

    if (!Array.isArray(data)) {
      // Single file
      if (data.type === "file" && data.content && data.encoding === "base64") {
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return [{ path: data.path, content }];
      }
      return [];
    }

    const files: RepoFile[] = [];
    for (const item of data) {
      if (item.type === "dir") {
        const subFiles = await fetchDir(item.path);
        files.push(...subFiles);
      } else if (item.type === "file") {
        if (!shouldIncludeFile(item.path, item.name)) continue;

        const fileRes = await fetch(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
            item.path
          )}?ref=${encodeURIComponent(branch)}`,
          {
            headers: getGithubHeaders(),
            cache: "no-store",
          }
        );
        if (!fileRes.ok) continue;

        const fileData = (await fileRes.json()) as GithubContentItem;
        if (!fileData.content || fileData.encoding !== "base64") continue;
        const content = Buffer.from(fileData.content, "base64").toString(
          "utf-8"
        );
        files.push({ path: fileData.path, content });
      }
    }

    return files;
  }

  const files = await fetchDir("");
  return files;
}

export function detectTechStack(files: RepoFile[]): string[] {
  const tech = new Set<string>();

  for (const file of files) {
    const name = file.path.split("/").pop() || "";

    if (name === "package.json") {
      try {
        const pkg = JSON.parse(file.content);
        const deps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        } as Record<string, string>;

        if (deps["next"]) tech.add("Next.js");
        if (deps["react"]) tech.add("React");
        if (deps["typescript"]) tech.add("TypeScript");
        if (deps["express"]) tech.add("Express");
        if (deps["@nestjs/core"]) tech.add("NestJS");
        if (deps["tailwindcss"]) tech.add("Tailwind CSS");
      } catch {
        // ignore parse errors
      }
    }

    if (name === "requirements.txt" || name === "pyproject.toml") {
      tech.add("Python");
      if (file.content.match(/fastapi/i)) tech.add("FastAPI");
      if (file.content.match(/django/i)) tech.add("Django");
      if (file.content.match(/flask/i)) tech.add("Flask");
    }

    if (name === "go.mod") {
      tech.add("Go");
    }

    if (name === "Cargo.toml") {
      tech.add("Rust");
    }

    if (file.path.startsWith("app/") && file.path.endsWith("page.tsx")) {
      tech.add("Next.js App Router");
    }
  }

  return Array.from(tech);
}
