import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPost, getPostSlugs } from "@/lib/posts";
import { mdxComponents } from "@/components/mdx-components";
import styles from "./post.module.css";

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateStr));
}

function loadPost(slug: string) {
  try {
    return getPost(slug);
  } catch {
    return null;
  }
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = loadPost(slug);
  if (!post) return {};
  return {
    title: post.meta.title,
    description: post.meta.description,
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = loadPost(slug);

  if (!post || (post.meta.draft && process.env.NODE_ENV === "production")) {
    notFound();
  }

  const { meta, content } = post;

  return (
    <article className={`${styles.article} container`}>
      <header className={styles.header}>
        <p className={styles.meta}>
          <time dateTime={meta.date}>{formatDate(meta.date)}</time>
          <span aria-hidden="true"> · </span>
          <span>{meta.readingMinutes}分</span>
        </p>
        <h1 className={styles.title}>{meta.title}</h1>
        {meta.tags.length > 0 && (
          <ul className={styles.tags}>
            {meta.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        )}
      </header>

      <div className={styles.prose}>
        <MDXRemote source={content} components={mdxComponents} />
      </div>

      <Link href="/" className={styles.back}>
        ← 一覧に戻る
      </Link>
    </article>
  );
}
