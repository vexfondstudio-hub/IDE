import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Download, Upload, Share2, Save, Cloud, Sparkles, ChevronDown } from 'lucide-react';
import { executeCode } from '../lib/piston';
import { executeInSandbox } from '../lib/sandbox';
import { uploadToDrive, sendEmail } from '../lib/googleApi';
import { saveArenaScript } from '../lib/arenaStore';
import { googleSignIn, initAuth, logout } from '../lib/auth';
import { User } from 'firebase/auth';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', pistonVersion: '18.15.0' },
  { id: 'python', name: 'Python', pistonVersion: '3.10.0' },
  { id: 'cpp', name: 'C++', pistonVersion: '10.2.0' },
  { id: 'java', name: 'Java', pistonVersion: '15.0.2' },
  { id: 'csharp', name: 'C#', pistonVersion: '6.12.0' },
  { id: 'rust', name: 'Rust', pistonVersion: '1.68.2' },
  { id: 'lua', name: 'Lua', pistonVersion: '5.4.4' },
  { id: 'html', name: 'HTML/CSS', pistonVersion: '' },
];

export function EditorView() {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [code, setCode] = useState('console.log("Hello, Joker!");');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [aiHint, setAiHint] = useState<{title: string, description: string, suggestion: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setUser(u),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAnalyze = async (errorOutput?: string) => {
    setIsAnalyzing(true);
    setAiHint(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: language.name,
          error: errorOutput
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAiHint(data);
      }
    } catch (e) {
      console.error('Failed to get AI hint', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running...');
    setAiHint(null);
    try {
      let finalOutput = '';
      if (language.id === 'html') {
        finalOutput = '__HTML_PREVIEW__';
      } else if (language.id === 'javascript') {
        try {
          const result = await executeInSandbox(code);
          finalOutput = result;
        } catch (err: any) {
          finalOutput = `Error: ${err.message}`;
        }
      } else {
        const result = await executeCode(language.id, language.pistonVersion, code);
        finalOutput = result.run?.output || result.compile?.output || 'No output';
      }
      setOutput(finalOutput);
      
      // Auto-analyze if error detected
      if (finalOutput.toLowerCase().includes('error') || finalOutput.toLowerCase().includes('exception')) {
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
    if (!user) {
      alert('Please sign in first');
      return;
    }
    const confirmed = window.confirm('Save this script to your Google Drive?');
    if (!confirmed) return;
    
    try {
      await uploadToDrive(`joker_script_${language.id}.txt`, code);
      alert('Saved to Google Drive successfully!');
    } catch (e: any) {
      alert(`Error saving to Drive: ${e.message}`);
    }
  };

  const handleEmailShare = async () => {
    if (!user) {
      alert('Please sign in first');
      return;
    }
    const confirmed = window.confirm(`Send this script to ${shareEmail}?`);
    if (!confirmed) return;

    try {
      await sendEmail(shareEmail, `Joker Script: ${language.name}`, code);
      alert('Email sent successfully!');
      setShowShareModal(false);
    } catch (e: any) {
      alert(`Error sending email: ${e.message}`);
    }
  };

  const handlePublish = () => {
    const title = prompt('Enter a title for your script:');
    if (title) {
      saveArenaScript({
        title,
        language: language.id,
        version: language.pistonVersion,
        code,
        author: user?.displayName || 'Anonymous',
      });
      alert('Published to Arena!');
    }
  };

  const handleLocalDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script.${language.id === 'javascript' ? 'js' : language.id === 'python' ? 'py' : language.id === 'cpp' ? 'cpp' : language.id === 'csharp' ? 'cs' : language.id === 'rust' ? 'rs' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCode(event.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#111218] text-slate-300">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-[#101218] border-b border-white/5 gap-3 sm:gap-0 z-20">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="relative" ref={langMenuRef}>
            <button 
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center justify-between gap-2 bg-black/40 text-slate-300 px-3 py-1.5 rounded text-xs font-medium outline-none border border-white/5 hover:border-purple-500/50 hover:bg-white/5 transition-colors w-32"
            >
              {language.name}
              <ChevronDown size={14} className={`transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180 text-purple-400' : 'text-slate-500'}`} />
            </button>
            
            {isLangMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#1A1D24] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1 z-50">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      setLanguage(lang);
                      setIsLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${language.id === lang.id ? 'bg-purple-600/20 text-purple-400 border-l-2 border-purple-500' : 'text-slate-300 hover:bg-white/5 border-l-2 border-transparent'}`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="bg-green-600/90 hover:bg-green-500 disabled:bg-green-800 text-white text-xs px-4 py-1.5 rounded-full font-semibold flex items-center gap-2 success-glow transition-all"
          >
            <Play size={14} />
            {isRunning ? 'Running...' : 'Run Code'}
          </button>
          <button
            onClick={() => handleAnalyze()}
            disabled={isAnalyzing}
            className="bg-purple-600/90 hover:bg-purple-500 disabled:bg-purple-800 text-white text-xs px-4 py-1.5 rounded-full font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)]"
          >
            <Sparkles size={14} />
            {isAnalyzing ? 'Analyzing...' : 'AI Hint'}
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          <label className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded transition-colors text-xs font-medium text-slate-400 hover:text-white cursor-pointer shrink-0" title="Open File">
            <Upload size={14} />
            Open
            <input type="file" className="hidden" onChange={handleLocalUpload} accept=".js,.py,.cpp,.cs,.java,.rs,.txt" />
          </label>
          <button onClick={handleLocalDownload} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded transition-colors text-xs font-medium text-slate-400 hover:text-white shrink-0" title="Save File Locally">
            <Download size={14} />
            Save
          </button>
          <button onClick={handlePublish} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded transition-colors text-xs font-medium text-slate-400 hover:text-white shrink-0">
            <Share2 size={14} />
            Publish
          </button>
          
          <div className="w-px h-4 bg-white/10 mx-1 shrink-0"></div>

          {user ? (
            <>
              <button onClick={handleDriveSave} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded transition-colors text-xs font-medium text-slate-400 hover:text-white shrink-0" title="Save to Google Drive">
                <Cloud size={14} />
                To Drive
              </button>
              <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded transition-colors text-xs font-medium text-slate-400 hover:text-white shrink-0">
                <Share2 size={14} />
                Email
              </button>
            </>
          ) : (
            <button onClick={() => googleSignIn()} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded transition-colors text-xs font-medium text-purple-400 shrink-0">
              Sign in to Save
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="flex-1 border-b md:border-b-0 md:border-r border-white/5 min-h-[50vh] md:min-h-0 relative">
          <Editor
            height="100%"
            language={language.id === 'cpp' ? 'cpp' : language.id}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: '"JetBrains Mono", monospace',
              padding: { top: 16 },
            }}
          />
          
          {/* AI Hint Popup */}
          {aiHint && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass rounded-lg p-4 w-[90%] sm:w-[400px] shadow-2xl border-purple-500/30 z-40 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 text-purple-400">
                  <Sparkles size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">{aiHint.title}</span>
                </div>
                <button onClick={() => setAiHint(null)} className="text-slate-500 hover:text-white transition-colors text-lg font-bold w-6 h-6 flex items-center justify-center rounded hover:bg-white/10">&times;</button>
              </div>
              <p className="text-sm text-slate-300 mb-3">{aiHint.description}</p>
              
              {aiHint.suggestion && (
                <div className="bg-black/50 p-3 rounded border border-white/5 mb-3 overflow-x-auto">
                  <pre className="text-[11px] sm:text-xs font-mono text-purple-200 whitespace-pre-wrap">{aiHint.suggestion}</pre>
                </div>
              )}
              
              <div className="flex gap-2">
                {aiHint.suggestion && (
                  <button 
                    onClick={() => {
                      if(aiHint.suggestion) {
                        setCode(aiHint.suggestion);
                        setAiHint(null);
                      }
                    }}
                    className="flex-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-[11px] px-3 py-2 rounded transition-colors font-medium text-center"
                  >
                    Auto-fix Code
                  </button>
                )}
                <button onClick={() => setAiHint(null)} className="flex-1 text-slate-400 hover:bg-white/5 text-[11px] px-3 py-2 rounded transition-colors text-center border border-transparent hover:border-white/10">Dismiss</button>
              </div>
            </div>
          )}
        </div>
        
        {/* Output Panel */}
        <div className="w-full h-64 md:h-full md:w-[400px] flex flex-col bg-[#0B0C10] shrink-0 z-10 border-t md:border-t-0 md:border-l border-white/5">
          <div className="p-3 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center bg-[#101218]">
            TERMINAL
            <button onClick={() => setOutput('')} className="text-slate-400 hover:text-white transition-colors bg-white/5 px-2 py-1 rounded">Clear</button>
          </div>
          <div className="flex-1 p-4 font-mono text-[12px] text-slate-400 whitespace-pre-wrap overflow-y-auto">
            {output === '__HTML_PREVIEW__' ? (
              <iframe
                title="Preview"
                className="w-full h-full bg-white rounded"
                srcDoc={code}
                sandbox="allow-scripts"
              />
            ) : (
              output || <span className="text-slate-600 italic">No output yet. Run your code to see results here.</span>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#101218] p-6 rounded-xl border border-white/10 shadow-2xl w-96">
            <h3 className="text-sm font-semibold text-white mb-4">Share via Email</h3>
            <input 
              type="email" 
              placeholder="Recipient email address" 
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2.5 mb-4 outline-none focus:border-purple-500 text-sm"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowShareModal(false)} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleEmailShare} className="px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
