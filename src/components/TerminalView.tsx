import React, { useEffect, useRef, memo } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { io, Socket } from "socket.io-client";

export const TerminalView = memo(() => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: "#0F111A",
        foreground: "#8F93A2",
        cursor: "#FFCC66",
        selectionBackground: "#303348",
      },
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 14,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("terminal:start");
    });

    socket.on("terminal:data", (data: string) => {
      term.write(data);
    });

    term.onData((data) => {
      socket.emit("terminal:data", data);
    });

    const handleResize = () => {
      fitAddon.fit();
      socket.emit("terminal:resize", { cols: term.cols, rows: term.rows });
    };
    
    // Initial resize
    setTimeout(handleResize, 100);

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#0F111A]">
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <h2 className="text-sm font-medium text-slate-400">Terminal</h2>
        <button 
          onClick={() => xtermRef.current?.clear()}
          className="text-[10px] text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
        >
          Clear Console
        </button>
      </div>
      <div className="flex-1 overflow-hidden p-2">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
});
