import React, { useState, useRef, useEffect } from "react";
import { Screen, Message } from "../../types";
import { api, toFrontendMessage } from "../../api";

interface ChatRoomScreenProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  addLog: (level: "INFO" | "SECURITY" | "WARN", msg: string) => void;
  serverConnected: boolean;
  accessToken: string | null;
  loginId: string | null;
  chatId: number | null;
  onChatEnded: () => void;
}

export default function ChatRoomScreen({
  currentScreen,
  onScreenChange,
  messages,
  setMessages,
  isDrawerOpen,
  setIsDrawerOpen,
  addLog,
  accessToken,
  loginId,
  chatId,
  onChatEnded,
}: ChatRoomScreenProps) {
  const [inputText, setInputText] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [pressedItemId, setPressedItemId] = useState<string | null>(null);
  const [activeViewerUrl, setActiveViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentScreen]);

  // Poll messages every 3 seconds while in chat room
  useEffect(() => {
    if (currentScreen !== Screen.ChatRoom) return;
    if (!accessToken || !chatId || !loginId) return;

    const poll = async () => {
      try {
        const result = await api.listMessages(accessToken, chatId);
        const msgs = result.messages.map((m) => toFrontendMessage(m, loginId));
        setMessages(msgs);
      } catch (err: any) {
        const code = err?.error?.code;
        if (code === "AUTH_DEVICE_REPLACED") {
          addLog("SECURITY", "다른 기기에서 로그인됨 - 강제 로그아웃");
          onChatEnded();
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [accessToken, chatId, loginId, currentScreen]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !accessToken || !chatId || !loginId) return;
    const text = inputText.trim();
    setInputText("");

    try {
      const msg = await api.sendText(accessToken, chatId, text);
      setMessages((prev) => [...prev, toFrontendMessage(msg, loginId)]);
      addLog("INFO", `대화 패킷 전송 (${text.length * 2} Bytes)`);
    } catch (err: any) {
      const code = err?.error?.code ?? "UNKNOWN";
      addLog("WARN", `메시지 전송 실패: ${code}`);
      setInputText(text);
    }
  };

  const handleResetChat = async () => {
    if (!accessToken || !chatId) return;
    try {
      await api.resetChat(accessToken, chatId);
      addLog("SECURITY", "모든 로컬 세션 대화 내용 완전 파기 완료");
      setMessages([]);
    } catch (err: any) {
      addLog("WARN", `초기화 실패: ${err?.error?.code ?? "UNKNOWN"}`);
    }
    onScreenChange(Screen.ChatRoom);
  };

  const handleLeaveChat = async () => {
    if (!accessToken || !chatId) return;
    try {
      await api.leaveChat(accessToken, chatId);
      addLog("WARN", "E2EE 연결 강제 파쇄 및 채팅방 종료");
    } catch (err: any) {
      addLog("WARN", `채팅방 나가기 실패: ${err?.error?.code ?? "UNKNOWN"}`);
    }
    onChatEnded();
  };

  const handleOpenViewer = (url: string) => {
    setActiveViewerUrl(url);
    addLog("SECURITY", "일회용 원본 미디어 디렉토리 스트리밍 개시");
    onScreenChange(Screen.MediaViewer);
  };

  const handleDismissViewer = () => {
    setActiveViewerUrl(null);
    addLog("WARN", "일회용 미디어 원 소스 폐기 완료 (복구 불가능)");
    onScreenChange(Screen.ChatRoom);
  };

  if (currentScreen === Screen.ChatRoom) {
    return (
      <div id="screen-chatroom" className="absolute inset-0 bg-[#fbf9f6] flex flex-col justify-between overflow-hidden animate-fade-in">
        <header className="flex justify-between items-center w-full px-5 h-16 bg-white/90 backdrop-blur-md shadow-sm fixed top-0 left-0 z-40 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 cursor-pointer flex-shrink-0"
            >
              <img
                alt="Partner Profile"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdNAhu97_w8u_N9q27Scn4PWyExGWR85FY2gYio3VLJOUUW1ixR-mC-oCoWRrxENM7aMsM2Ub72v32Ptp3fCpuEYAllWAtf7UOh71lmSNJDbsUlR1mhxyZNHtVX8YTVnVoFzJaMqzNvyxGJYNq6DKSy7k8QAPULH4mkaB1pv4sGQ_sP3TIuq14Th3jfauvjlFINtkxEdFrQoj5VZiMTsTzQbCahPKLHUPrI0EW9Dqtll_3zMn1nEjAkYugH3CoG-e2tjlxaPDhBboH"
              />
            </button>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <h1 className="font-sans font-extrabold text-sm text-[#ae2f34] tracking-tight">채팅방 #{chatId}</h1>
                <span className="font-mono text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-[#1C2331] px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              <span className="font-mono text-[9px] font-bold text-white uppercase tracking-wider">보안 구역</span>
            </div>
            <button
              type="button"
              onClick={() => onScreenChange(Screen.ChatMenuSheet)}
              className="w-10 h-10 flex items-center justify-center text-[#ae2f34] rounded-full hover:bg-neutral-100 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">menu</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pt-20 pb-20 px-5 flex flex-col gap-4">
          <div className="flex justify-center my-3">
            <span className="bg-[#eae7e7]/70 text-[#584140] px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">오늘</span>
          </div>

          {messages.map((msg) => {
            const isMe = msg.sender === "me";
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isMe ? "justify-end" : "justify-start"} items-start gap-2.5 animate-fade-in`}
              >
                {!isMe && (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-200 mt-1 shrink-0">
                    <img
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdNAhu97_w8u_N9q27Scn4PWyExGWR85FY2gYio3VLJOUUW1ixR-mC-oCoWRrxENM7aMsM2Ub72v32Ptp3fCpuEYAllWAtf7UOh71lmSNJDbsUlR1mhxyZNHtVX8YTVnVoFzJaMqzNvyxGJYNq6DKSy7k8QAPULH4mkaB1pv4sGQ_sP3TIuq14Th3jfauvjlFINtkxEdFrQoj5VZiMTsTzQbCahPKLHUPrI0EW9Dqtll_3zMn1nEjAkYugH3CoG-e2tjlxaPDhBboH"
                    />
                  </div>
                )}

                <div className={`relative max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {msg.text && (
                    <div className={`p-3.5 rounded-2xl rounded-tr-sm shadow-soft text-xs font-semibold leading-relaxed border ${
                      isMe
                        ? "bg-[#ff6b6b] text-white border-[#ff6b6b]/10 rounded-tr-none"
                        : "bg-[#F5F0EA] text-neutral-800 border-neutral-200 shadow-sm rounded-tl-none"
                    }`}>
                      <p>{msg.text}</p>
                    </div>
                  )}

                  {msg.isMedia && (
                    <div className={`relative w-48 rounded-xl overflow-hidden shadow-md flex-shrink-0 cursor-pointer ${
                      isMe ? "rounded-tr-none" : "rounded-tl-none"
                    }`}>
                      <img
                        alt="E2EE Shared file"
                        referrerPolicy="no-referrer"
                        className="w-full h-36 object-cover"
                        src={msg.mediaUrl}
                      />

                      {msg.permissionType === "once" && (
                        <div
                          onMouseDown={() => setPressedItemId(msg.id)}
                          onMouseUp={() => setPressedItemId(null)}
                          onTouchStart={() => setPressedItemId(msg.id)}
                          onTouchEnd={() => setPressedItemId(null)}
                          onClick={() => handleOpenViewer(msg.mediaUrl || "")}
                          className={`absolute inset-0 blur-shield bg-[#1C2331]/95 flex flex-col items-center justify-center p-3 text-white transition-opacity duration-300 ${
                            pressedItemId === msg.id ? "opacity-0" : "opacity-100"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[#ffb3b0] text-2xl mb-1">timer</span>
                          <span className="font-sans font-extrabold text-[11px] text-[#ffb3b0]">열람 전 일회용 미디어</span>
                          <span className="text-[9px] text-white/60 mt-1 uppercase tracking-wider">누르고 있거나 더블클릭</span>
                        </div>
                      )}

                      {msg.permissionType === "replay" && (
                        <div
                          onClick={() => handleOpenViewer(msg.mediaUrl || "")}
                          className="absolute inset-0 bg-[#1C2331]/75 flex flex-col items-center justify-center text-white"
                        >
                          <span className="material-symbols-outlined text-white text-base">replay</span>
                          <span className="text-[10px] font-bold text-white/90">다시보기 가능 미디어</span>
                        </div>
                      )}
                    </div>
                  )}

                  <span className="font-mono text-[9px] text-neutral-400 mt-1 tracking-wider">{msg.time}</span>
                </div>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </main>

        <div className="fixed bottom-0 left-0 w-full z-40 bg-[#fcf9f8] pt-2 pb-safe border-t border-neutral-100 shrink-0">
          <form onSubmit={handleSendText} className="px-4 pb-4">
            <div className="flex items-center gap-2 bg-[#ffffff] border border-neutral-200/80 rounded-2xl p-2 shadow-sm">
              <button
                type="button"
                onClick={() => onScreenChange(Screen.MediaSelect)}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 rounded-full transition-colors"
                aria-label="첨부"
              >
                <span className="material-symbols-outlined text-[24px]">add</span>
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="보안 메시지를 입력하세요..."
                className="flex-1 bg-transparent border-none font-sans text-xs focus:ring-0 text-neutral-800 placeholder:text-neutral-400 focus:outline-none p-2"
              />

              <button
                type="submit"
                className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full shadow-md hover:scale-95 transition-transform ${
                  inputText.trim() ? "bg-[#ff6b6b] text-white" : "bg-neutral-100 text-neutral-400 pointer-events-none"
                }`}
                aria-label="보내기"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (currentScreen === Screen.MediaViewer) {
    return (
      <div id="screen-media-viewer" className="absolute inset-0 bg-[#313030] z-50 flex flex-col justify-between overflow-hidden animate-fade-in relative select-none">
        <div className="absolute inset-0 bg-black/80 z-0" />

        <div className="relative z-10 flex justify-between items-center px-5 py-4 w-full bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ae2f34] text-lg font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
            <span className="font-mono text-[10px] text-white tracking-widest font-bold">E2EE 보안 뷰어</span>
          </div>
          <button
            type="button"
            onClick={handleDismissViewer}
            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center p-5">
          <div className="relative w-full max-w-sm rounded-[16px] overflow-hidden shadow-2xl">
            <img
              alt="Secure file expanded"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-contain bg-neutral-900 border border-neutral-800"
              src={activeViewerUrl || ""}
            />
            <div className="absolute bottom-4 left-4 right-4 bg-red-800/90 text-white rounded-xl p-3 border border-red-500/20 shadow-lg backdrop-blur-md flex items-start gap-2.5">
              <span className="material-symbols-outlined text-sm font-bold text-[#ffdad8] mt-0.5">warning</span>
              <div className="flex flex-col text-left">
                <span className="font-mono text-[9px] font-bold text-[#ffdad8] tracking-widest">일회용 보호 조치 중</span>
                <span className="text-[10px] text-white/90 leading-tight mt-0.5">뷰어를 닫으면 이 사진 데이터가 메모리 상에서 회수 복구 불가능하게 원 소스 강제 파기됩니다.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full flex justify-center pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-neutral-700/50 px-4 py-1.5 rounded-full shadow-sm">
            <span className="material-symbols-outlined text-[14px] text-neutral-400">screenshot_monitor</span>
            <span className="font-mono text-[9px] tracking-widest uppercase text-neutral-400">스크린샷 차단 활성화</span>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === Screen.ChatMenuSheet) {
    return (
      <div id="screen-chat-menu-sheet" className="absolute inset-0 bg-[#313030]/60 z-50 flex flex-col justify-end">
        <div
          onClick={() => onScreenChange(Screen.ChatRoom)}
          className="absolute inset-0 bg-transparent"
        />

        <div className="bg-[#fbf9f6] rounded-t-[24px] shadow-2xl z-10 p-5 pb-safe flex flex-col animate-[slideUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-4" />

          <div className="text-center mb-6">
            <h2 className="font-sans font-extrabold text-neutral-800 text-base">안식처 채팅 설정</h2>
            <p className="font-sans text-[11px] text-neutral-400 mt-1">이 곳은 종단간(E2EE) 암호화 세션에 의해 완전 보호되고 있습니다.</p>
          </div>

          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleResetChat}
              className="w-full text-left flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:bg-[#F5F0EA] transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700 shadow-sm shrink-0">
                <span className="material-symbols-outlined text-lg">delete_sweep</span>
              </div>
              <div className="flex-1 py-1">
                <h4 className="font-bold text-xs text-neutral-800">대화 내용 초기화</h4>
                <p className="text-[10px] text-neutral-400 leading-normal mt-0.5">양쪽 기기에서 모든 패킷, 메시지, 미디어를 복구 불가능하게 원격 강제 초기화합니다.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleLeaveChat}
              className="w-full text-left flex items-start gap-4 p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-all text-white"
            >
              <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white shadow-sm shrink-0">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>logout</span>
              </div>
              <div className="flex-1 py-1">
                <h4 className="font-bold text-xs text-white">채팅방 나가기 (세션 파쇄)</h4>
                <p className="text-[10px] text-neutral-400 leading-normal mt-0.5">현재의 안전한 연결 세션을 탈동기화하고 즉시 패스시킵니다. 재연동 시 신규 코드가 필요합니다.</p>
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onScreenChange(Screen.ChatRoom)}
            className="w-full bg-[#f0eded] text-neutral-600 font-bold text-xs py-3.5 rounded-full hover:bg-neutral-200 transition-colors"
          >
            닫기
          </button>
        </div>
        <div className="h-4 bg-[#fbf9f6]" />

        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
