import React, { useState } from "react";
import { flutterSnippets } from "../mockData";

export default function FlutterHelper() {
  const [activeTab, setActiveTab] = useState<"theme" | "widgets">("theme");
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentCode = activeTab === "theme" ? flutterSnippets.theme : flutterSnippets.blurShield;

  return (
    <div id="flutter-helper-root" className="bg-[#1e1e1e] rounded-2xl border border-white/10 p-5 text-[#d4d4d4] h-full flex flex-col justify-between">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-lg">flutter_dash</span>
            <h3 className="font-sans font-bold text-sm text-white tracking-tight">Flutter 통합 가이드</h3>
          </div>
          <button
            id="copy-code-btn"
            onClick={() => handleCopy(currentCode)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold tracking-wide transition-all"
          >
            <span className="material-symbols-outlined text-sm">{copied ? "done" : "content_copy"}</span>
            <span>{copied ? "복사 완료!" : "코드 복사"}</span>
          </button>
        </div>

        <p className="text-xs text-neutral-400 font-sans leading-relaxed">
          이 프로토타입 디자인은 Flutter의 Material Design 3 규격을 기준으로 설계되었습니다. 모바일 앱 구현 시 아래의 Dart 코드를 참조하세요.
        </p>

        {/* Tab selector */}
        <div className="flex bg-neutral-900 rounded-lg p-1 text-xs gap-1">
          <button
            id="tab-theme"
            onClick={() => setActiveTab("theme")}
            className={`flex-1 py-1.5 text-center font-medium rounded-md transition-all ${
              activeTab === "theme" ? "bg-white/10 text-white font-bold" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            디자인 테마 (Warm Sanctuary)
          </button>
          <button
            id="tab-widgets"
            onClick={() => setActiveTab("widgets")}
            className={`flex-1 py-1.5 text-center font-medium rounded-md transition-all ${
              activeTab === "widgets" ? "bg-white/10 text-white font-bold" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            보안 미디어 쉴드 (Double Blur)
          </button>
        </div>

        {/* Code Snippet Box */}
        <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 overflow-auto max-h-[380px] font-mono text-[11px] leading-relaxed text-emerald-400">
          <pre>{currentCode}</pre>
        </div>
      </div>

      <div className="border-t border-white/10 pt-3 mt-4 text-xs font-sans text-neutral-400 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-white">
          <span className="material-symbols-outlined text-xs text-amber-500">lightbulb</span>
          <span className="font-semibold text-[11px]">Flutter 개발 팁:</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          기대수명이 지정된 <strong>일회용 미디어(⏱️ 퐁!)</strong>는 로컬 디렉토리에 캐싱하지 않고, 네트워크 데이터 스트림만을 메모리 상에서 셰이더 혹은 픽셀 데이터(Uint8List) 형태로 파서(Parser)에 바인딩하여 캡처 차단 플래그(<span className="font-mono text-amber-300">FLAG_SECURE</span>)와 결합하는 것을 최우선으로 지향합니다.
        </p>
      </div>
    </div>
  );
}
