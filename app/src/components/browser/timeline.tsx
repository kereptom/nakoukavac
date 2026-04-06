"use client";

import { useRef, useCallback, useMemo } from "react";
import { formatTimeShorter } from "@/lib/utils";
import type { VideoAnalysis, SelectedItem } from "@/lib/types";

interface TimelineProps {
  analysis: VideoAnalysis;
  duration: number;
  currentTime: number;
  zoom: number;
  selectedItem: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
  onSeek: (time: number) => void;
  onZoomChange: (zoom: number) => void;
}

function pickTimeInterval(visibleDuration: number): number {
  const target = visibleDuration / 10;
  const nice = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const n of nice) {
    if (n >= target) return n;
  }
  return 600;
}

export function Timeline({
  analysis,
  duration,
  currentTime,
  zoom,
  selectedItem,
  onSelect,
  onSeek,
  onZoomChange,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const newZoom = Math.max(1, Math.min(zoom * factor, Math.max(duration / 3, 2)));
        onZoomChange(newZoom);
      }
    },
    [zoom, duration, onZoomChange],
  );

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      onSeek(pct * duration);
    },
    [duration, onSeek],
  );

  const handleSegmentClick = useCallback(
    (id: string, type: "scene" | "shot", startTime: number) => {
      onSelect({ id, type });
      onSeek(startTime);
    },
    [onSelect, onSeek],
  );

  const visibleDuration = duration / zoom;
  const interval = pickTimeInterval(visibleDuration);

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let t = 0; t <= duration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [duration, interval]);

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col border-t border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border">
        <span className="text-[10px] text-muted-foreground">Zoom:</span>
        <input
          type="range"
          min={1}
          max={Math.max(duration / 3, 2)}
          step={0.1}
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="w-24 h-1 accent-primary"
        />
        <span className="text-[10px] text-muted-foreground">
          ~{visibleDuration.toFixed(0)}s visible
        </span>
      </div>

      {/* Scrollable timeline area */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden"
        onWheel={handleWheel}
      >
        <div
          className="relative"
          style={{ minWidth: `${100 * zoom}%` }}
        >
          {/* Time ruler */}
          <div
            className="relative h-5 border-b border-border cursor-pointer"
            onClick={handleRulerClick}
          >
            {timeMarkers.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 border-l border-border/50"
                style={{ left: `${(t / duration) * 100}%` }}
              >
                <span className="absolute top-0 left-1 text-[9px] text-muted-foreground/60">
                  {formatTimeShorter(t)}
                </span>
              </div>
            ))}
          </div>

          {/* Scene track */}
          <div className="timeline-track" style={{ minHeight: 36 }}>
            <div className="absolute left-0 top-0 bottom-0 w-[60px] bg-card z-10 flex items-center px-1">
              <span className="text-[9px] text-muted-foreground">Scenes</span>
            </div>
            {analysis.scenes.map((scene) => {
              const left = (scene.startTime / duration) * 100;
              const width = ((scene.endTime - scene.startTime) / duration) * 100;
              const isActive = selectedItem?.id === scene.id && selectedItem?.type === "scene";
              return (
                <div
                  key={scene.id}
                  className={`timeline-segment ${isActive ? "selected" : ""}`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    borderColor: "rgb(34, 211, 238)",
                    background: "rgba(34, 211, 238, 0.08)",
                    marginLeft: 60,
                  }}
                  title={scene.description}
                  onClick={() => handleSegmentClick(scene.id, "scene", scene.startTime)}
                >
                  <span className="block px-1 text-[8px] text-muted-foreground truncate">
                    {scene.description}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Shot track */}
          <div className="timeline-track" style={{ minHeight: 36 }}>
            <div className="absolute left-0 top-0 bottom-0 w-[60px] bg-card z-10 flex items-center px-1">
              <span className="text-[9px] text-muted-foreground">Shots</span>
            </div>
            {analysis.shots.map((shot) => {
              const left = (shot.startTime / duration) * 100;
              const width = ((shot.endTime - shot.startTime) / duration) * 100;
              const isActive = selectedItem?.id === shot.id && selectedItem?.type === "shot";
              return (
                <div
                  key={shot.id}
                  className={`timeline-segment ${isActive ? "selected" : ""}`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    borderColor: "rgb(52, 211, 153)",
                    background: "rgba(52, 211, 153, 0.08)",
                    marginLeft: 60,
                  }}
                  title={shot.description}
                  onClick={() => handleSegmentClick(shot.id, "shot", shot.startTime)}
                >
                  <span className="block px-1 text-[8px] text-muted-foreground truncate">
                    {shot.id}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="playhead"
            style={{ left: `${playheadPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
