import React from "react";
import { Screen, TelemetryLog } from "../types";

interface ControlPanelProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  logs: TelemetryLog[];
  onTriggerForcedLogout: () => void;
  onTriggerServerDisconnect: () => void;
  onResetChat: () => void;
  serverConnected: boolean;
}

export default function ControlPanel({
  currentScreen,
  onScreenChange,
  logs,
  onTriggerForcedLogout,
  onTriggerServerDisconnect,
  onResetChat,
  serverConnected,
}: ControlPanelProps) {
  const screensList = [
    { value: Screen.Splash, label: "🚀 스플래시 화면 (Splash)" },
    { value: Screen.Login, label: "🔑 로그인 화면 (Login)" },
    { value: Screen.Signup, label: "✍️ 회원가입 화면 (Signup)" },
    { value: Screen.OnboardingGenerate, label: "🎫 초대 코드 생성 (Onboarding)" },
    { value: Screen.OnboardingInput, label: "⌨️ 초대 코드 입력 (Connect)" },
    { value: Screen.ChatRoom, label: "💬 보안 비밀 채팅방 (Chat Room)" },
    { value: Screen.MediaSelect, label: "🖼️ 미디어 갤러리 선택 (Gallery)" },
    { value: Screen.PermissionSheet, label: "📦 열람 권한 설정 (BottomSheet)" },
    { value: Screen.MediaViewer, label: "🚨 일회용 미디어 뷰어 (Viewer)" },
    { value: Screen.ChatMenuSheet, label: "⚙️ 채팅방 설정/관리 (MenuSheet)" },
    { value: Screen.Settings, label: "🛡️ 개인정보 & 보안설정 (Settings)" },
    { value: Screen.ForcedLogout, label: "⚠️ 다른기기 로그인 아웃 (Forced Logout)" },
  ];

  return (
    <div id="control-panel-root" className="bg-[#151515] border border-white/10 rounded-2xl p-5 text-white flex flex-col gap-5 h-full">
      {/* Target screen picker */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[#ae2f34] text-lg">dashboard</span>
          <h3 className="font-bold text-sm">기기 즉시 이동 (Screen Jumper)</h3>
        </div>
        <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
          앱의 흐름대로 조작하지 않고도, 아래 메뉴를 더블클릭 하거나 단일 갱신하여 12개 시안 화면으로 즉시 이동하여 디자인 렌더링 상태를 편하게 분석할 수 있습니다.
        </p>

        <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
          {screensList.map((sc) => (
            <button
              id={`screen-btn-${sc.value}`}
              key={sc.value}
              onClick={() => onScreenChange(sc.value)}
              className={`w-full text-left py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-between ${
                currentScreen === sc.value
                  ? "bg-neutral-800 text-white border-l-4 border-[#ae2f34] font-semibold"
                  : "bg-neutral-900 border border-white/5 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span>{sc.label}</span>
              {currentScreen === sc.value && (
                <span className="w-1.5 h-1.5 bg-[#ae2f34] rounded-full animate-ping" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Security triggers */}
      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-amber-500 text-lg">bolt</span>
          <h3 className="font-bold text-sm">실시간 이벤트 트리거 (Mock Simulators)</h3>
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              id="trigger-logout-btn"
              onClick={onTriggerForcedLogout}
              className="bg-neutral-900 hover:bg-neutral-800 border border-white/5 text-red-400 hover:text-red-300 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-xs">gpp_maybe</span>
              <span>강제 로그아웃</span>
            </button>
            <button
              id="trigger-disconnect-btn"
              onClick={onTriggerServerDisconnect}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                serverConnected
                  ? "bg-neutral-900 hover:bg-neutral-800 border-white/5 text-amber-400 hover:text-amber-300"
                  : "bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-900 text-emerald-400"
              }`}
            >
              <span className="material-symbols-outlined text-xs">wifi_off</span>
              <span>{serverConnected ? "서버 끊기" : "서버 복구"}</span>
            </button>
          </div>
          <button
            id="reset-chat-btn"
            onClick={onResetChat}
            className="w-full bg-[#ae2f34]/15 hover:bg-[#ae2f34]/25 text-[#ffdad8] text-xs py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-xs">delete_sweep</span>
            <span>채팅 기록 기본값으로 리셋</span>
          </button>
        </div>
      </div>

      {/* Telemetry log viewer */}
      <div className="border-t border-white/10 pt-4 flex-1 flex flex-col justify-end">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-neutral-400">SecureCouple Console TLS v1.3</span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${serverConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[10px] text-neutral-500 font-mono">{serverConnected ? "ACTIVE" : "OFFLINE"}</span>
          </span>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 h-[140px] overflow-y-auto font-mono text-[10px] flex flex-col gap-1.5 scrollbar-thin">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-1.5 leading-relaxed">
              <span className="text-neutral-600">{log.timestamp}</span>
              <span className={
                log.level === "SECURITY" ? "text-emerald-400" :
                log.level === "WARN" ? "text-red-400" : "text-sky-400"
              }>
                [{log.level}]
              </span>
              <span className="text-neutral-300 break-all">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
