import type { MarkdownRenderer } from 'vitepress';

/** Give each sticky heading a section boundary, without adding markup to page content. */
export function docSections(md: MarkdownRenderer) {
  md.core.ruler.push('doc-sections', (state) => {
    const { frontmatter = {}, relativePath = '' } = state.env;
    if (frontmatter.layout && frontmatter.layout !== 'doc') return;
    if (frontmatter.stickyHeadings === false) return;
    // VitePress may process the same tokens again; never nest generated sections twice.
    if (
      state.tokens.some(
        (token) =>
          token.type === 'heading_open' && /\bdoc-(section|group)-heading\b/.test(token.attrGet('class') ?? ''),
      )
    )
      return;

    const headingLevel = relativePath === 'api/types.md' ? 3 : 2;
    const output: typeof state.tokens = [];
    let inSection = false;
    let inGroup = false;
    const html = (content: string) => {
      const token = new state.Token('html_block', '', 0);
      token.content = content;
      return token;
    };

    for (const [index, token] of state.tokens.entries()) {
      // Headings inside quotes, lists, or callouts are not page sections.
      if (token.type === 'heading_open' && token.level === 0) {
        const level = Number(token.tag.slice(1));
        if (inSection && level <= headingLevel) {
          output.push(html('</section>\n'));
          inSection = false;
        }
        if (inGroup && level < headingLevel) {
          output.push(html('</section>\n'));
          inGroup = false;
        }
        if (headingLevel === 3 && level === 2) {
          output.push(html('<section class="doc-group">\n'));
          token.attrJoin('class', 'doc-group-heading');
          inGroup = true;
        }
        if (level === headingLevel) {
          output.push(html('<section class="doc-section">\n'));
          token.attrJoin('class', 'doc-section-heading');
          inSection = true;
        }
        if (level === headingLevel || (headingLevel === 3 && level === 2)) {
          const kind = level === headingLevel ? 'section' : 'group';
          const inline = state.tokens[index + 1];
          const label = md.utils.escapeHtml(
            (inline.children ?? [])
              .filter((child) => child.type === 'text' || child.type === 'code_inline')
              .map((child) => child.content)
              .join('')
              .replaceAll('\u200b', ''),
          );
          output.push(
            html(
              `<div class="doc-sticky doc-sticky--${kind}" aria-hidden="true"><div class="doc-sticky-label">${label}</div></div>\n`,
            ),
          );
        }
      }
      output.push(token);
    }
    if (inSection) output.push(html('</section>\n'));
    if (inGroup) output.push(html('</section>\n'));
    state.tokens = output;
  });
}
