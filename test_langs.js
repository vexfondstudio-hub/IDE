import { langs } from '@uiw/codemirror-extensions-langs';
console.log(Object.keys(langs).filter(k => ["js", "javascript", "python", "cpp", "java", "csharp", "cs", "rust", "rs", "lua", "html"].includes(k)));
