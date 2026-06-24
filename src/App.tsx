/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EditorView } from './components/EditorView';
import { ArenaView } from './components/ArenaView';
import { Code, Trophy, TerminalSquare } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'arena'>('editor');

  return (
    <div className="flex flex-col h-screen w-full bg-[#0B0C10] font-sans overflow-hidden text-slate-300">
      {/* Header */}
      <header className="h-14 border-b border-white/5 bg-[#101218] flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg flex items-center justify-center font-bold text-white italic text-xs sm:text-base shadow-lg shadow-purple-900/50">J</div>
          <h1 className="font-semibold text-base sm:text-lg tracking-tight text-white">Joker <span className="text-purple-500 font-light text-xs sm:text-sm ml-0.5 sm:ml-1">IDE</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Top level tools or user profile can go here */}
        </div>
      </header>

      <div className="flex-1 flex flex-col-reverse md:flex-row overflow-hidden">
        {/* Sidebar / Bottom Nav */}
        <aside className="w-full h-auto md:w-16 md:h-full bg-[#0B0C10] border-t md:border-t-0 md:border-r border-white/5 flex flex-row md:flex-col justify-center md:justify-start items-center p-2 md:py-4 gap-4 z-10 shrink-0">
          <button 
            onClick={() => setActiveTab('editor')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'editor' ? 'bg-purple-600/20 text-purple-400' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            title="Code Editor"
          >
            <Code size={20} />
          </button>
          
          <button 
            onClick={() => setActiveTab('arena')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'arena' ? 'bg-purple-600/20 text-purple-400' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            title="Script Arena"
          >
            <Trophy size={20} />
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#111218]">
          {activeTab === 'editor' ? <EditorView /> : <ArenaView />}
        </main>
      </div>
    </div>
  );
}
