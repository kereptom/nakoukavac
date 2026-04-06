"use client";

import { forwardRef, useRef, useEffect, useCallback, useState } from "react";
import {
  Play, Pause, SkipBack, SkipForward,
  Rewind, FastForward, Maximize2, Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/utils";

interface VideoPlayerProps {
  videoUrl: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onTimeUpdate: (time: number) => void;
  activeDescription?: string | null;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  function VideoPlayer(
    {
      videoUrl,
      currentTime,
      duration,
      isPlaying,
      onPlayPause,
      onSeek,
      onDurationChange,
      onTimeUpdate,
      activeDescription,
    },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const setRefs = useCallback(
      (el: HTMLVideoElement | null) => {
        localRef.current = el;
        if (typeof forwardedRef === "function") {
          forwardedRef(el);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        }
      },
      [forwardedRef],
    );

    useEffect(() => {
      const video = localRef.current;
      if (!video || !videoUrl) return;
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, [isPlaying, videoUrl]);

    useEffect(() => {
      const handler = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", handler);
      return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    const handleToggleFullscreen = useCallback(() => {
      if (!containerRef.current) return;
      if (isFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }, [isFullscreen]);

    const handleSeek = useCallback(
      (time: number) => {
        const video = localRef.current;
        if (video) video.currentTime = time;
        onSeek(time);
      },
      [onSeek],
    );

    return (
      <div className="flex h-full flex-col bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview
          </h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleToggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>

        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center bg-black relative min-h-0 overflow-hidden"
        >
          {videoUrl ? (
            <video
              ref={setRefs}
              src={videoUrl}
              className="absolute inset-0 h-full w-full object-contain"
              onLoadedMetadata={() => {
                const v = localRef.current;
                if (v) onDurationChange(v.duration);
              }}
              onEnded={() => {
                onTimeUpdate(duration);
                if (isPlaying) onPlayPause();
              }}
              playsInline
            />
          ) : (
            <p className="text-sm text-muted-foreground/50">No video loaded</p>
          )}

          {videoUrl && activeDescription && (
            <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
              <p className="inline-block bg-black/75 text-white text-xs px-3 py-1 rounded max-w-[80%]">
                {activeDescription}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-border p-2 space-y-1.5">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 1}
            step={0.01}
            onValueChange={([v]) => handleSeek(v)}
            className="w-full"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatTime(currentTime)}
            </span>

            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSeek(0)} title="Go to start">
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSeek(Math.max(0, currentTime - 5))} title="Back 5s">
                <Rewind className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPlayPause} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSeek(Math.min(duration, currentTime + 5))} title="Forward 5s">
                <FastForward className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSeek(duration)} title="Go to end">
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </div>

            <span className="text-[10px] text-muted-foreground font-mono">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    );
  },
);
