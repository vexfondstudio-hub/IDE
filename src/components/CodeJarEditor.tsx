import React, { useEffect, useRef } from "react";
import { CodeJar } from "codejar";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";

interface CodeJarEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
}

export function CodeJarEditor({
  value,
  onChange,
  language,
}: CodeJarEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current && !jarRef.current) {
      const highlight = (editor: HTMLElement) => {
        const lang =
          language === "cpp"
            ? "cpp"
            : language === "html"
              ? "markup"
              : language;
        editor.textContent = editor.textContent; // reset
        Prism.highlightElement(editor);
      };

      jarRef.current = CodeJar(editorRef.current, highlight);
      jarRef.current.onUpdate((code: string) => {
        onChange(code);
      });
    }

    return () => {
      if (jarRef.current) {
        jarRef.current.destroy();
        jarRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (jarRef.current && jarRef.current.toString() !== value) {
      jarRef.current.updateCode(value);
    }
  }, [value]);

  useEffect(() => {
    if (editorRef.current) {
      const lang =
        language === "cpp" ? "cpp" : language === "html" ? "markup" : language;
      editorRef.current.className = `language-${lang}`;
      if (jarRef.current) {
        jarRef.current.updateCode(value);
      }
    }
  }, [language]);

  return (
    <div className="absolute inset-0 overflow-auto bg-[#1e1e1e] p-4 text-sm font-mono">
      <div
        ref={editorRef}
        className={`language-${language === "cpp" ? "cpp" : language === "html" ? "markup" : language} outline-none h-full`}
      />
    </div>
  );
}
