import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/api";
import BlogPage from "./BlogPage";

export const metadata: Metadata = {
  title: "Bloq – Fanus",
  description: "Psixologiya, özünüinkişaf və mental sağlamlıq haqqında məqalələr.",
};

export default async function Page() {
  const posts = await getBlogPosts().catch(() => []);
  return <BlogPage posts={posts} />;
}
