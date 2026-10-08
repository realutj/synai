import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  Globe,
  RefreshCw,
} from "lucide-react";

interface RemoteDebuggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedAnyway: () => void;
  onLaunchChrome?: () => void;
  onConnected?: () => void;
}

export const RemoteDebuggingModal: React.FC<RemoteDebuggingModalProps> = ({
  isOpen,
  onClose,
  onProceedAnyway,
  onLaunchChrome,
  onConnected,
}) => {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "checking" | "connected" | "error"
  >("idle");
  const [browserInfo, setBrowserInfo] = useState<string>("");
  const [launching, setLaunching] = useState(false);

  const debugUrl = "chrome://inspect/#remote-debugging";

  const handleCopy = () => {
    navigator.clipboard.writeText(debugUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkConnection = async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/browser/check", { method: "POST" });
      const data = await res.json();
      if (data.available) {
        setStatus("connected");
        setBrowserInfo(data.browser || "Google Chrome");
        if (onConnected) {
          setTimeout(onConnected, 800);
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleAutoLaunch = async () => {
    setLaunching(true);
    try {
      const res = await fetch("/api/browser/launch", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTimeout(checkConnection, 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLaunching(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Light card matching user's screenshot with high contrast */}
      <div className="bg-white dark:bg-[#18181b] text-neutral-800 dark:text-neutral-100 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            Remote Debugging Required
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-lg transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-3 space-y-3.5 text-[13px] leading-relaxed">
          <p className="text-neutral-600 dark:text-neutral-300">
            To use browser tools, you need to enable remote debugging:
          </p>

          <ol className="list-decimal list-outside ml-4 space-y-2 text-neutral-700 dark:text-neutral-200">
            <li>
              Open{" "}
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                Google Chrome
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-1.5">
              <span>Navigate to</span>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-xs text-neutral-800 dark:text-neutral-200">
                <span>{debugUrl}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded transition"
                  title="Copy URL"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-neutral-400" />
                  )}
                </button>
              </div>
            </li>
            <li>
              Enable{" "}
              <span className="font-semibold text-neutral-900 dark:text-white">
                "Allow remote debugging for this browser instance"
              </span>
              .
            </li>
          </ol>

          {/* Status feedback pill */}
          {status === "checking" && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Checking connection on port 9222...</span>
            </div>
          )}

          {status === "connected" && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>
                Connected to {browserInfo || "Chrome"} via Remote Debugging!
              </span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs">
              <span>Not detected yet on port 9222.</span>
              <button
                type="button"
                onClick={handleAutoLaunch}
                disabled={launching}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {launching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Auto-launch Chrome</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer buttons matching user screenshot */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-neutral-50/80 dark:bg-neutral-900/60 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onProceedAnyway}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-200/70 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition"
          >
            Proceed Anyway
          </button>
          <button
            type="button"
            onClick={checkConnection}
            disabled={status === "checking"}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#0284c7] hover:bg-[#0369a1] active:scale-98 transition flex items-center gap-1.5 shadow-sm"
          >
            {status === "checking" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <span>Check again</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
