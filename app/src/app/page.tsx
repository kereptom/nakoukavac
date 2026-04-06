"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Film, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrowserLayout } from "@/components/browser/browser-layout";
import { parseAnalysisJson } from "@/lib/load-analysis";
import type { VideoAnalysis } from "@/lib/types";

export default function Home() {
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleVideoFile = useCallback((file: File) => {
    setVideoFileName(file.name);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setError(null);
  }, []);

  const handleJsonFile = useCallback((file: File) => {
    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseAnalysisJson(reader.result as string);
        setAnalysis(parsed);
        setError(null);
      } catch (e) {
        setError(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith("video/") || file.name.match(/\.(mp4|mkv|mov|avi|webm)$/i)) {
          handleVideoFile(file);
        } else if (file.name.endsWith(".json") || file.name.endsWith(".nakoukavac.json")) {
          handleJsonFile(file);
        }
      }
    },
    [handleVideoFile, handleJsonFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // If both loaded, show the browser
  if (analysis && videoUrl) {
    return <BrowserLayout analysis={analysis} videoUrl={videoUrl} />;
  }

  // Loading screen
  return (
    <div
      className="flex h-screen items-center justify-center bg-background"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">AI Nakoukavac</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered video analysis browser using Gemma 4
          </p>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-4 hover:border-primary/50 transition-colors">
          <Upload className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Drop a video file and its <code>.nakoukavac.json</code> analysis here
          </p>
          <p className="text-xs text-muted-foreground/50">or use the buttons below</p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => videoInputRef.current?.click()}
          >
            <Film className="h-4 w-4" />
            {videoFileName ? (
              <span className="truncate text-xs">{videoFileName}</span>
            ) : (
              "Select Video"
            )}
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => jsonInputRef.current?.click()}
          >
            <FileJson className="h-4 w-4" />
            {jsonFileName ? (
              <span className="truncate text-xs">{jsonFileName}</span>
            ) : (
              "Select JSON"
            )}
          </Button>
        </div>

        {/* Status */}
        <div className="text-xs text-center space-y-1">
          {videoUrl && (
            <p className="text-emerald-500">Video loaded: {videoFileName}</p>
          )}
          {analysis && (
            <p className="text-cyan-500">
              Analysis loaded: {analysis.shots.length} shots, {analysis.scenes.length} scenes
            </p>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {(videoUrl || analysis) && !(videoUrl && analysis) && (
            <p className="text-muted-foreground">
              {!videoUrl ? "Now load the video file" : "Now load the .nakoukavac.json file"}
            </p>
          )}
        </div>

        <input
          ref={videoInputRef}
          type="file"
          className="hidden"
          accept="video/*,.mp4,.mkv,.mov,.avi,.webm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleVideoFile(file);
          }}
        />
        <input
          ref={jsonInputRef}
          type="file"
          className="hidden"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleJsonFile(file);
          }}
        />
      </div>
    </div>
  );
}
