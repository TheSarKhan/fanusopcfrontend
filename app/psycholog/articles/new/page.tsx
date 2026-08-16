"use client";

import ArticleEditorPage, { type ArticleEditorApi } from "@/components/ArticleEditorPage";
import { psychologistApi } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const editorApi: ArticleEditorApi = {
  createBlogPost: psychologistApi.createArticle,
  updateBlogPost: psychologistApi.updateArticle,
  uploadFile: psychologistApi.uploadFile,
};

export default function NewArticlePage() {
  const { t } = useT();
  return <ArticleEditorPage api={editorApi} backHref="/psycholog/articles" backLabel={t("psyArticles.title")} />;
}
