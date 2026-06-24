export interface ArenaScript {
  id: string;
  title: string;
  language: string;
  version: string;
  code: string;
  author: string;
  likes: number;
}

const STORAGE_KEY = 'joker_arena_scripts';

export function getArenaScripts(): ArenaScript[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return [
    {
      id: '1',
      title: 'Fibonacci Generator',
      language: 'javascript',
      version: '18.15.0',
      code: 'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\nconsole.log(fibonacci(10));',
      author: 'JS_Master',
      likes: 12,
    },
    {
      id: '2',
      title: 'Hello World Python',
      language: 'python',
      version: '3.10.0',
      code: 'print("Hello, Joker!")',
      author: 'Py_Beginner',
      likes: 5,
    }
  ];
}

export function saveArenaScript(script: Omit<ArenaScript, 'id' | 'likes'>) {
  const scripts = getArenaScripts();
  const newScript: ArenaScript = {
    ...script,
    id: Math.random().toString(36).substring(7),
    likes: 0,
  };
  scripts.push(newScript);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  return newScript;
}

export function likeScript(id: string) {
  const scripts = getArenaScripts();
  const script = scripts.find(s => s.id === id);
  if (script) {
    script.likes += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  }
}
