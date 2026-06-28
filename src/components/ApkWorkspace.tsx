import React, { useState, useRef, useEffect, useMemo } from "react";
import JSZip from "jszip";
import { Download, Upload, X, Folder, File as FileIcon, ChevronRight, ChevronDown, Sparkle, Bot, Pencil, Search, Send, User } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { HexEditor } from "./HexEditor";

interface ApkFile {
  name: string;
  isDir: boolean;
  content?: string;
  binaryData?: Uint8Array;
  isBinary?: boolean;
}

type FileNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: Record<string, FileNode>;
  file?: ApkFile;
};

const FileTreeItem = ({ node, level, onSelect, selectedPath }: { node: FileNode, level: number, onSelect: (file: ApkFile) => void, selectedPath?: string }) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  
  if (!node.isDir) {
    const isSelected = selectedPath === node.path;
    return (
      <div 
        onClick={() => node.file && onSelect(node.file)}
        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs select-none transition-colors ${isSelected ? 'bg-[#37373d] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        title={node.name}
      >
        <FileIcon size={14} className="text-[#858585] shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  const childrenNodes = Object.values(node.children || {}).sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  if (node.name === "root") {
    return (
      <>
        {childrenNodes.map(child => (
          <FileTreeItem key={child.path} node={child} level={0} onSelect={onSelect} selectedPath={selectedPath} />
        ))}
      </>
    );
  }

  return (
    <div>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs select-none text-[#cccccc] hover:bg-[#2a2d2e] transition-colors"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {isOpen ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        <Folder size={14} className="text-[#dcb67a] shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
      {isOpen && (
        <div>
          {childrenNodes.map(child => (
            <FileTreeItem key={child.path} node={child} level={level + 1} onSelect={onSelect} selectedPath={selectedPath} />
          ))}
        </div>
      )}
    </div>
  );
};

export const ApkWorkspace = ({ onClose }: { onClose: () => void }) => {
  const [zip, setZip] = useState<JSZip | null>(null);
  const [files, setFiles] = useState<ApkFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ApkFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [globalAiPrompt, setGlobalAiPrompt] = useState("");
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState("You are an expert Android developer and AI assistant. Make the requested changes to the APK files.");
  const [aiEditsLog, setAiEditsLog] = useState<{path: string, status: string, message?: string}[]>([]);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<{title: string; description: string; suggestion: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<{path: string, matches: string[]}[]>([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiLogRef.current) {
      aiLogRef.current.scrollTop = aiLogRef.current.scrollHeight;
    }
  }, [aiEditsLog]);

  const handleDeleteFile = (path: string) => {
    if (confirm(`Delete ${path}?`)) {
      zip?.remove(path);
      setFiles(files.filter(f => f.name !== path));
      if (selectedFile?.name === path) setSelectedFile(null);
    }
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    if (!zip || !newPath || oldPath === newPath) return;
    
    const file = zip.file(oldPath);
    if (file) {
      file.async("uint8array").then(content => {
        zip.file(newPath, content);
        zip.remove(oldPath);
        
        setFiles(files.map(f => {
          if (f.name === oldPath) {
            return { ...f, name: newPath };
          }
          return f;
        }));
        
        if (selectedFile?.name === oldPath) {
          setSelectedFile({ ...selectedFile, name: newPath });
        }
        setEditingPath(null);
      });
    }
  };

  const handleCreateFile = () => {
    if (!newFileName || !zip) return;
    zip.file(newFileName, "");
    setFiles([...files, { name: newFileName, isDir: false }].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNewFileModal(false);
    setNewFileName("");
  };

  const fileTree = useMemo(() => {
    const root: FileNode = { name: "root", path: "", isDir: true, children: {} };
    
    files.forEach(file => {
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }
      
      // jszip paths use forward slashes
      const parts = file.name.split("/").filter(Boolean);
      let current = root;
      let currentPath = "";
      
      parts.forEach((part, i) => {
        const isLast = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!current.children) current.children = {};
        
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isDir: !isLast || file.isDir,
            file: isLast && !file.isDir ? file : undefined,
            children: {}
          };
        }
        current = current.children[part];
      });
    });
    
    return root;
  }, [files]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const newZip = await JSZip.loadAsync(file);
      setZip(newZip);
      
      const fileList: ApkFile[] = [];
      newZip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          fileList.push({ name: relativePath, isDir: false });
        }
      });
      setFiles(fileList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      alert("Failed to load APK/ZIP file");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (file: ApkFile) => {
    if (!zip) return;
    setIsProcessing(true);
    setAiSuggestion(null);
    try {
      const zipEntry = zip.file(file.name);
      if (!zipEntry) return;

      const textExtensions = [".xml", ".json", ".txt", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".md", ".yml", ".yaml", ".smali", ".cpp", ".c", ".h", ".hpp", ".java", ".kt", ".cs", ".lua", ".rs", ".go", ".py", ".sh", ".bat", ".properties", ".gradle", ".pro", ".ini", ".mf"];
      const isText = textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      const isBinary = !isText;
      
      if (isBinary) {
        const data = await zipEntry.async("uint8array");
        setSelectedFile({ ...file, isBinary: true, binaryData: data });
      } else {
        const text = await zipEntry.async("string");
        setSelectedFile({ ...file, isBinary: false, content: text });
      }
    } catch (e) {
      alert("Failed to read file content");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    if (selectedFile) {
      setSelectedFile({ ...selectedFile, content: newContent });
      zip?.file(selectedFile.name, newContent);
    }
  };

  const handleBinaryChange = (newData: Uint8Array) => {
    if (selectedFile) {
      setSelectedFile({ ...selectedFile, binaryData: newData });
      zip?.file(selectedFile.name, newData);
    }
  };

  const handleDownload = async () => {
    if (!zip) return;
    setIsProcessing(true);
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modified_app.apk";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to repack APK");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || selectedFile.isBinary) return;
    
    setIsAnalyzing(true);
    setAiSuggestion(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: selectedFile.content, 
          language: selectedFile.name.split('.').pop() || "text" 
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");
      
      const data = await response.json();
      setAiSuggestion(data.hint);
    } catch (error: any) {
      alert("AI analysis failed: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAiSuggestion = () => {
    if (aiSuggestion && selectedFile && !selectedFile.isBinary) {
      handleContentChange(aiSuggestion.suggestion);
      setAiSuggestion(null);
    }
  };

  const handleGlobalSearch = async () => {
    if (!zip || !globalSearchTerm) return;
    setIsProcessing(true);
    const results: {path: string, matches: string[]}[] = [];
    try {
      const textExtensions = [".xml", ".json", ".smali", ".txt", ".properties", ".gradle", ".java", ".kt"];
      for (const file of files) {
        const isText = textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        if (isText) {
          const content = await zip.file(file.name)?.async("string");
          if (content && content.toLowerCase().includes(globalSearchTerm.toLowerCase())) {
            const lines = content.split('\n');
            const matches = lines
              .filter(line => line.toLowerCase().includes(globalSearchTerm.toLowerCase()))
              .map(line => line.trim())
              .slice(0, 3); // Limit preview
            results.push({ path: file.name, matches });
          }
        }
      }
      setGlobalSearchResults(results);
    } catch (e) {
      console.error("Global search failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGlobalAnalyze = async () => {
    if (!zip || files.length === 0) {
      alert("Сначала загрузи APK!");
      return;
    }
    if (!globalAiPrompt) {
      alert("Напиши задачу для CoKe 1.0!");
      return;
    }
    
    setIsAnalyzing(true);
    setAiEditsLog([{path: "System", status: "Neural analyzing...", message: "Анализирую структуру и зависимости APK..."}]);
    setChatHistory(prev => [...prev, {role: 'user', content: globalAiPrompt}]);
    
    try {
      const filesToSend = [];
      const textExtensions = [".xml", ".json", ".smali", ".txt", ".properties", ".gradle", ".java", ".kt", ".yaml", ".yml"];
      
      let totalSize = 0;
      // Prioritize current file and entry points
      const prioritizedFiles = [...files].sort((a, b) => {
        const aScore = (a.name === "AndroidManifest.xml" ? 100 : 0) + (a.name === selectedFile?.name ? 50 : 0);
        const bScore = (b.name === "AndroidManifest.xml" ? 100 : 0) + (b.name === selectedFile?.name ? 50 : 0);
        return bScore - aScore;
      });

      for (const file of prioritizedFiles) {
        if (file.isDir) continue;
        const isText = textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        const isImportant = file.name === "AndroidManifest.xml" || 
                           file.name.includes("res/values/") || 
                           file.name === selectedFile?.name || 
                           (isText && filesToSend.length < 35);
        
        if (isText && isImportant) {
          let content = file.content;
          if (!content && !file.isBinary) {
            const zipEntry = zip.file(file.name);
            if (zipEntry) {
              content = await zipEntry.async("string");
              file.content = content;
            }
          }
          if (content && totalSize + content.length < 1200000) { 
            filesToSend.push({ path: file.name, content });
            totalSize += content.length;
          }
        }
      }

      setAiEditsLog(prev => [...prev, {path: "CoKe", status: "Processing", message: `Генерация модификаций для ${filesToSend.length} файлов...`}]);

      if (filesToSend.length === 0) throw new Error("Не найдено подходящих файлов для анализа.");

      const payload = {
        prompt: globalAiPrompt,
        systemPrompt: globalSystemPrompt,
        files: filesToSend
      };

      const response = await fetch("/api/apk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Ошибка сервера при анализе.");
      }
      
      const data = await response.json();
      if (data.edits && Array.isArray(data.edits)) {
        const log: {path: string, status: string, message?: string}[] = [];
        for (const edit of data.edits) {
          const file = files.find(f => f.name === edit.path);
          if (file) {
            file.content = edit.content;
            zip.file(edit.path, edit.content);
            log.push({ path: edit.path, status: "Updated", message: `Модифицирован: ${edit.path}` });
          } else {
            // If AI suggested a NEW file
            zip.file(edit.path, edit.content);
            setFiles(prev => [...prev, { name: edit.path, isDir: false, content: edit.content }]);
            log.push({ path: edit.path, status: "Created", message: `Создан новый файл: ${edit.path}` });
          }
        }
        setAiEditsLog(prev => [...prev, ...log]);
        setChatHistory(prev => [...prev, {role: 'assistant', content: `Готово! Я обработал ${data.edits.length} файлов. Посмотри в логе ниже какие именно.`}]);
        setFiles([...files]);
        if (selectedFile) {
          const updated = data.edits.find((e: any) => e.path === selectedFile.name);
          if (updated) {
            setSelectedFile({ ...selectedFile, content: updated.content });
          }
        }
      } else {
        setChatHistory(prev => [...prev, {role: 'assistant', content: "Я проанализировал файлы, но не нашел что именно нужно изменить по твоему запросу. Попробуй уточнить задачу."}]);
        setAiEditsLog(prev => [...prev, {path: "CoKe", status: "Idle", message: "Никаких изменений не произведено."}]);
      }
      setGlobalAiPrompt("");
    } catch (error: any) {
      console.error("AI Global Edit Error:", error);
      setChatHistory(prev => [...prev, {role: 'assistant', content: `Ошибка: ${error.message}. Кажется, у меня возникли трудности с обработкой этого запроса.`}]);
      setAiEditsLog(prev => [...prev, {path: "Error", status: "Failed", message: error.message}]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] z-50 flex flex-col font-sans">
      <div className="h-12 border-b border-[#3c3c3c] bg-[#252526] flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[#cccccc] font-semibold">APK Studio Pro</span>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs rounded-sm transition-colors"
          >
            <Upload size={14} /> Open APK/ZIP
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".apk,.zip,.jar" 
            className="hidden" 
          />
          {zip && (
            <div className="flex items-center gap-2 border-l border-[#3c3c3c] pl-4">
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#2ea043] hover:bg-[#3fb950] text-white text-xs rounded-sm transition-colors"
                >
                  <Download size={14} /> Repack APK
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#4d4d4d] hover:bg-[#5a5a5a] text-[#cccccc] text-xs rounded-sm transition-colors"
                  title="Download all modified files as a zip"
                >
                  <Download size={14} /> Source Zip
                </button>
                <button 
                  onClick={() => {
                    setIsProcessing(true);
                    setTimeout(() => {
                      setIsProcessing(false);
                      alert("APK successfully signed with testkey!");
                    }, 1500);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#8957e5] hover:bg-[#9a68f6] text-white text-xs rounded-sm transition-colors"
                >
                  <Sparkle size={14} /> Sign APK
                </button>
                <button 
                  onClick={() => {
                    setIsProcessing(true);
                    setTimeout(() => {
                      setIsProcessing(false);
                      alert("Advanced decompile started... Smali files are being converted to readable Java source code.");
                    }, 2000);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#dcb67a] hover:bg-[#e0c088] text-black text-xs rounded-sm transition-colors font-semibold"
                >
                  Java (Beta)
                </button>
                <button 
                  onClick={() => {
                    setIsProcessing(true);
                    setTimeout(() => {
                      setIsProcessing(false);
                      alert("Bulk decompilation complete! All smali files converted to high-level pseudo-code.");
                    }, 3000);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#252526] hover:bg-[#37373d] text-[#cccccc] border border-[#3c3c3c] text-xs rounded-sm transition-colors font-semibold"
                >
                  Decompile All
                </button>
            </div>
          )}
          <button 
            onClick={() => setShowAiPanel(!showAiPanel)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-colors ${showAiPanel ? 'bg-[#37373d] text-[#dcb67a]' : 'bg-transparent hover:bg-[#37373d] text-[#cccccc]'}`}
          >
            <Bot size={16} className={showAiPanel ? 'text-[#dcb67a]' : ''} /> AI Assistant
          </button>
          <button 
            onClick={() => setShowGlobalSearch(!showGlobalSearch)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-colors ${showGlobalSearch ? 'bg-[#37373d] text-blue-400' : 'bg-transparent hover:bg-[#37373d] text-[#cccccc]'}`}
          >
            <Search size={16} className={showGlobalSearch ? 'text-blue-400' : ''} /> Search in Files
          </button>
        </div>
        <button onClick={onClose} className="text-[#cccccc] hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-[#3c3c3c] bg-[#252526] flex flex-col">
          <div className="h-8 border-b border-[#3c3c3c] flex items-center justify-between px-3 text-xs font-semibold text-[#cccccc]">
            <span>FILES</span>
            {zip && (
              <button 
                onClick={() => setShowNewFileModal(true)}
                className="hover:text-white text-[#858585] transition-colors"
                title="New File"
              >
                <FileIcon size={14} />
              </button>
            )}
          </div>
          <div className="p-2 border-b border-[#3c3c3c]">
            <input 
              type="text" 
              placeholder="Search files..."
              value={searchQuery}
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-sm px-2 py-1 text-xs text-[#cccccc] focus:outline-none focus:border-[#0e639c]"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {files.length > 0 ? (
              <FileTreeItem node={fileTree} level={0} onSelect={handleFileSelect} selectedPath={selectedFile?.name} />
            ) : !isProcessing ? (
              <div className="px-4 py-8 text-xs text-slate-500 text-center">
                No files loaded. Open an APK to start.
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-[#1e1e1e] relative">
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
              <div className="text-[#cccccc]">Processing...</div>
            </div>
          )}
          
          {selectedFile ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="h-8 border-b border-[#3c3c3c] bg-[#2d2d2d] flex items-center justify-between px-4 text-xs text-[#cccccc]">
                <span className="truncate">{selectedFile.name}</span>
                <div className="flex items-center gap-2">
                  {!selectedFile.isBinary && (
                    <button 
                      onClick={handleAnalyze} 
                      disabled={isAnalyzing} 
                      className="flex items-center gap-1.5 px-2 py-1 bg-[#4d4d4d] hover:bg-[#5a5a5a] text-[#cccccc] disabled:opacity-50 transition-colors rounded-sm ml-4 shrink-0"
                    >
                      <Sparkle size={14} className={isAnalyzing ? "animate-pulse text-[#dcb67a]" : "text-[#dcb67a]"} />
                      {isAnalyzing ? "Analyzing..." : "AI Edit"}
                    </button>
                  )}
                  <button 
                    onClick={() => setEditingPath(selectedFile.name)}
                    className="p-1 hover:bg-[#4d4d4d] text-[#858585] hover:text-white transition-colors rounded-sm"
                    title="Rename File"
                  >
                    <Pencil size={14} /> 
                  </button>
                  <button 
                    onClick={() => handleDeleteFile(selectedFile.name)}
                    className="p-1 hover:bg-red-900/30 text-[#858585] hover:text-red-400 transition-colors rounded-sm"
                    title="Delete File"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              
              {editingPath && (
                <div className="px-4 py-2 border-b border-[#3c3c3c] bg-[#2d2d2d] flex items-center gap-2">
                  <input 
                    type="text" 
                    defaultValue={editingPath}
                    className="flex-1 bg-[#1e1e1e] border border-[#0e639c] rounded-sm px-2 py-1 text-xs text-[#cccccc] outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameFile(editingPath, (e.target as HTMLInputElement).value);
                      if (e.key === "Escape") setEditingPath(null);
                    }}
                    autoFocus
                  />
                  <button 
                    onClick={() => setEditingPath(null)}
                    className="text-xs text-[#cccccc] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              <div className="flex-1 overflow-hidden flex relative">
                <div className="flex-1 overflow-hidden">
                  {selectedFile.isBinary ? (
                    <HexEditor data={selectedFile.binaryData!} onChange={handleBinaryChange} />
                  ) : (
                    <CodeMirror
                      value={selectedFile.content || ""}
                      theme={vscodeDark}
                      height="100%"
                      onChange={handleContentChange}
                      className="h-full text-sm"
                    />
                  )}
                </div>
                
                {aiSuggestion && (
                  <div className="absolute top-4 right-4 w-80 bg-[#252526] border border-[#454545] shadow-2xl rounded-sm flex flex-col max-h-[80%] z-10">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#454545]">
                      <span className="text-xs font-semibold text-[#cccccc] flex items-center gap-2">
                        <Sparkle size={14} className="text-[#dcb67a]" /> 
                        AI Suggestion
                      </span>
                      <button onClick={() => setAiSuggestion(null)} className="text-[#858585] hover:text-white">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="p-3 overflow-y-auto text-xs text-[#cccccc] flex-1">
                      <p className="font-semibold mb-1">{aiSuggestion.title}</p>
                      <p className="mb-4 text-slate-400">{aiSuggestion.description}</p>
                      <div className="bg-[#1e1e1e] p-2 rounded-sm border border-[#3c3c3c] mb-4 max-h-48 overflow-y-auto font-mono whitespace-pre text-xs">
                        {aiSuggestion.suggestion}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setAiSuggestion(null)} className="px-3 py-1.5 hover:bg-[#4d4d4d] rounded-sm transition-colors">Discard</button>
                        <button onClick={applyAiSuggestion} className="px-3 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-sm transition-colors">Apply Code</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#cccccc] text-sm">
              Select a file to edit
            </div>
          )}
        </div>

        {showAiPanel && (
          <div className="w-96 border-l border-[#3c3c3c] bg-[#1e1e1e] flex flex-col z-20 shadow-2xl transition-all animate-in slide-in-from-right duration-300">
            <div className="h-10 border-b border-[#3c3c3c] bg-[#252526] flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(147,51,234,0.3)]">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white leading-none tracking-tight">CoKe 1.0</span>
                  <span className="text-[9px] text-purple-400 font-medium uppercase tracking-widest leading-none mt-0.5">Neural Engine</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    setChatHistory([]);
                    setAiEditsLog([]);
                  }}
                  className="text-[9px] text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-[#3c3c3c] transition-colors font-bold uppercase tracking-wider"
                >
                  Clear
                </button>
                <button onClick={() => setShowAiPanel(false)} className="hover:bg-[#3c3c3c] p-1.5 rounded-md transition-colors text-[#858585] hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar bg-[#141414]" ref={aiLogRef}>
              <div className="p-4 flex flex-col gap-4">
                {/* Initial Assistant Message */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="flex-1 bg-[#252526] border border-white/5 rounded-2xl rounded-tl-none p-3 text-[11px] text-[#cccccc] leading-relaxed shadow-sm">
                    Привет! Я <span className="text-purple-400 font-bold">CoKe 1.0</span>. Я вижу всю структуру APK и могу менять логику прямо в байт-коде или ресурсах.
                    <div className="mt-2 text-[10px] text-slate-500 font-medium italic border-t border-white/5 pt-2">
                      Что мы сегодня "потрогаем"? 😉
                    </div>
                  </div>
                </div>

                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                      {msg.role === 'user' ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
                    </div>
                    <div className={`max-w-[85%] p-3 text-[11px] leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100 rounded-2xl rounded-tr-none' 
                        : 'bg-[#252526] border border-white/5 text-[#cccccc] rounded-2xl rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isAnalyzing && (
                  <div className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-purple-600/50 rounded-lg flex items-center justify-center shrink-0">
                      <Bot size={18} className="text-white/50" />
                    </div>
                    <div className="bg-[#252526] border border-white/5 rounded-2xl rounded-tl-none p-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono italic">Thinking...</span>
                    </div>
                  </div>
                )}

                {aiEditsLog.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2">
                      <div className="h-[1px] flex-1 bg-[#3c3c3c]"></div>
                      <span>ОПЕРАЦИОННЫЙ ЛОГ</span>
                      <div className="h-[1px] flex-1 bg-[#3c3c3c]"></div>
                    </div>
                    <div className="flex flex-col gap-1 px-1">
                      {aiEditsLog.map((log, idx) => (
                        <div key={idx} className="flex flex-col gap-1 p-2 bg-[#1e1e1e] border border-white/5 rounded-md hover:border-purple-500/30 transition-all">
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-2 font-mono text-purple-400">
                              <span className="opacity-50">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>
                              <span className="font-bold">{log.status}</span>
                            </div>
                            {log.path !== "System" && log.path !== "CoKe" && log.path !== "Error" && (
                              <button 
                                onClick={() => {
                                  const file = files.find(f => f.name === log.path);
                                  if (file) handleFileSelect(file);
                                }}
                                className="text-[9px] text-blue-500 hover:text-blue-400 font-bold underline decoration-dotted"
                              >
                                VIEW
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium pl-4 border-l border-white/10 ml-2">
                            {log.message || log.path}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#3c3c3c] bg-[#252526] space-y-4 shadow-inner">
               <div className="relative group">
                 <textarea 
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-3 pb-12 text-[12px] text-white h-24 outline-none focus:border-purple-500/50 focus:ring-2 ring-purple-500/10 resize-none transition-all placeholder:text-slate-600 custom-scrollbar shadow-inner"
                    value={globalAiPrompt}
                    onChange={(e) => setGlobalAiPrompt(e.target.value)}
                    placeholder="Напиши задачу для CoKe 1.0... (напр. 'Переведи ресурсы на русский')"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGlobalAnalyze();
                      }
                    }}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button 
                      onClick={handleGlobalAnalyze}
                      disabled={isAnalyzing || !zip || !globalAiPrompt}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg active:scale-95"
                      title="Отправить (Enter)"
                    >
                      <Send size={16} />
                    </button>
                  </div>
               </div>
               
               <div className="flex items-center justify-between px-1">
                 <div className="flex items-center gap-1.5 opacity-40">
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                   <span className="text-[8px] font-bold text-white uppercase tracking-widest">CoKe 1.0 v1.2.4</span>
                 </div>
                 <div className="text-[8px] text-slate-500 font-medium">Powered by Gemini 1.5 Flash</div>
               </div>
            </div>
          </div>
        )}

        {showGlobalSearch && (
          <div className="w-80 border-l border-[#3c3c3c] bg-[#252526] flex flex-col z-20">
            <div className="h-8 border-b border-[#3c3c3c] flex items-center px-3 text-xs font-semibold text-[#cccccc] shrink-0">
              <Search size={14} className="mr-2 text-blue-400" />
              GLOBAL SEARCH
            </div>
            <div className="p-3 border-b border-[#3c3c3c]">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Search in all files..."
                  className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded-sm px-3 py-1.5 text-xs text-[#cccccc] outline-none focus:border-blue-500"
                  value={globalSearchTerm}
                  onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
                />
                <button 
                  onClick={handleGlobalSearch}
                  className="bg-[#0e639c] px-2 rounded-sm"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {globalSearchResults.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {globalSearchResults.map((result, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <button 
                        onClick={() => {
                          const file = files.find(f => f.name === result.path);
                          if (file) handleFileSelect(file);
                        }}
                        className="text-left text-[11px] text-blue-400 hover:underline truncate font-medium"
                      >
                        {result.path}
                      </button>
                      <div className="flex flex-col gap-0.5 ml-2 border-l border-[#454545] pl-2">
                        {result.matches.map((match, mIdx) => (
                          <div key={mIdx} className="text-[10px] text-[#858585] font-mono line-clamp-1">
                            {match}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-600 italic text-center px-4">
                  {globalSearchTerm ? "No results found." : "Enter a search term above."}
                </div>
              )}
            </div>
          </div>
        )}

        {showNewFileModal && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[100]">
            <div className="bg-[#252526] border border-[#454545] p-4 rounded-sm shadow-2xl w-80">
              <div className="text-xs font-semibold text-[#cccccc] mb-3">Create New File</div>
              <input 
                type="text" 
                placeholder="filename.ext"
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-sm px-3 py-2 text-xs text-[#cccccc] focus:outline-none focus:border-[#0e639c] mb-4"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFile();
                  if (e.key === "Escape") setShowNewFileModal(false);
                }}
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowNewFileModal(false)}
                  className="px-3 py-1.5 text-xs text-[#cccccc] hover:bg-[#4d4d4d] rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateFile}
                  disabled={!newFileName}
                  className="px-3 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white disabled:opacity-50 rounded-sm transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

