"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { psychologistApi, type BlogPost } from "@/lib/api";
import ArticleEditorPage, { type ArticleEditorApi } from "@/components/ArticleEditorPage";

const editorApi: ArticleEditorApi = {
  createBlogPost: psychologistApi.createArticle,
  updateBlogPost: psychologistApi.updateArticle,
  getBlogCategories: psychologistApi.getBlogCategories,
  uploadFile: psychologistApi.uploadFile,
};

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    psychologistApi
      .getArticleById(Number(id))
      .then(setArticle)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#F7FAFD", display: "flex", alignItems: "center", justifyContent: "center", color: "#8AAABF", fontSize: 14 }}>
        Yüklənir...
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#F7FAFD", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#1A2535" }}>Məqalə tapılmadı</p>
        <a href="/psycholog/articles" style={{ fontSize: 13, color: "#002147", fontWeight: 600 }}>← Məqalələrə qayıt</a>
      </div>
    );
  }

  return <ArticleEditorPage article={article} api={editorApi} backHref="/psycholog/articles" backLabel="Məqalələrim" />;
}
