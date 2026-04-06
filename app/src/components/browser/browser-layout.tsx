"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { VideoPlayer } from "./video-player";
import { HierarchyPanel } from "./hierarchy-panel";
import { DetailPanel } from "./detail-panel";
import { SearchPanel } from "./search-panel";
import { Timeline } from "./timeline";
import type { VideoAnalysis, SelectedItem } from "@/lib/types";

interface BrowserLayoutProps {
  analysis: VideoAnalysis;
  videoUrl: string | null;
}

export function BrowserLayout({ analysis, videoUrl }: BrowserLayoutProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const segmentEndRef = useRef<number | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(analysis.duration || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  // Time update loop
  useEffect(() => {
    const tick = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setCurrentTime(video.currentTime);

        // Check segment end boundary
        if (segmentEndRef.current !== null && video.currentTime >= segmentEndRef.current) {
          video.pause();
          setIsPlaying(false);
          segmentEndRef.current = null;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    segmentEndRef.current = null; // Clear segment boundary
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = time;
    setCurrentTime(time);
    segmentEndRef.current = null;
  }, []);

  const handlePlaySegment = useCallback((startTime: number, endTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTime;
    setCurrentTime(startTime);
    segmentEndRef.current = endTime;
    video.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  // Get active shot description for video overlay
  const activeDescription = analysis.shots.find(
    (s) => currentTime >= s.startTime && currentTime < s.endTime,
  )?.description ?? null;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSeek(Math.max(0, (videoRef.current?.currentTime ?? 0) - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSeek(Math.min(duration, (videoRef.current?.currentTime ?? 0) + 5));
          break;
        case "Escape":
          setSelectedItem(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePlayPause, handleSeek, duration]);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <h1 className="text-sm font-bold tracking-tight">AI Nakoukavac</h1>
        <span className="text-xs text-muted-foreground">|</span>
        <span className="text-xs text-muted-foreground">{analysis.sourceFile}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {analysis.scenes.length} scenes, {analysis.shots.length} shots
        </span>
      </div>

      {/* Main content */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left: Hierarchy + Search */}
        <ResizablePanel defaultSize="22%" minSize="15%">
          <div className="flex h-full flex-col">
            <div className="flex-1 min-h-0">
              <HierarchyPanel
                analysis={analysis}
                selectedItem={selectedItem}
                onSelect={setSelectedItem}
                onSeek={handleSeek}
              />
            </div>
            <SearchPanel
              analysis={analysis}
              onSelect={setSelectedItem}
              onSeek={handleSeek}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Center: Video + Timeline */}
        <ResizablePanel defaultSize="53%" minSize="30%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="70%" minSize="30%">
              <VideoPlayer
                ref={videoRef}
                videoUrl={videoUrl}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onDurationChange={setDuration}
                onTimeUpdate={setCurrentTime}
                activeDescription={activeDescription}
              />
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel defaultSize="30%" minSize="15%">
              <Timeline
                analysis={analysis}
                duration={duration}
                currentTime={currentTime}
                zoom={zoom}
                selectedItem={selectedItem}
                onSelect={setSelectedItem}
                onSeek={handleSeek}
                onZoomChange={setZoom}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Detail Panel */}
        <ResizablePanel defaultSize="25%" minSize="15%">
          <DetailPanel
            analysis={analysis}
            selectedItem={selectedItem}
            onPlaySegment={handlePlaySegment}
            onSelect={setSelectedItem}
            onSeek={handleSeek}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
