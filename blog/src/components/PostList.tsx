import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import styles from "./PostList.module.css";

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateStr));
}

export function PostList({ posts }: { posts: PostMeta[] }) {
  if (posts.length === 0) {
    return <p className={styles.empty}>まだ記事がありません。</p>;
  }

  return (
    <ol className={styles.list}>
      {posts.map((post) => (
        <li key={post.slug} className={styles.item}>
          <Link href={`/posts/${post.slug}`} className={styles.link}>
            <span className={styles.meta}>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span aria-hidden="true"> · </span>
              <span>{post.readingMinutes}分</span>
            </span>
            <h2 className={styles.title}>{post.title}</h2>
            {post.description && <p className={styles.description}>{post.description}</p>}
            {post.tags.length > 0 && (
              <ul className={styles.tags}>
                {post.tags.map((tag) => (
                  <li key={tag}>#{tag}</li>
                ))}
              </ul>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}
