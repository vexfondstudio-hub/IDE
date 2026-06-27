import React, { useState, useRef, useEffect, useMemo } from "react";
import JSZip from "jszip";
import { DownloadSimple as Download, UploadSimple as Upload, X, Folder, File as FileIcon, CaretRight, CaretDown, Sparkle } from "@phosphor-icons/react";
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
        {isOpen ? <CaretDown size={12} className="shrink-0" /> : <CaretRight size={12} className="shrink-0" />}
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
  const [aiSuggestion, setAiSuggestion] = useState<{title: string; description: string; suggestion: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileTree = useMemo(() => {
    const root: FileNode = { name: "root", path: "", isDir: true, children: {} };
    
    files.forEach(file => {
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

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] z-50 flex flex-col font-sans">
      <div className="h-12 border-b border-[#3c3c3c] bg-[#252526] flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[#cccccc] font-semibold">APK Studio</span>
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
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#2ea043] hover:bg-[#3fb950] text-white text-xs rounded-sm transition-colors"
            >
              <Download size={14} /> Repack & Download
            </button>
          )}
        </div>
        <button onClick={onClose} className="text-[#cccccc] hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-[#3c3c3c] bg-[#252526] flex flex-col">
          <div className="h-8 border-b border-[#3c3c3c] flex items-center px-3 text-xs font-semibold text-[#cccccc]">
            FILES
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
              </div>
              
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
      </div>
    </div>
  );
};

