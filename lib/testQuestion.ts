// Question text is sometimes authored with its own leading "N." prefix,
// which would otherwise duplicate the index badge/number rendered next to it.
// Strips any leading numbering the author baked into the question text so we
// don't double it against our own index. Handles single ("6."), compound
// ("6.6.", "1.2.3.") and spaced ("6. 6.") forms alike.
//
// DİQQƏT — null qəbul edir və bu, təsadüfi deyil: cavab tarixçəsində sual mətni
// olmaya bilər (test redaktə olunub, sual silinib). Əvvəl tip `string` idi, backend
// isə null göndərirdi — nəticədə pasiyentin nəticə səhifəsi tamamilə çökürdü
// («This page couldn't load»), psixoloq panelində isə suallar boş görünürdü.
export function stripLeadingNumber(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/^\s*(\d+[.)]\s*)+/, "");
}
