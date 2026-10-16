// Vite's "?raw" import returns a file's text; used by tests that check what a screen's source does and does not contain.
declare module "*?raw" {
  const content: string;
  export default content;
}
