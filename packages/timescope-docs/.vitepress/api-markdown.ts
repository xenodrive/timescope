import type { MarkdownRenderer } from 'vitepress';
import { defineApiMember } from './api-members.ts';

/** Render API Markdown through shared components; keep content in the Markdown pages. */
export function apiMarkdown(md: MarkdownRenderer) {
  const attribute = (value: unknown) => md.utils.escapeHtml(JSON.stringify(value));
  md.core.ruler.push('api-reference', (state) => {
    if (!state.env.relativePath?.startsWith('api/')) return;
    const output: typeof state.tokens = [];
    let owner = '';
    let kind = 'Method';
    const anchors = new Set<string>();
    const html = (content: string) => {
      const token = new state.Token('html_block', '', 0);
      token.content = content;
      return token;
    };
    const text = (token: (typeof state.tokens)[number]) =>
      (token.children ?? []).map((child) => child.content).join('');

    for (let index = 0; index < state.tokens.length; index++) {
      const token = state.tokens[index];
      if (token.type === 'heading_open') {
        const level = Number(token.tag.slice(1));
        if (level > 1) {
          token.attrJoin('class', 'api-section-heading');
        }
      }
      if (token.type === 'heading_open' && token.tag === 'h2') {
        owner = state.tokens[index + 1].content.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
      if (token.type === 'heading_open' && token.tag === 'h3') {
        kind = state.tokens[index + 1].content.startsWith('Static Methods') ? 'Static method' : 'Method';
      }
      if (token.type !== 'table_open') {
        output.push(token);
        continue;
      }

      const columns: string[] = [];
      while (state.tokens[++index].type !== 'thead_close') {
        const header = state.tokens[index];
        if (header.type === 'inline') columns.push(header.content.replaceAll('`', ''));
      }

      const body: typeof state.tokens = [];
      while (state.tokens[++index].type !== 'table_close') {
        const child = state.tokens[index];
        if (child.type !== 'tbody_open' && child.type !== 'tbody_close') body.push(child);
      }

      const entryKind =
        columns[0].startsWith('Property') || columns[0] === 'Vue ref properties'
          ? 'Property'
          : columns[0] === 'Prop'
            ? 'Prop'
            : columns[0] === 'Event' || columns[0] === 'Vue / Svelte event'
              ? 'Event'
              : (columns[0] === 'Field' || / (field|member)$/.test(columns[0])) && !columns[1].endsWith(' field')
                ? 'Field'
                : undefined;

      if (columns[0] === 'Signature') {
        let cells: typeof state.tokens = [];
        for (const child of body) {
          if (child.type === 'inline') cells.push(child);
          if (child.type !== 'tr_close') continue;
          const signature = text(cells[0]);
          const member = defineApiMember(signature);
          const returns = text(cells[1]);
          const ids = [...signature.matchAll(/(?:^|,\s*)(?:\w+\.)?([\w$]+)\??\(/g)].map((match) => {
            const base = `${owner}-${match[1].replaceAll('$', '-mutating').toLowerCase()}`;
            let id = base;
            for (let suffix = 2; anchors.has(id); suffix++) id = `${base}-${suffix}`;
            anchors.add(id);
            return id;
          });
          output.push(
            html(
              `<ApiMember :id="${attribute(ids[0])}" :signatures="${attribute(member.signatures)}" :parameters="${attribute(member.parameters)}" :returns="${attribute(returns)}" :kind="${attribute(kind)}" :aliases="${attribute(ids.slice(1))}">\n`,
            ),
          );
          const slots: Record<string, string> = {
            Defaults: 'defaults',
            'Return details': 'return-description',
            Throws: 'throws',
            Rejects: 'rejects',
          };
          for (let cell = 2; cell < cells.length; cell++) {
            if (!text(cells[cell]).trim() || text(cells[cell]) === '—') continue;
            const slot = slots[columns[cell]];
            if (slot) output.push(html(`<template #${slot}>\n`));
            output.push(cells[cell]);
            if (slot) output.push(html('\n</template>\n'));
          }
          output.push(html('\n</ApiMember>\n'));
          cells = [];
        }
      } else if (entryKind) {
        let cells: typeof state.tokens = [];
        for (const child of body) {
          if (child.type === 'inline') cells.push(child);
          if (child.type !== 'tr_close') continue;
          output.push(html(`<ApiEntry kind="${entryKind}">\n<template #name>\n`), cells[0], html('\n</template>\n'));
          for (let cell = 1; cell < cells.length; cell++) {
            if (!text(cells[cell]).trim() || text(cells[cell]) === '—') continue;
            if (columns[cell] === 'Description') {
              output.push(html('<template #description>\n'), cells[cell], html('\n</template>\n'));
            } else {
              output.push(
                html(`<div class="api-detail"><dt>${md.utils.escapeHtml(columns[cell])}</dt><dd>\n`),
                cells[cell],
                html('\n</dd></div>\n'),
              );
            }
          }
          output.push(html('\n</ApiEntry>\n'));
          cells = [];
        }
      } else {
        const open = html(`<ApiTable :columns="${attribute(columns)}">\n`);
        open.map = token.map;
        output.push(open, ...body, html('</ApiTable>\n'));
      }
    }
    state.tokens = output;
  });

  const renderCode = md.renderer.rules.code_inline!;
  md.renderer.rules.code_inline = (tokens, index, options, env, renderer) => {
    if (!env.relativePath?.startsWith('api/')) return renderCode(tokens, index, options, env, renderer);

    // Explicit Markdown links take precedence over identifier links.
    let linkDepth = 0;
    for (const token of tokens.slice(0, index)) {
      if (token.type === 'link_open') linkDepth++;
      if (token.type === 'link_close') linkDepth--;
    }
    return `<ApiCode :text="${attribute(tokens[index].content)}" :linked="${linkDepth === 0}" />`;
  };

  const renderFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    if (env.relativePath?.startsWith('api/') && /^(ts|typescript)(\s|$)/.test(token.info)) {
      return `<ApiSignature :text="${attribute(token.content.trimEnd())}" />\n`;
    }
    return renderFence(tokens, index, options, env, renderer);
  };
}
