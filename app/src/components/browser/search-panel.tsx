"use client";

import { useState, useMemo } from "react";
import { Search, ScanLine, Clapperboard, Film } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTimeShorter } from "@/lib/utils";
import { searchAnalysis } from "@/lib/search";
import type { VideoAnalysis, SelectedItem, SearchResult } from "@/lib/types";

interface SearchPanelProps {
  analysis: VideoAnalysis;
  onSelect: (item: SelectedItem) => void;
  onSeek: (time: number) => void;
}

const typeIcons = {
  video: Film,
  scene: Clapperboard,
  shot: ScanLine,
};

const typeColors = {
  video: "text-primary",
  scene: "text-cyan-500",
  shot: "text-emerald-500",
};

export function SearchPanel({ analysis, onSelect, onSeek }: SearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchAnalysis(analysis, query),
    [analysis, query],
  );

  return (
    <div className="flex flex-col border-t border-border">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search shots, scenes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />
        {results.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{results.length}</span>
        )}
      </div>

      {results.length > 0 && (
        <ScrollArea className="max-h-[200px]">
          <div className="p-1 space-y-0.5">
            {results.slice(0, 30).map((result) => {
              const Icon = typeIcons[result.type];
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors"
                  onClick={() => {
                    onSelect({ id: result.id, type: result.type });
                    onSeek(result.startTime);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3 w-3 shrink-0 ${typeColors[result.type]}`} />
                    <span className="font-medium">{result.id}</span>
                    <span className="text-muted-foreground">
                      {formatTimeShorter(result.startTime)}-{formatTimeShorter(result.endTime)}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground/50">
                      {result.score.toFixed(0)}
                    </span>
                  </div>
                  <p className="pl-[18px] text-muted-foreground truncate mt-0.5">
                    {result.description}
                  </p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
