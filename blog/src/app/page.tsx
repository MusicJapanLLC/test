import { Hero } from "@/components/Hero";
import { PostList } from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";

export default function HomePage() {
  const posts = getAllPosts();

  return (
    <>
      <Hero />
      <main className="container">
        <PostList posts={posts} />
      </main>
    </>
  );
}
