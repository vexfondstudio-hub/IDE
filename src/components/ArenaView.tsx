import React, { useState, useEffect } from "react";
import { fetchArenaScripts, likeScript, ArenaScript } from "../lib/arenaStore";
import { ThumbsUp, Code as Code2, Play } from "@phosphor-icons/react";
import { executeCode } from "../lib/piston";
import { executeInSandbox } from "../lib/sandbox";

export function ArenaView() {
  const [scripts, setScripts] = useState<ArenaScript[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, string>>({});

  const loadScripts = async () => {
    const fetched = await fetchArenaScripts();
    setScripts(fetched);
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const handleLike = async (id: string) => {
    await likeScript(id);
    await loadScripts();
  };

  const handleRun = async (script: ArenaScript) => {
    setExecutingId(script.id);
    try {
      if (script.language === "html") {
        setOutputs((prev) => ({ ...prev, [script.id]: "__HTML_PREVIEW__" }));
      } else if (script.language === "javascript") {
        const result = await executeInSandbox(script.code);
        setOutputs((prev) => ({ ...prev, [script.id]: result }));
      } else {
        const result = await executeCode(
          script.language,
          script.version,
          script.code,
        );
        setOutputs((prev) => ({
          ...prev,
          [script.id]:
            result.run?.output || result.compile?.output || "No output",
        }));
      }
    } catch (err: any) {
      setOutputs((prev) => ({ ...prev, [script.id]: `Error: ${err.message}` }));
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0F111A] text-slate-300 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-slate-200 tracking-tight">
          Script Arena
        </h1>
        <p className="text-slate-500 mb-8 text-sm">
          Discover, test, and compare community scripts.
        </p>

        <div className="grid gap-6">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="bg-[#141620] border border-white/5 rounded-lg overflow-hidden transition-all shadow-md"
            >
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-3 sm:gap-0">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-1">
                      {script.title}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1 text-blue-400">
                        <Code2 size={14} /> {script.language}
                      </span>
                      <span>By {script.author}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLike(script.id)}
                    className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors bg-white/5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  >
                    <ThumbsUp size={14} /> {script.likes}
                  </button>
                </div>

                <div className="bg-[#0A0C12] p-4 rounded text-[13px] font-mono text-slate-300 overflow-x-auto mb-4 border border-white/5">
                  <pre>{script.code}</pre>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleRun(script)}
                    disabled={executingId === script.id}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Play size={14} />
                    {executingId === script.id ? "Running..." : "Test Run"}
                  </button>
                </div>

                {outputs[script.id] && (
                  <div className="mt-5 p-4 bg-black/40 border border-white/5 rounded text-[12px] font-mono whitespace-pre-wrap text-slate-400">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2 block">
                      Output:
                    </span>
                    {outputs[script.id] === "__HTML_PREVIEW__" ? (
                      <iframe
                        title="Preview"
                        className="w-full h-64 bg-white rounded"
                        srcDoc={script.code}
                        sandbox="allow-scripts"
                      />
                    ) : (
                      outputs[script.id]
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {scripts.length === 0 && (
            <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-lg text-sm">
              No scripts published yet. Be the first to publish from the Editor!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
