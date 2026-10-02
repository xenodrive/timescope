# API reference components

API pages share these components:

- `ApiCode`: inline code and identifier links. Text is rendered as Vue text nodes, including type syntax such as `<T>` and `|`.
- `ApiSignature`: a multiline signature or declaration, with identifier links and the theme's copy button.
- `ApiMember`: a compact member card with short call signatures, parameters, return type, description, and anchor. Related overloads or aliases can share an entry. Anchors are retained without a visible permalink control.
- `ApiParameters`: a parameter table built from `{ name, type, description? }` data. Optional names retain their `?` suffix.
- `ApiTable`: field, property, event, and error tables. Column labels, widths, wrapping, and mobile styles are centralized here.

`api-markdown.ts` applies them to pages under `src/api/`: inline code becomes `ApiCode`, TypeScript fences become `ApiSignature`, and tables become `ApiTable`. A table starting with `Signature` and `Returns` is treated as compact member data and rendered as individual `ApiMember` entries, never as a method table. `api-members.ts` separates typed signatures into short call signatures and parameter data at build time. Keep argument types in the source; missing types cause a build error. Method anchors are qualified by the enclosing class/interface heading.

For a method with several paragraphs, examples, or parameter details, use the component directly:

```md
<ApiMember
  id="timescope-settime"
  :signatures="['setTime(value, animation?)']"
  :parameters="[
    { name: 'value', type: 'TimescopeTimeLike', description: 'Selected time; null follows the clock.' },
    { name: 'animation?', type: 'TimescopeAnimationInput', description: 'Default: out, 500 ms.' }
  ]"
  returns="boolean">

Set the selected time.

<template #return-description>

`false` for invalid input.

</template>

</ApiMember>
```

Identifier destinations live in `api-identifiers.ts`. Aliases such as `Using1` and `Using2` point to their shared explanation; an export does not need its own heading. Explicit Markdown links take precedence. VitePress's `withBase()` supplies the deployment prefix.

## Changing presentation

Member data is independent of the layout. Change `ApiMember.vue` to rearrange all members without editing their documentation. Its `header`, `parameters`, and `returns` scoped slots expose the corresponding data; the default slot is the description, `return-description` adds return semantics, and `details` accepts examples or other blocks. `kind` is available to custom headers but is not displayed by default. Parameter tables keep semantic headers without borders, backgrounds, or decorative containers.

For styling-only changes, override CSS variables in the theme: `--api-member-radius`, `--api-member-padding`, `--api-member-background`, `--api-member-header-background`, `--api-member-border`, `--api-table-radius`, and `--api-table-header-background`. Defaults follow VitePress's light/dark palette. Stable `.api-member-*`, `.api-parameters`, and `.api-table` classes support more specific changes.

Keep conceptual explanations and examples in the Guide. Update the identifier registry and existing links when regrouping reference sections, then build the docs and check fragment targets.
