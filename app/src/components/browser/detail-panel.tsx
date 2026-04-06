"use client";

import { useMemo } from "react";
import { Play, Clapperboard, ScanLine, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTime, formatTimeShorter } from "@/lib/utils";
import type { VideoAnalysis, SelectedItem, Shot, Scene } from "@/lib/types";

interface DetailPanelProps {
  analysis: VideoAnalysis;
  selectedItem: SelectedItem | null;
  onPlaySegment: (startTime: number, endTime: number) => void;
  onSelect: (item: SelectedItem) => void;
  onSeek: (time: number) => void;
}

export function DetailPanel({
  analysis,
  selectedItem,
  onPlaySegment,
  onSelect,
  onSeek,
}: DetailPanelProps) {
  const { shot, scene } = useMemo(() => {
    if (!selectedItem) return { shot: null, scene: null };
    if (selectedItem.type === "shot") {
      const s = analysis.shots.find((sh) => sh.id === selectedItem.id);
      const sc = analysis.scenes.find((sc) => sc.shotIds.includes(selectedItem.id));
      return { shot: s || null, scene: sc || null };
    }
    if (selectedItem.type === "scene") {
      const sc = analysis.scenes.find((sc) => sc.id === selectedItem.id);
      return { shot: null, scene: sc || null };
    }
    return { shot: null, scene: null };
  }, [selectedItem, analysis]);

  if (!selectedItem) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center px-3 py-1.5 border-b border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Details
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Select a shot or scene</p>
        </div>
      </div>
    );
  }

  // Video summary view
  if (selectedItem.type === "video") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
          <Film className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Video Summary
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">File</p>
              <p className="text-sm">{analysis.sourceFile}</p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{formatTimeShorter(analysis.duration)} duration</span>
              <span>{analysis.resolution[0]}x{analysis.resolution[1]}</span>
              <span>{analysis.fps.toFixed(1)} fps</span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{analysis.scenes.length} scenes</span>
              <span>{analysis.shots.length} shots</span>
            </div>
            {analysis.summary && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Summary (EN)</p>
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
              </div>
            )}
            {analysis.summaryCd && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Summary (CS)</p>
                <p className="text-sm leading-relaxed">{analysis.summaryCd}</p>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground/50 space-y-0.5">
              <p>Model: {analysis.model}</p>
              <p>Embeddings: {analysis.embeddingModel}</p>
              <p>Processed: {analysis.processedAt}</p>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Scene view
  if (selectedItem.type === "scene" && scene) {
    const shotMap = new Map(analysis.shots.map((s) => [s.id, s]));
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
          <Clapperboard className="h-3.5 w-3.5 text-cyan-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {scene.id}
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                <span className="ml-2 text-muted-foreground/60">
                  ({(scene.endTime - scene.startTime).toFixed(1)}s)
                </span>
              </span>
              <Button
                size="sm"
                className="h-7 gap-1"
                onClick={() => onPlaySegment(scene.startTime, scene.endTime)}
              >
                <Play className="h-3 w-3" /> Play
              </Button>
            </div>

            {scene.description && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Description (EN)</p>
                <p className="text-sm leading-relaxed">{scene.description}</p>
              </div>
            )}
            {scene.descriptionCs && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Popis (CS)</p>
                <p className="text-sm leading-relaxed">{scene.descriptionCs}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">
                Shots ({scene.shotIds.length})
              </p>
              <div className="space-y-1">
                {scene.shotIds.map((shotId) => {
                  const s = shotMap.get(shotId);
                  if (!s) return null;
                  return (
                    <button
                      key={s.id}
                      className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors"
                      onClick={() => {
                        onSelect({ id: s.id, type: "shot" });
                        onSeek(s.startTime);
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <ScanLine className="h-3 w-3 text-emerald-500/70" />
                        <span className="font-medium">{s.id}</span>
                        <span className="text-muted-foreground">
                          {formatTimeShorter(s.startTime)}-{formatTimeShorter(s.endTime)}
                        </span>
                      </div>
                      <p className="pl-[18px] text-muted-foreground truncate mt-0.5">{s.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Shot view
  if (selectedItem.type === "shot" && shot) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
          <ScanLine className="h-3.5 w-3.5 text-emerald-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {shot.id}
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatTime(shot.startTime)} - {formatTime(shot.endTime)}
                <span className="ml-2 text-muted-foreground/60">
                  ({(shot.endTime - shot.startTime).toFixed(1)}s)
                </span>
              </span>
              <Button
                size="sm"
                className="h-7 gap-1"
                onClick={() => onPlaySegment(shot.startTime, shot.endTime)}
              >
                <Play className="h-3 w-3" /> Play
              </Button>
            </div>

            {shot.description && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Description (EN)</p>
                <p className="text-sm leading-relaxed">{shot.description}</p>
              </div>
            )}
            {shot.descriptionCs && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Popis (CS)</p>
                <p className="text-sm leading-relaxed">{shot.descriptionCs}</p>
              </div>
            )}
            {shot.transcript && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Transcript</p>
                <p className="text-sm leading-relaxed italic text-muted-foreground">{shot.transcript}</p>
              </div>
            )}
            {scene && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Part of</p>
                <button
                  className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
                  onClick={() => {
                    onSelect({ id: scene.id, type: "scene" });
                    onSeek(scene.startTime);
                  }}
                >
                  <Clapperboard className="h-3 w-3" />
                  {scene.id}: {scene.description?.slice(0, 60)}...
                </button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return null;
}
