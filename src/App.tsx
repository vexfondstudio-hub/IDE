/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, memo } from "react";
import { EditorView } from "./components/EditorView";
import { ArenaView } from "./components/ArenaView";
import { TerminalView } from "./components/TerminalView";
import { AIChat } from "./components/AIChat";
import { Code, Trophy, TerminalSquare, MessageSquare } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"editor" | "arena" | "terminal" | "chat">("editor");

  const NavButton = useCallback(({ id, icon: Icon, title }: { id: typeof activeTab, icon: any, title: string }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`p-3 rounded-xl transition-colors ${isActive ? "bg-blue-600/10 text-blue-500" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
        title={title}
      >
        <Icon size={20} />
      </button>
    );
  }, [activeTab]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#18181b] font-sans overflow-hidden text-slate-300">
      {/* Header */}
      <header className="h-12 border-b border-white/5 bg-[#18181b] flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-xs">
            IDE
          </div>
          <h1 className="font-medium text-sm tracking-tight text-slate-200">
            Developer Workspace
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col-reverse md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full h-auto md:w-14 md:h-full bg-[#18181b] border-t md:border-t-0 md:border-r border-white/5 flex flex-row md:flex-col justify-center md:justify-start items-center p-2 md:py-4 gap-2 z-10 shrink-0">
          <NavButton id="editor" icon={Code} title="Code Editor" />
          <NavButton id="arena" icon={Trophy} title="Script Arena" />
          <NavButton id="terminal" icon={TerminalSquare} title="Terminal" />
          <NavButton id="chat" icon={MessageSquare} title="AI Assistant" />
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
