"use client";

import ArticleEditorPage, { type ArticleEditorApi } from "@/components/ArticleEditorPage";
import { adminApi } from "@/lib/api";

const editorApi: ArticleEditorApi = {
  createBlogPost: adminApi.createBlogPost,
  updateBlogPost: adminApi.updateBlogPost,
  getBlogCategories: adminApi.getBlogCategories,
  uploadFile: adminApi.uploadFile,
};

export default function NewAdminArticlePage() {
  return <ArticleEditorPage api={editorApi} backHref="/admin/blog" backLabel="Məqalələr" />;
}
