import React, { useState, useEffect } from "react";
import {
  X,
  Globe,
  Camera,
  Play,
  Check,
  RefreshCw,
  Search,
  ExternalLink,
  Layers,
  Sparkles,
  ChevronRight,
  Loader2,
  Settings,
  Send,
  MousePointer,
  FileText,
} from "lucide-react";

interface BrowserControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRemoteDebugging?: () => void;
  onExecuteBrowserCommand?: (cmd: string) => void;
}

export const BrowserControlModal: React.FC<BrowserControlModalProps> = ({
  isOpen,
  onClose,
  onOpenRemoteDebugging,
  onExecuteBrowserCommand,
}) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("https://google.com");
  const [actionOutput, setActionOutput] = useState<string>("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Form filling state
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [submitBtn, setSubmitBtn] = useState("");

  // Click state
  const [clickTarget, setClickTarget] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/browser/status");
      const data = await res.json();
      setStatus(data);
      if (data.activeUrl) {
        setUrlInput(data.activeUrl);
      }
    } catch {
      setStatus({ isConnected: false });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const timer = setInterval(fetchStatus, 5000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = async (payload: any) => {
    setLoading(true);
    setActionOutput("");
    try {
      const res = await fetch("/api/browser/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setActionOutput(
        data.output ||
          (data.success ? "Action executed successfully." : "Action failed."),
      );
      if (data.screenshotPath) {
        setScreenshotUrl(
          `/api/file?path=${encodeURIComponent(data.screenshotPath)}`,
        );
      }
      await fetchStatus();
    } catch (e: any) {
      setActionOutput(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = () => {
    if (!urlInput.trim()) return;
    handleAction({ action: "navigate", url: urlInput.trim() });
  };

  const handleInspect = () => {
    handleAction({ action: "inspect" });
  };

  const handleScreenshot = () => {
    handleAction({ action: "screenshot" });
  };

  const handleClickElement = () => {
    if (!clickTarget.trim()) return;
    handleAction({ action: "click", text: clickTarget.trim() });
  };

  const handleAddField = () => {
    if (!fieldKey.trim()) return;
    setFormFields((prev) => ({ ...prev, [fieldKey.trim()]: fieldValue }));
    setFieldKey("");
    setFieldValue("");
  };

  const handleFillForm = () => {
    if (Object.keys(formFields).length === 0) return;
    handleAction({
      action: "fill_form",
      fields: formFields,
      submit: submitBtn.trim() || undefined,
    });
  };

  const isConnected = status?.isConnected;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121214] text-neutral-100 rounded-2xl w-full max-w-3xl shadow-2xl border border-neutral-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-[#18181b]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">
                  Browser Control Center
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    isConnected
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`}
                  />
                  <span>
                    {isConnected
                      ? `Connected (${status?.browserName || "Chrome"})`
                      : "Disconnected"}
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Manage tabs, fill interactive forms, click buttons, and inspect
                web elements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isConnected && (
              <button
                type="button"
                onClick={onOpenRemoteDebugging}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Remote Debugging Setup</span>
              </button>
            )}
            <button
              type="button"
              onClick={fetchStatus}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Address Bar */}
        <div className="p-4 border-b border-neutral-800 bg-[#141416] flex items-center gap-2">
          <div className="relative flex-1">
            <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
              placeholder="Enter web address (e.g. https://google.com)..."
              className="w-full bg-[#1e1e22] border border-neutral-700/80 rounded-xl pl-9 pr-4 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <button
            type="button"
            onClick={handleNavigate}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Go</span>
          </button>
          <button
            type="button"
            onClick={handleInspect}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
            title="Inspect interactive elements"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Inspect</span>
          </button>
          <button
            type="button"
            onClick={handleScreenshot}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
            title="Capture Screenshot"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Screenshot</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Active Tabs List */}
          {status?.tabs && status.tabs.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Open Browser Tabs ({status.tabs.length})</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {status.tabs.map((tab: any, i: number) => (
                  <button
                    key={tab.id || i}
                    type="button"
                    onClick={() => {
                      setUrlInput(tab.url);
                      handleAction({ action: "navigate", url: tab.url });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition text-left max-w-xs truncate"
                  >
                    <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
                    <span className="truncate">{tab.title || tab.url}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Filling & Click Automation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Form Autofill Box */}
            <div className="p-3.5 rounded-xl bg-[#18181b] border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Form Autofill</span>
                </span>
                {Object.keys(formFields).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormFields({})}
                    className="text-[10px] text-neutral-500 hover:text-neutral-300"
                  >
                    Clear fields
                  </button>
                )}
              </div>

              {/* Added Fields */}
              {Object.keys(formFields).length > 0 && (
                <div className="space-y-1 bg-black/30 p-2 rounded-lg border border-neutral-800/80">
                  {Object.entries(formFields).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono text-neutral-300">{k}:</span>
                      <span className="text-emerald-400 font-mono">"{v}"</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add field inputs */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Field (e.g. username)"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  className="w-1/2 bg-[#202024] border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 text-xs"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  className="w-1/2 bg-[#202024] border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Submit button text (optional, e.g. Submit, Log In)"
                  value={submitBtn}
                  onChange={(e) => setSubmitBtn(e.target.value)}
                  className="flex-1 bg-[#202024] border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddField}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                >
                  + Add
                </button>
              </div>

              <button
                type="button"
                onClick={handleFillForm}
                disabled={loading || Object.keys(formFields).length === 0}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>Fill Form & Submit</span>
              </button>
            </div>

            {/* Click Button / Link Box */}
            <div className="p-3.5 rounded-xl bg-[#18181b] border border-neutral-800 space-y-3">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <MousePointer className="w-3.5 h-3.5 text-blue-400" />
                <span>Click Button or Link</span>
              </span>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Type the button text (e.g. <i>"Submit"</i>, <i>"Save"</i>,{" "}
                <i>"Search"</i>) or CSS selector to click on the live page.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Button text or selector..."
                  value={clickTarget}
                  onChange={(e) => setClickTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleClickElement()}
                  className="flex-1 bg-[#202024] border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 text-xs"
                />
                <button
                  type="button"
                  onClick={handleClickElement}
                  disabled={loading || !clickTarget.trim()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
                >
                  Click
                </button>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    handleAction({ action: "press_key", key: "Enter" })
                  }
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                >
                  Press [Enter]
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAction({
                      action: "scroll",
                      direction: "down",
                      amount: 500,
                    })
                  }
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                >
                  Scroll Down
                </button>
                <button
                  type="button"
                  onClick={() => handleAction({ action: "close" })}
                  className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-900/40 transition"
                >
                  Close Browser
                </button>
              </div>
            </div>
          </div>

          {/* Action Output Console */}
          {actionOutput && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400">
                Action Result / Element Inspector
              </label>
              <pre className="p-3 rounded-xl bg-black/60 border border-neutral-800 font-mono text-[11px] text-neutral-300 overflow-x-auto max-h-48 whitespace-pre-wrap select-text">
                {actionOutput}
              </pre>
            </div>
          )}

          {/* Screenshot Preview */}
          {screenshotUrl && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400">
                Captured Screenshot
              </label>
              <div className="rounded-xl overflow-hidden border border-neutral-800 bg-black max-h-64 flex items-center justify-center">
                <img
                  src={screenshotUrl}
                  alt="Browser snapshot"
                  className="object-contain max-h-64 w-auto"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
