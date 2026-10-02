/** Presentation-independent data shared by the Markdown adapter and API components. */
export interface ApiParameter {
  name: string;
  type: string;
  description?: string;
}

export interface ApiMemberDefinition {
  signatures: string[];
  parameters: ApiParameter[];
}

/** Split TypeScript lists without splitting tuples, generics, objects, or callbacks. */
function splitList(value: string) {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if ('([{<'.includes(char)) {
      depth++;
    } else if (')]}'.includes(char) || (char === '>' && value[index - 1] !== '=')) {
      depth--;
    } else if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

export function defineApiMember(signature: string): ApiMemberDefinition {
  const parameters: ApiParameter[] = [];
  const signatures = splitList(signature).map((signature) => {
    const start = signature.indexOf('(');
    const end = signature.lastIndexOf(')');
    if (start < 0 || end < start) throw new Error(`Invalid API signature: ${signature}`);
    const names = splitList(signature.slice(start + 1, end)).map((argument) => {
      // Literal arguments are part of the call signature, not named parameters.
      if (/^(['"]).*\1$/.test(argument)) return argument;
      const colon = argument.indexOf(':');
      if (colon < 0) throw new Error(`Missing parameter type in API signature: ${signature}`);
      const name = argument.slice(0, colon).trim();
      const type = argument.slice(colon + 1).trim();
      const existing = parameters.find((parameter) => parameter.name === name);
      if (existing && existing.type !== type) existing.type += ` | ${type}`;
      else if (!existing) parameters.push({ name, type });
      return name;
    });
    return `${signature.slice(0, start)}(${names.join(', ')})`;
  });
  return { signatures, parameters };
}
