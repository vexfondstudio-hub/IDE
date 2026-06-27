/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, memo } from "react";
import { EditorView } from "./components/EditorView";
import { ArenaView } from "./components/ArenaView";
import { TerminalView } from "./components/TerminalView";
import { AIChat } from "./components/AIChat";
import { CodeBlock, Sword, TerminalWindow, ChatTeardropDots } from "@phosphor-icons/react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"editor" | "arena" | "terminal" | "chat">("editor");

  const NavButton = useCallback(({ id, icon: Icon, title }: { id: typeof activeTab, icon: any, title: string }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`p-3 rounded-xl transition-all duration-300 ${isActive ? "bg-blue-600/15 text-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.15)]" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
        title={title}
      >
        <Icon size={24} weight={isActive ? "duotone" : "regular"} />
      </button>
    );
  }, [activeTab]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#18181b] font-sans overflow-hidden text-slate-300">
      {/* Header */}
      <header className="h-12 border-b border-white/5 bg-[#18181b] flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg flex items-center justify-center font-bold text-white italic text-xs sm:text-base shadow-lg shadow-purple-900/50">
            J
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-none mb-0.5">
              Joker <span className="text-purple-500 font-light">IDE</span>
            </h1>
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium uppercase tracking-wider leading-none">Code editor</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col-reverse md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full h-auto md:w-16 md:h-full bg-[#18181b] border-t md:border-t-0 md:border-r border-white/5 flex flex-row md:flex-col justify-center md:justify-start items-center p-2 md:py-4 gap-2 z-10 shrink-0">
          <NavButton id="editor" icon={CodeBlock} title="Code Editor" />
          <NavButton id="arena" icon={Sword} title="Script Arena" />
          <NavButton id="terminal" icon={TerminalWindow} title="Terminal" />
          <NavButton id="chat" icon={ChatTeardropDots} title="AI Assistant" />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0F111A]">
          {activeTab === "editor" && <EditorView />}
          {activeTab === "arena" && <ArenaView />}
          {activeTab === "terminal" && <TerminalView />}
          {activeTab === "chat" && <AIChat />}
        </main>
      </div>
    </div>
  );
}
