"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  height = "100%",
}: JsonEditorProps) {
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      const val = newValue || "";
      onChange(val);

      try {
        if (val.trim()) {
          JSON.parse(val);
        }
        setIsValid(true);
        setError(null);
      } catch (e) {
        setIsValid(false);
        setError(e instanceof Error ? e.message : "Invalid JSON");
      }
    },
    [onChange]
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/50 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">
          JSON Editor
        </span>
        <Badge
          variant={isValid ? "success" : "destructive"}
          className="text-[10px]"
        >
          {isValid ? "Valid JSON" : "Invalid"}
        </Badge>
      </div>
      <div className="flex-1">
        <Editor
          height={height}
          language="json"
          theme="vs-dark"
          value={value}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: "on",
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            readOnly,
            wordWrap: "on",
            formatOnPaste: true,
            formatOnType: true,
            renderLineHighlight: "gutter",
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
            padding: { top: 8 },
          }}
        />
      </div>
      {error && (
        <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/30">
          <p className="text-xs text-destructive font-mono truncate">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
