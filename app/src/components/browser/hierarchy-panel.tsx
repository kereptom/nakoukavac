"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Film, Clapperboard, ScanLine } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTimeShorter } from "@/lib/utils";
import type { VideoAnalysis, SelectedItem, Scene, Shot } from "@/lib/types";

interface HierarchyPanelProps {
  analysis: VideoAnalysis;
  selectedItem: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
  onSeek: (time: number) => void;
}

export function HierarchyPanel({
  analysis,
  selectedItem,
  onSelect,
  onSeek,
}: HierarchyPanelProps) {
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  const shotMap = useMemo(() => {
    const map = new Map<string, Shot>();
    for (const shot of analysis.shots) map.set(shot.id, shot);
    return map;
  }, [analysis.shots]);

  const toggleScene = (sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const isSelected = (id: string, type: "video" | "scene" | "shot") =>
    selectedItem?.id === id && selectedItem?.type === type;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-3 py-1.5 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Structure
        </h2>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {analysis.scenes.length}s / {analysis.shots.length}sh
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* Video summary */}
          <button
            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
              isSelected("video", "video")
                ? "bg-primary/15 text-primary"
                : "hover:bg-accent"
            }`}
            onClick={() => {
              onSelect({ id: "video", type: "video" });
              setSummaryExpanded(!summaryExpanded);
            }}
          >
            <div className="flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium truncate">{analysis.sourceFile}</span>
              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                {formatTimeShorter(analysis.duration)}
              </span>
            </div>
          </button>

          {/* Scenes */}
          {analysis.scenes.map((scene, i) => (
            <div key={scene.id}>
              <button
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  isSelected(scene.id, "scene")
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "hover:bg-accent"
                }`}
                onClick={() => {
                  onSelect({ id: scene.id, type: "scene" });
                  onSeek(scene.startTime);
                  toggleScene(scene.id);
                }}
              >
                <div className="flex items-center gap-1.5">
                  {expandedScenes.has(scene.id) ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <Clapperboard className="h-3.5 w-3.5 shrink-0 text-cyan-500/70" />
                  <span className="font-medium">Scene {i + 1}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTimeShorter(scene.startTime)}-{formatTimeShorter(scene.endTime)}
                  </span>
                </div>
                <p className="mt-0.5 pl-[38px] text-muted-foreground truncate">
                  {scene.description}
                </p>
              </button>

              {/* Shots under this scene */}
              {expandedScenes.has(scene.id) && (
                <div className="ml-4 space-y-0.5 mt-0.5">
                  {scene.shotIds.map((shotId) => {
                    const shot = shotMap.get(shotId);
                    if (!shot) return null;
                    return (
                      <button
                        key={shot.id}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          isSelected(shot.id, "shot")
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "hover:bg-accent"
                        }`}
                        onClick={() => {
                          onSelect({ id: shot.id, type: "shot" });
                          onSeek(shot.startTime);
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <ScanLine className="h-3 w-3 shrink-0 text-emerald-500/70" />
                          <span className="font-medium">{shot.id}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTimeShorter(shot.startTime)}-{formatTimeShorter(shot.endTime)}
                          </span>
                        </div>
                        <p className="mt-0.5 pl-[22px] text-muted-foreground truncate">
                          {shot.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
