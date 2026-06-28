import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  FileText,
  Trash2,
  Plus,
  Pencil as Edit2,
  X,
  Check,
} from "lucide-react";

export interface Snippet {
  id: string;
  name: string;
  languageId: string;
  code: string;
  updatedAt: number;
  isBinary?: boolean;
  binaryData?: Uint8Array;
}

interface FileExplorerProps {
  currentSnippetId: string | null;
  onSelectSnippet: (snippet: Snippet) => void;
  onSaveCurrentSnippet: () => void;
  onNewSnippet: () => void;
  currentCode: string;
  currentLanguageId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FileExplorer({
  currentSnippetId,
  onSelectSnippet,
  onSaveCurrentSnippet,
  onNewSnippet,
  currentCode,
  currentLanguageId,
  isOpen,
  onClose,
}: FileExplorerProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    loadSnippets();
  }, []);

  const loadSnippets = () => {
    try {
      const stored = localStorage.getItem("joker_snippets");
      if (stored) {
        setSnippets(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load snippets", e);
    }
  };

  const saveSnippets = (newSnippets: Snippet[]) => {
    try {
      localStorage.setItem("joker_snippets", JSON.stringify(newSnippets));
      setSnippets(newSnippets);
    } catch (e) {
      console.error("Failed to save snippets", e);
    }
  };

  const handleSaveCurrent = () => {
    if (currentSnippetId) {
      const newSnippets = snippets.map((s) =>
        s.id === currentSnippetId
          ? {
              ...s,
              code: currentCode,
              languageId: currentLanguageId,
              updatedAt: Date.now(),
            }
          : s,
      );
      saveSnippets(newSnippets);
    } else {
      const newSnippet: Snippet = {
        id: crypto.randomUUID(),
        name: `Untitled Snippet ${snippets.length + 1}`,
        languageId: currentLanguageId,
        code: currentCode,
        updatedAt: Date.now(),
      };
      saveSnippets([newSnippet, ...snippets]);
      onSelectSnippet(newSnippet);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this snippet?")) {
      const newSnippets = snippets.filter((s) => s.id !== id);
      saveSnippets(newSnippets);
      if (currentSnippetId === id) {
        onNewSnippet();
      }
    }
  };

  const startRename = (snippet: Snippet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(snippet.id);
    setEditName(snippet.name);
  };

  const finishRename = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSnippets = snippets.map((s) =>
      s.id === id ? { ...s, name: editName.trim() || "Untitled" } : s,
    );
    saveSnippets(newSnippets);
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={`
        fixed md:relative top-0 left-0 h-full w-64 bg-[#0B0C10] border-r border-white/5 flex flex-col shrink-0 z-50 transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="p-3 border-b border-white/5 flex items-center justify-between text-slate-300 font-semibold text-xs tracking-wider uppercase bg-[#101218]">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-purple-400" />
            <span>Snippets</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewSnippet}
              className="hover:bg-white/10 p-1 rounded transition-colors text-slate-400 hover:text-white"
              title="New Snippet"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onClose}
              className="md:hidden hover:bg-white/10 p-1 rounded transition-colors text-slate-400 hover:text-white"
              title="Close Snippets"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-2 border-b border-white/5 bg-[#101218]">
          <button
            onClick={handleSaveCurrent}
            className="w-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-xs px-3 py-1.5 rounded transition-colors font-medium flex items-center justify-center gap-2"
          >
            Save Current Snippet
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
          {snippets.length === 0 ? (
            <div className="text-xs text-slate-500 text-center p-4 italic">
              No saved snippets yet.
            </div>
          ) : (
            snippets
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((snippet) => (
                <div
                  key={snippet.id}
                  onClick={() => onSelectSnippet(snippet)}
                  className={`group flex items-center justify-between p-2 rounded cursor-pointer text-sm transition-colors ${
                    currentSnippetId === snippet.id
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <FileText size={14} className="shrink-0 opacity-70" />
                    {editingId === snippet.id ? (
                      <div
                        className="flex items-center gap-1 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          autoFocus
                          className="bg-black/50 border border-purple-500/50 rounded px-1 text-xs w-full outline-none text-white"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") finishRename(snippet.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={(e) => finishRename(snippet.id, e)}
                          className="text-green-400 hover:text-green-300"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="text-slate-400 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="truncate text-xs font-medium">
                        {snippet.name}
                      </span>
                    )}
                  </div>

                  {editingId !== snippet.id && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 shrink-0">
                      <span className="text-[10px] text-slate-500 px-1 bg-black/30 rounded mr-1">
                        {snippet.languageId}
                      </span>
                      <button
                        onClick={(e) => startRename(snippet, e)}
                        className="text-slate-500 hover:text-blue-400 p-0.5 rounded transition-colors"
                        title="Rename"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(snippet.id, e)}
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </>
  );
}
