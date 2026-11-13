/** View identity follows immutable edits and reorders; it never enters project JSON. */
const identities = new WeakMap<object, string>();
let next = 0;
export function editorIdentity(value: object): string {
  let id = identities.get(value);
  if (!id) { id = `editor-${++next}`; identities.set(value, id); }
  return id;
}
export function retainEditorIdentity<T extends object>(previous: object, value: T): T {
  identities.set(value, editorIdentity(previous));
  return value;
}
