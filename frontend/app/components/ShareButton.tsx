"use client";

import { useState } from "react";
import { Player } from "@/lib/api";

type ShareButtonProps = {
  record: string | null;
  lineup: Record<string, Player | null>;
};

type Status = "idle" | "loading" | "error";

export default function ShareButton({ record, lineup }: ShareButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "unsupported" | "error">("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleShare = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/share-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record, lineup }),
      });
      if (!res.ok) throw new Error(`share-image request failed: ${res.status}`);
      const blob = await res.blob();

      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
      setIsModalOpen(true);
      setStatus("idle");
    } catch (err) {
      console.error("Failed to generate share image:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  const handleCopy = async () => {
    if (!imageBlob) return;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      setCopyStatus("unsupported");
      setTimeout(() => setCopyStatus("idle"), 2500);
      return;
    }
    setCopyStatus("copying");
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": imageBlob })]);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy image:", err);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2500);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setImageBlob(null);
    setCopyStatus("idle");
  };

  const copyLabel = {
    idle: "Copy to clipboard",
    copying: "Copying…",
    copied: "Copied ✓",
    unsupported: "Not supported on this browser",
    error: "Couldn't copy — try again",
  }[copyStatus];

  const shareLabel = {
    idle: "Share",
    loading: "Generating…",
    error: "Couldn't copy - try again",
  }[status];

  return (
    <>
      <button
        onClick={handleShare}
        disabled={status === "loading"}
        className="bg-[#21B8D6] text-white text-sm font-semibold px-6 py-2 rounded-md hover:bg-[#178399] transition-colors flex items-center justify-center gap-2"
      >
        <img 
          src={`/shareIcon.png`}
          alt=""
          className="w-4 h-4"
        />
        {shareLabel}
      </button>

      {isModalOpen && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-[#888] hover:text-[#111] text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-lg font-bold text-center mb-4">
              Share your team
            </h2>

            <img
              src={imageUrl}
              alt="Your lineup"
              className="w-full rounded-md border border-[#E5E5E5]"
            />

            <div className="flex justify-center mt-4">
              <button
                onClick={handleCopy}
                disabled={copyStatus === "copying"}
                className="bg-[#111111] text-white text-sm font-semibold px-6 py-2 rounded-md hover:bg-[#333] transition-colors disabled:opacity-50"
              >
                {copyLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}