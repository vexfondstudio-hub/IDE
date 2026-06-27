import React, { useState, useEffect, useRef, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { langs } from "@uiw/codemirror-extensions-langs";
import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import MonacoEditor from "@monaco-editor/react";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-csharp";
import "ace-builds/src-noconflict/mode-rust";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/theme-twilight";
import SimpleEditor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-lua";
import "prismjs/components/prism-markup";
import "prismjs/themes/prism-tomorrow.css";
import { CodeJarEditor } from "./CodeJarEditor";
import { FileExplorer, Snippet } from "./FileExplorer";
import { Play, DownloadSimple as Download, UploadSimple as Upload, ShareNetwork as Share2, Cloud, Sparkle as Sparkles, CaretDown as ChevronDown, List as Menu } from "@phosphor-icons/react";
import { executeCode } from "../lib/piston";
import { executeInSandbox } from "../lib/sandbox";
import { uploadToDrive, sendEmail } from "../lib/googleApi";
import { saveArenaScript } from "../lib/arenaStore";
import { googleSignIn, initAuth } from "../lib/auth";
import { User } from "firebase/auth";

const LANGUAGES = [
  { id: "javascript", name: "JavaScript", pistonVersion: "18.15.0" },
  { id: "python", name: "Python", pistonVersion: "3.10.0" },
  { id: "cpp", name: "C++", pistonVersion: "10.2.0" },
  { id: "java", name: "Java", pistonVersion: "15.0.2" },
  { id: "csharp", name: "C#", pistonVersion: "6.12.0" },
  { id: "rust", name: "Rust", pistonVersion: "1.68.2" },
  { id: "lua", name: "Lua", pistonVersion: "5.4.4" },
  { id: "html", name: "HTML/CSS", pistonVersion: "" },
];

const DEFAULT_SNIPPETS: Record<string, string> = {
  javascript: 'console.log("Hello, World!");',
  python: 'print("Hello, World!")',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  java: 'class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}',
  rust: 'fn main() {\n    println!("Hello, World!");\n}',
  lua: 'print("Hello, World!")',
  html: "<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { font-family: system-ui; color: white; background: #1e1e1e; padding: 20px; }\n  </style>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>",
};

export const EditorView = React.memo(() => {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [editorEngine, setEditorEngine] = useState<"codemirror" | "monaco" | "ace" | "simple" | "codejar">("codemirror");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [code, setCode] = useState(DEFAULT_SNIPPETS["javascript"]);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [aiHint, setAiHint] = useState<{title: string; description: string; suggestion: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSnippetId, setCurrentSnippetId] = useState<string | null>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const engineMenuRef = useRef<HTMLDivElement>(null);
  const currentLangRef = useRef(language.id);

  useEffect(() => { currentLangRef.current = language.id; }, [language.id]);
  useEffect(() => {
    const unsubscribe = initAuth((u) => setUser(u), () => setUser(null));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setIsLangMenuOpen(false);
      if (engineMenuRef.current && !engineMenuRef.current.contains(event.target as Node)) setIsEngineMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAnalyze = async (errorOutput?: string) => {
    setIsAnalyzing(true);
    setAiHint(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: language.name, error: errorOutput }),
      });
      if (response.ok) {
        const data = await response.json();
        setAiHint(data);
      }
    } catch (e) {
      console.error("Failed to get AI hint", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutput("Running...");
    setAiHint(null);
    try {
      let finalOutput = "";
      if (language.id === "html") {
        finalOutput = "__HTML_PREVIEW__";
      } else if (language.id === "javascript") {
        try {
          const result = await executeInSandbox(code);
          finalOutput = result;
        } catch (err: any) {
          finalOutput = `Error: ${err.message}`;
        }
      } else {
        const result = await executeCode(language.id, language.pistonVersion, code);
        finalOutput = result.run?.output || result.compile?.output || "No output";
      }
      setOutput(finalOutput);

      if (finalOutput.toLowerCase().includes("error") || finalOutput.toLowerCase().includes("exception")) {
        handleAnalyze(finalOutput);
      }
    } catch (error: any) {
      setOutput(`Failed to execute: ${error.message}`);
      handleAnalyze(error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDriveSave = async () => {
    if (!user) return alert("Please sign in first");
    if (!window.confirm("Save this script to your Google Drive?")) return;
    try {
      await uploadToDrive(`joker_script_${language.id}.txt`, code);
      alert("Saved to Google Drive successfully!");
    } catch (e: any) {
      alert(`Error saving to Drive: ${e.message}`);
    }
  };

  const handleEmailShare = async () => {
    if (!user) return alert("Please sign in first");
    if (!window.confirm(`Send this script to ${shareEmail}?`)) return;
    try {
      await sendEmail(shareEmail, `Joker Script: ${language.name}`, code);
      alert("Email sent successfully!");
      setShowShareModal(false);
    } catch (e: any) {
      alert(`Error sending email: ${e.message}`);
    }
  };

  const handlePublish = async () => {
    const title = prompt("Enter a title for your script:");
    if (title) {
      await saveArenaScript({
        title, language: language.id, version: language.pistonVersion, code, author: user?.displayName || "Anonymous"
      });
      alert("Published to Arena!");
    }
  };

  const handleLocalDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `script.${language.id === "javascript" ? "js" : language.id === "python" ? "py" : language.id === "cpp" ? "cpp" : language.id === "csharp" ? "cs" : language.id === "rust" ? "rs" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setCode(event.target?.result as string);
    reader.readAsText(file);
    e.target.value = "";
  };

  const getLanguageExtension = (langId: string) => {
    switch (langId) {
      case "javascript": return langs.js();
      case "python": return langs.python();
      case "cpp": return langs.cpp();
      case "java": return langs.java();
      case "csharp": return langs.cs();
      case "rust": return langs.rs();
      case "lua": return langs.lua();
      case "html": return langs.html();
      default: return langs.js();
    }
  };

  const handleSelectSnippet = (snippet: Snippet) => {
    setCurrentSnippetId(snippet.id);
    setCode(snippet.code);
    setLanguage(LANGUAGES.find((l) => l.id === snippet.languageId) || LANGUAGES[0]);
  };

  const handleNewSnippet = () => {
    setCurrentSnippetId(null);
    setCode(DEFAULT_SNIPPETS["javascript"]);
    setLanguage(LANGUAGES[0]);
  };

  const aiAutocomplete = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const word = context.matchBefore(/[\w.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    if (!context.explicit && word.text.length < 2) return null;

    const codeBefore = context.state.doc.sliceString(0, context.pos);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (context.aborted) return null;

      const controller = new AbortController();
      context.addEventListener("abort", () => controller.abort());

      const response = await fetch("/api/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeBefore, language: currentLangRef.current, word: word.text }),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.suggestions && Array.isArray(data.suggestions)) {
        return {
          from: word.from,
          options: data.suggestions.map((s: string) => ({
            label: s, type: "keyword", apply: s, detail: "AI Suggestion",
          })),
        };
      }
    } catch (e) {}
    return null;
  };

  const extensions = useMemo(() => [getLanguageExtension(language.id), autocompletion({ override: [aiAutocomplete] })], [language.id]);

  return (
    <div className="flex h-full bg-[#1e1e1e] text-slate-300">
      <FileExplorer
        currentSnippetId={currentSnippetId}
        onSelectSnippet={handleSelectSnippet}
        onSaveCurrentSnippet={() => {}}
        onNewSnippet={handleNewSnippet}
        currentCode={code}
        currentLanguageId={language.id}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 bg-[#252526] border-b border-[#333333] gap-2 sm:gap-0 z-20">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-start">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden hover:bg-white/10 p-1.5 rounded transition-colors text-slate-400 hover:text-white">
              <Menu size={16} />
            </button>
            <div className="relative" ref={langMenuRef}>
              <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="flex items-center justify-between gap-2 bg-[#3c3c3c] hover:bg-[#4d4d4d] text-[#cccccc] px-3 py-1 rounded-sm text-xs font-medium outline-none transition-colors w-32">
                {language.name} <ChevronDown size={14} className={`transition-transform duration-200 ${isLangMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {isLangMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#252526] border border-[#454545] rounded-sm shadow-xl overflow-hidden py-1 z-50">
                  {LANGUAGES.map((lang) => (
                    <button key={lang.id} onClick={() => { setLanguage(lang); setCode(DEFAULT_SNIPPETS[lang.id] || ""); setIsLangMenuOpen(false); }} className={`w-full text-left px-4 py-1.5 text-xs font-medium transition-colors ${language.id === lang.id ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#2a2d2e]"}`}>
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={engineMenuRef}>
              <button onClick={() => setIsEngineMenuOpen(!isEngineMenuOpen)} className="flex items-center justify-between gap-2 bg-[#3c3c3c] hover:bg-[#4d4d4d] text-[#cccccc] px-3 py-1 rounded-sm text-xs font-medium outline-none transition-colors w-32">
                {editorEngine === "codemirror" ? "CodeMirror 6" : editorEngine === "monaco" ? "Monaco" : editorEngine === "ace" ? "Ace Editor" : editorEngine === "codejar" ? "CodeJar" : "Prism + Textarea"}
                <ChevronDown size={14} className={`transition-transform duration-200 ${isEngineMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {isEngineMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#252526] border border-[#454545] rounded-sm shadow-xl overflow-hidden py-1 z-50">
                  {(["codemirror", "monaco", "ace", "simple", "codejar"] as const).map((engine) => (
                    <button key={engine} onClick={() => { setEditorEngine(engine); setIsEngineMenuOpen(false); }} className={`w-full text-left px-4 py-1.5 text-xs font-medium transition-colors ${editorEngine === engine ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#2a2d2e]"}`}>
                      {engine === "codemirror" ? "CodeMirror 6" : engine === "monaco" ? "Monaco" : engine === "ace" ? "Ace Editor" : engine === "codejar" ? "CodeJar" : "Prism + Textarea"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleRun} disabled={isRunning} className="bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white text-xs px-3 py-1 rounded-sm flex items-center gap-1 transition-all">
              <Play size={14} /> {isRunning ? "Running..." : "Run"}
            </button>
            <button onClick={() => handleAnalyze()} disabled={isAnalyzing} className="bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white text-xs px-3 py-1 rounded-sm flex items-center gap-1 transition-all">
              <Sparkles size={14} /> {isAnalyzing ? "Analyzing..." : "AI Suggestion"}
            </button>
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            <label className="flex items-center gap-1 hover:bg-[#4d4d4d] px-2 py-1 rounded-sm transition-colors text-xs text-[#cccccc] cursor-pointer shrink-0" title="Open File">
              <Upload size={14} /> Open <input type="file" className="hidden" onChange={handleLocalUpload} accept=".js,.py,.cpp,.cs,.java,.rs,.txt" />
            </label>
            <button onClick={handleLocalDownload} className="flex items-center gap-1 hover:bg-[#4d4d4d] px-2 py-1 rounded-sm transition-colors text-xs text-[#cccccc] shrink-0" title="Save File Locally">
              <Download size={14} /> Save
            </button>
            <button onClick={handlePublish} className="flex items-center gap-1 hover:bg-[#4d4d4d] px-2 py-1 rounded-sm transition-colors text-xs text-[#cccccc] shrink-0">
              <Share2 size={14} /> Publish
            </button>
            <div className="w-px h-4 bg-[#454545] mx-2 shrink-0"></div>
            {user ? (
              <>
                <button onClick={handleDriveSave} className="flex items-center gap-1 hover:bg-[#4d4d4d] px-2 py-1 rounded-sm transition-colors text-xs text-[#cccccc] shrink-0" title="Save to Google Drive">
                  <Cloud size={14} /> Drive
                </button>
                <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1 hover:bg-[#4d4d4d] px-2 py-1 rounded-sm transition-colors text-xs text-[#cccccc] shrink-0">
                  <Share2 size={14} /> Email
                </button>
              </>
            ) : (
              <button onClick={() => googleSignIn()} className="flex items-center gap-1 hover:bg-[#4d4d4d] px-2 py-1 rounded-sm transition-colors text-xs text-[#3794ff] shrink-0">
                Sign in
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <div className="flex-1 border-b md:border-b-0 md:border-r border-[#333333] min-h-[50vh] md:min-h-0 relative">
            {editorEngine === "codemirror" && (
              <CodeMirror value={code} height="100%" theme={vscodeDark} extensions={extensions} onChange={(val) => setCode(val)} className="absolute inset-0 text-base" style={{ fontFamily: '"JetBrains Mono", monospace' }} />
            )}
            {editorEngine === "monaco" && (
              <MonacoEditor height="100%" language={language.id === "cpp" ? "cpp" : language.id} theme="vs-dark" value={code} onChange={(val) => setCode(val || "")} options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: '"JetBrains Mono", monospace', padding: { top: 16 } }} />
            )}
            {editorEngine === "ace" && (
              <AceEditor mode={language.id === "cpp" ? "c_cpp" : language.id === "html" ? "html" : language.id} theme="twilight" onChange={(val) => setCode(val)} value={code} name="ace_editor" editorProps={{ $blockScrolling: true }} width="100%" height="100%" setOptions={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, showPrintMargin: false, useWorker: false }} />
            )}
            {editorEngine === "simple" && (
              <div className="absolute inset-0 overflow-auto bg-[#1e1e1e]">
                <SimpleEditor value={code} onValueChange={(code) => setCode(code)} highlight={(code) => { const lang = language.id === "cpp" ? "cpp" : language.id === "html" ? "markup" : language.id; const grammar = Prism.languages[lang] || Prism.languages.javascript; return Prism.highlight(code, grammar, lang); }} padding={16} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, minHeight: "100%" }} textareaClassName="focus:outline-none" />
              </div>
            )}
            {editorEngine === "codejar" && (
              <CodeJarEditor value={code} onChange={(val) => setCode(val)} language={language.id} />
            )}

            {aiHint && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#252526] rounded border border-[#454545] p-4 w-[90%] sm:w-[400px] shadow-2xl z-40 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Sparkles size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wider">{aiHint.title}</span>
                  </div>
                  <button onClick={() => setAiHint(null)} className="text-slate-500 hover:text-white transition-colors w-5 h-5 flex items-center justify-center rounded hover:bg-white/10">&times;</button>
                </div>
                <p className="text-xs text-slate-300 mb-3">{aiHint.description}</p>
                {aiHint.suggestion && (
                  <div className="bg-[#1e1e1e] p-2 rounded border border-[#333333] mb-3 overflow-x-auto">
                    <pre className="text-[11px] font-mono text-[#d4d4d4] whitespace-pre-wrap">{aiHint.suggestion}</pre>
                  </div>
                )}
                <div className="flex gap-2">
                  {aiHint.suggestion && (
                    <button onClick={() => { if (aiHint.suggestion) { setCode(aiHint.suggestion); setAiHint(null); } }} className="flex-1 bg-[#0e639c] hover:bg-[#1177bb] text-white text-[11px] px-2 py-1.5 rounded-sm transition-colors font-medium text-center">Apply Fix</button>
                  )}
                  <button onClick={() => setAiHint(null)} className="flex-1 bg-[#3c3c3c] hover:bg-[#4d4d4d] text-[#cccccc] text-[11px] px-2 py-1.5 rounded-sm transition-colors text-center">Dismiss</button>
                </div>
              </div>
            )}
          </div>

          <div className="w-full h-64 md:h-full md:w-[400px] flex flex-col bg-[#1e1e1e] shrink-0 z-10 border-t md:border-t-0 md:border-l border-[#333333]">
            <div className="px-3 py-2 border-b border-[#333333] text-[11px] font-medium text-[#cccccc] flex justify-between items-center bg-[#252526]">
              OUTPUT
              <button onClick={() => setOutput("")} className="text-[#cccccc] hover:text-white transition-colors hover:bg-[#4d4d4d] px-2 py-0.5 rounded-sm">Clear</button>
            </div>
            <div className="flex-1 p-3 font-mono text-[12px] text-[#cccccc] whitespace-pre-wrap overflow-y-auto">
              {output === "__HTML_PREVIEW__" ? (
                <iframe title="Preview" className="w-full h-full bg-white rounded-sm" srcDoc={code} sandbox="allow-scripts" />
              ) : (
                output || <span className="text-[#808080] italic">Run output will appear here.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] p-5 rounded-sm border border-[#454545] shadow-2xl w-96">
            <h3 className="text-sm font-semibold text-[#cccccc] mb-4">Share via Email</h3>
            <input type="email" placeholder="Recipient email address" className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded-sm px-3 py-2 mb-4 outline-none focus:border-[#007fd4] text-sm text-[#cccccc]" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowShareModal(false)} className="px-3 py-1.5 text-xs font-medium text-[#cccccc] hover:bg-[#4d4d4d] rounded-sm transition-colors">Cancel</button>
              <button onClick={handleEmailShare} className="px-3 py-1.5 text-xs font-medium bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-sm transition-colors">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
