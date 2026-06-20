import React, { useState, useEffect } from "react";
import { Screen } from "../../types";
import { api } from "../../api";

interface OnboardingScreensProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  addLog: (level: "INFO" | "SECURITY" | "WARN", msg: string) => void;
  accessToken: string | null;
  chatId: number | null;
  inviteCode: string | null;
  onChatCreated: (chatId: number, inviteCode: string) => void;
  onChatJoined: (chatId: number) => void;
}

export default function OnboardingScreens({
  currentScreen,
  onScreenChange,
  addLog,
  accessToken,
  chatId,
  inviteCode,
  onChatCreated,
  onChatJoined,
}: OnboardingScreensProps) {
  const [inputCode, setInputCode] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(899);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 899));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Create chat when entering OnboardingGenerate (if not already created)
  useEffect(() => {
    if (currentScreen !== Screen.OnboardingGenerate) return;
    if (!accessToken || inviteCode) return;

    api.createChat(accessToken)
      .then((result) => {
        onChatCreated(result.chat_id, result.invite_code);
        addLog("INFO", `채팅방 생성됨 (초대코드: ${result.invite_code})`);
      })
      .catch((err: any) => {
        const code = err?.error?.code ?? "UNKNOWN";
        // If user already has an active chat, fetch it
        if (code === "CHAT_ACTIVE_EXISTS") {
          api.getActiveChat(accessToken).then((active) => {
            if (active.active_chat_id) {
              onChatJoined(active.active_chat_id);
            }
          }).catch(() => {});
        } else {
          addLog("WARN", `채팅방 생성 실패: ${code}`);
        }
      });
  }, [currentScreen, accessToken, inviteCode]);

  // Poll for partner joining (status: active)
  useEffect(() => {
    if (currentScreen !== Screen.OnboardingGenerate) return;
    if (!accessToken || !chatId) return;

    const check = async () => {
      try {
        const active = await api.getActiveChat(accessToken);
        if (active.active_chat_id && active.status === "active") {
          addLog("SECURITY", "파트너가 연결되었습니다 (E2EE Active)");
          onChatJoined(active.active_chat_id);
        }
      } catch {}
    };

    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [currentScreen, accessToken, chatId]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    addLog("INFO", `초대 코드 [${inviteCode}] 복사됨`);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim() || !accessToken) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await api.joinChat(accessToken, inputCode.trim());
      addLog("SECURITY", `대칭 초대키 합의 통과`);
      addLog("INFO", "종단간 E2EE 터널 보안연결이 수립되었습니다 (E2EE Active)");
      onChatJoined(result.chat_id);
    } catch (err: any) {
      const code = err?.error?.code ?? "UNKNOWN";
      setJoinError(
        code === "CHAT_INVITE_NOT_FOUND" ? "초대코드를 찾을 수 없습니다." :
        code === "CHAT_INVITE_RATE_LIMITED" ? "너무 많이 시도했습니다. 잠시 후 다시 시도하세요." :
        code === "CHAT_ACTIVE_EXISTS" ? "이미 활성 채팅방이 있습니다." :
        `연결 실패: ${code}`
      );
      addLog("WARN", `연결 코드 오류: ${code}`);
    } finally {
      setJoining(false);
    }
  };

  if (currentScreen === Screen.OnboardingGenerate) {
    return (
      <div id="screen-onboarding-generate" className="absolute inset-0 bg-[#fbf9f6] z-10 px-6 py-8 flex flex-col justify-between overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-[#ffb3b0]/20 blur-[100px]"></div>
          <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[#dae3f3]/30 blur-[100px]"></div>
        </div>

        <header className="flex flex-col items-center space-y-4 text-center mt-6">
          <div className="w-24 h-24 rounded-full bg-white shadow-soft p-4 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-[#ff6b6b]" style={{ fontVariationSettings: "'FILL' 1" }}>
              favorite
            </span>
          </div>
          <h1 className="font-sans font-extrabold text-[24px] text-neutral-800 tracking-tight leading-snug">
            둘만의 안전한 공간을<br />만듭니다.
          </h1>
        </header>

        <div className="w-full bg-[#F5F0EA] rounded-[24px] shadow-soft p-6 flex flex-col space-y-8 z-10">
          <div className="flex bg-neutral-200/50 rounded-lg p-1 text-xs">
            <button
              type="button"
              className="flex-1 py-1.5 text-center font-bold bg-[#ffffff] rounded-md shadow-sm text-[#ff6b6b]"
            >
              내 코드
            </button>
            <button
              type="button"
              onClick={() => onScreenChange(Screen.OnboardingInput)}
              className="flex-1 py-1.5 text-center font-semibold text-neutral-500 hover:text-neutral-700"
            >
              코드 입력
            </button>
          </div>

          <div className="flex flex-col items-center space-y-3 pb-2 text-center">
            <p className="font-mono text-[11px] font-bold text-neutral-500 uppercase tracking-widest leading-none">초대 코드</p>
            <div className="px-8 py-4 bg-white rounded-2xl border-2 border-[#ff6b6b]/20 border-dashed">
              {inviteCode ? (
                <span className="font-mono text-2xl font-extrabold tracking-[0.05em] text-neutral-800 break-all">{inviteCode}</span>
              ) : (
                <span className="font-mono text-sm text-neutral-400">생성 중...</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            disabled={!inviteCode}
            className="w-full py-4 bg-[#ff6b6b] text-white rounded-full font-bold text-sm shadow-[0_8px_20px_rgba(255,107,107,0.3)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
            <span>코드 복사 및 공유</span>
          </button>

          <div className="flex flex-col items-center space-y-3 pt-4 border-t border-neutral-300 w-full">
            <div className="w-10 h-10 rounded-full bg-[#ffb3b0]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#ff6b6b] text-[20px] animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </div>
            <p className="font-sans text-[11px] font-medium text-neutral-500 text-center leading-relaxed">
              상대방이 코드를 입력할 때까지<br />대기해주세요.
            </p>
          </div>
        </div>

        <footer className="mt-auto pt-6 flex justify-center z-10">
          <button
            onClick={() => onScreenChange(Screen.Login)}
            className="text-xs text-neutral-500 font-medium hover:text-neutral-700 flex items-center gap-1"
          >
            <span>이미 계정이 있으신가요?</span>
            <span className="font-bold underline decoration-neutral-300 underline-offset-4">로그인</span>
          </button>
        </footer>
      </div>
    );
  }

  if (currentScreen === Screen.OnboardingInput) {
    return (
      <div id="screen-onboarding-input" className="absolute inset-0 bg-[#fbf9f6] z-10 px-6 py-6 flex flex-col justify-between overflow-y-auto">
        <header className="flex justify-between items-center py-4 bg-transparent border-b border-neutral-200/50">
          <h1 className="font-sans font-bold text-lg text-[#ae2f34] tracking-tight">SecureCouple</h1>
          <button
            type="button"
            onClick={() => onScreenChange(Screen.Login)}
            className="text-neutral-500 hover:bg-neutral-100 p-2 rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <div className="flex-1 flex flex-col pt-6 justify-between">
          <div className="text-center">
            <h2 className="font-sans font-bold text-xl text-neutral-800 leading-snug tracking-tight">파트너 연결하기</h2>
            <p className="font-sans text-xs text-neutral-400 mt-2 leading-relaxed px-2">
              상대방 기기에 표시된 초대코드를 입력하여 안전하게 연결하세요.
            </p>
          </div>

          <div className="flex rounded-lg bg-neutral-100 p-1 my-6 shadow-inner text-xs">
            <button
              type="button"
              onClick={() => onScreenChange(Screen.OnboardingGenerate)}
              className="flex-1 py-1.5 text-neutral-500 hover:text-neutral-700 font-medium transition-colors"
            >
              내 코드
            </button>
            <button
              type="button"
              className="flex-1 py-1.5 font-bold bg-white shadow-sm rounded-md text-[#ae2f34] transition-colors"
            >
              코드 입력
            </button>
          </div>

          <form onSubmit={handleConnectSubmit} className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-neutral-200/60 flex flex-col items-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <span className="material-symbols-outlined text-3xl text-neutral-500">dialpad</span>
            </div>

            {joinError && (
              <p className="text-xs text-red-500 font-semibold text-center mb-3 bg-red-50 py-2 px-3 rounded-lg w-full">{joinError}</p>
            )}

            <div className="w-full mb-4 relative group">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="초대코드 입력"
                className="w-full bg-[#fcf9f8] border-2 border-[#ff6b6b]/45 rounded-xl px-4 py-4 font-mono text-center text-lg font-bold text-neutral-800 uppercase tracking-widest focus:outline-none focus:border-[#ae2f34] transition-all shadow-inner"
              />
            </div>

            <div className="text-center text-xs text-neutral-500">
              유효시간 <span className="font-mono font-bold text-[#ae2f34]">{formatTimer(timerSeconds)}</span>
            </div>
          </form>

          <div className="flex-1" />

          <div className="mt-8">
            <button
              type="button"
              onClick={handleConnectSubmit}
              disabled={joining || !inputCode.trim()}
              className="w-full bg-[#ae2f34] hover:bg-[#ae2f34]/90 text-white py-4 rounded-full font-bold text-sm tracking-wide shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all flex justify-center items-center gap-1.5 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-lg">link</span>
              <span>{joining ? "연결 중..." : "연결하기"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
