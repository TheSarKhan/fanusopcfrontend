// Question text is sometimes authored with its own leading "N." prefix,
// which would otherwise duplicate the index badge/number rendered next to it.
// Strips any leading numbering the author baked into the question text so we
// don't double it against our own index. Handles single ("6."), compound
// ("6.6.", "1.2.3.") and spaced ("6. 6.") forms alike.
export function stripLeadingNumber(text: string): string {
  return text.replace(/^\s*(\d+[.)]\s*)+/, "");
}
