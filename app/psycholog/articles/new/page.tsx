"use client";

import ArticleEditorPage, { type ArticleEditorApi } from "@/components/ArticleEditorPage";
import { psychologistApi } from "@/lib/api";

const editorApi: ArticleEditorApi = {
  createBlogPost: psychologistApi.createArticle,
  updateBlogPost: psychologistApi.updateArticle,
  getBlogCategories: psychologistApi.getBlogCategories,
  uploadFile: psychologistApi.uploadFile,
};

export default function NewArticlePage() {
  return <ArticleEditorPage api={editorApi} backHref="/psycholog/articles" backLabel="Məqalələrim" />;
}
