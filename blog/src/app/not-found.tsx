import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ padding: "6rem 0", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>404</p>
      <h1 style={{ margin: "0.75rem 0 1.5rem" }}>そのページはない</h1>
      <Link href="/" style={{ color: "var(--color-accent)" }}>
        トップに戻る
      </Link>
    </main>
  );
}
