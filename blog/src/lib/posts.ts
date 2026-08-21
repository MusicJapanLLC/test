import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

const POSTS_DIR = path.join(process.cwd(), "src/content/posts");

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  draft: boolean;
  readingMinutes: number;
}

export interface Post {
  meta: PostMeta;
  content: string;
}

function readSlugs(): string[] {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

function readPost(slug: string): Post {
  const raw = fs.readFileSync(path.join(POSTS_DIR, `${slug}.mdx`), "utf8");
  const { data, content } = matter(raw);

  if (!data.title || !data.date) {
    throw new Error(`Post "${slug}" is missing required frontmatter (title, date).`);
  }

  const meta: PostMeta = {
    slug,
    title: data.title,
    date: data.date,
    description: data.description ?? "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    draft: Boolean(data.draft),
    readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
  };

  return { meta, content };
}

const isProd = process.env.NODE_ENV === "production";

export function getAllPosts(): PostMeta[] {
  return readSlugs()
    .map((slug) => readPost(slug).meta)
    .filter((meta) => !(meta.draft && isProd))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostSlugs(): string[] {
  return readSlugs();
}

export function getPost(slug: string): Post {
  return readPost(slug);
}
