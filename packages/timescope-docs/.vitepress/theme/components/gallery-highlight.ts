import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import javascript from 'shiki/langs/javascript.mjs';
import html from 'shiki/langs/html.mjs';
import githubDark from 'shiki/themes/github-dark.mjs';

const highlighter = createHighlighterCore({
  themes: [githubDark],
  langs: [javascript, html],
  engine: createJavaScriptRegexEngine(),
});

export async function highlight(code: string, lang: 'javascript' | 'html') {
  return (await highlighter).codeToHtml(code, { lang, theme: 'github-dark' });
}
