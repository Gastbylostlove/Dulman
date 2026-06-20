import React, { useState } from "react";
import { Screen, Message, TelemetryLog } from "../types";
import AuthScreens from "./screens/AuthScreens";
import OnboardingScreens from "./screens/OnboardingScreens";
import SettingsScreen from "./screens/SettingsScreen";
import GalleryScreen from "./screens/GalleryScreen";
import ChatRoomScreen from "./screens/ChatRoomScreen";
import { photoGallery } from "../mockData";

interface DeviceSimulatorProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  logs: TelemetryLog[];
  addLog: (level: "INFO" | "SECURITY" | "WARN", msg: string) => void;
  serverConnected: boolean;
  onTriggerServerDisconnect: () => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  accessToken: string | null;
  loginId: string | null;
  deviceId: string;
  chatId: number | null;
  inviteCode: string | null;
  onAuthSuccess: (accessToken: string, loginId: string, activeChatId: number | null) => void;
  onChatCreated: (chatId: number, inviteCode: string) => void;
  onChatJoined: (chatId: number) => void;
  onChatEnded: () => void;
  onLogout: () => void;
}

export default function DeviceSimulator({
  currentScreen,
  onScreenChange,
  addLog,
  serverConnected,
  onTriggerServerDisconnect,
  messages,
  setMessages,
  accessToken,
  loginId,
  deviceId,
  chatId,
  inviteCode,
  onAuthSuccess,
  onChatCreated,
  onChatJoined,
  onChatEnded,
  onLogout,
}: DeviceSimulatorProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<"once" | "replay" | "keep">("keep");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleTogglePhoto = (id: string) => {
    setSelectedPhotos((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleConfirmSendPhotos = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

    const newMediaMessages: Message[] = selectedPhotos.map((photoId, idx) => {
      const match = photoGallery.find((p) => p.id === photoId);
      return {
        id: `media-${Math.random()}-${idx}`,
        sender: "me",
        time: timeStr,
        isMedia: true,
        mediaUrl: match?.url || photoGallery[0].url,
        permissionType: selectedPermission,
        revealed: selectedPermission === "keep" ? true : false,
        clicksCount: 0
      };
    });

    setMessages((prev) => [...prev, ...newMediaMessages]);
    addLog("SECURITY", `미디어 전송 완료 (수량: ${selectedPhotos.length}개, 등급: ${
      selectedPermission === "once" ? "일회용(Once)" : selectedPermission === "replay" ? "다시보기(Replay)" : "보관(Keep)"
    })`);

    setSelectedPhotos([]);
    onScreenChange(Screen.ChatRoom);
  };

  const handleConfirmLogout = () => {
    addLog("WARN", "세션 수동 초기화 성공");
    onLogout();
  };

  return (
    <div id="device-frame" className="relative w-full max-w-[375px] h-[812px] bg-[#fbf9f8] rounded-[48px] shadow-[0_24px_50px_rgba(28,35,49,0.3)] border-[8px] border-neutral-900 overflow-hidden flex flex-col font-sans select-none my-auto">

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-[28px] bg-neutral-900 rounded-b-2xl z-[100] flex items-center justify-center">
        <div className="w-12 h-[3px] bg-neutral-800 rounded-full mb-1" />
        <div className="absolute right-4 top-2 w-[5px] h-[5px] bg-[#1a1a1a] rounded-full" />
      </div>

      <div className="h-10 bg-transparent flex justify-between items-end px-6 pb-1 text-[10px] font-bold text-neutral-800 tracking-tight z-[99]">
        <span>오전 10:24</span>
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px] font-bold">network_wifi</span>
          <span className="material-symbols-outlined text-[12px] font-bold text-green-600">signal_cellular_alt</span>
          <span className="material-symbols-outlined text-[13px] text-green-600">battery_5_bar</span>
        </div>
      </div>

      {!serverConnected && (
        <div className="absolute inset-0 bg-neutral-900/60 z-[95] backdrop-blur-md flex items-center justify-center p-6 text-center animate-fade-in">
          <div className="bg-white p-6 rounded-3xl max-w-[280px] flex flex-col items-center space-y-4 shadow-xl border border-neutral-200">
            <div className="w-12 h-12 rounded-full bg-red-150 flex items-center justify-center text-red-600 animate-pulse">
              <span className="material-symbols-outlined text-2xl font-bold">cell_tower</span>
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-neutral-900 leading-snug">실시간 서버 채널 종료됨</h3>
              <p className="font-sans text-[10px] text-neutral-500 mt-2 leading-relaxed">
                시큐어커플 원격 릴레이 노드와의 데이터 암호화 스트림 합의가 상실되었습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onTriggerServerDisconnect}
              className="w-full bg-[#ae2f34] hover:bg-[#ae2f34]/95 text-white py-2.5 rounded-xl font-bold text-xs"
            >
              대칭 시그널 재연결 시도
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 relative flex flex-col overflow-hidden">

        {isDrawerOpen && (
          <>
            <div
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/40 z-[91] backdrop-blur-[1px] transition-all"
            />
            <aside className="absolute inset-y-0 left-0 w-[240px] bg-[#fcf9f8] shadow-2xl z-[92] p-5 flex flex-col justify-between animate-[slideRightDrawer_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 pt-6">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-200 shadow-sm border-2 border-white">
                    <img
                      alt="Partner profile avatar"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdNAhu97_w8u_N9q27Scn4PWyExGWR85FY2gYio3VLJOUUW1ixR-mC-oCoWRrxENM7aMsM2Ub72v32Ptp3fCpuEYAllWAtf7UOh71lmSNJDbsUlR1mhxyZNHtVX8YTVnVoFzJaMqzNvyxGJYNq6DKSy7k8QAPULH4mkaB1pv4sGQ_sP3TIuq14Th3jfauvjlFINtkxEdFrQoj5VZiMTsTzQbCahPKLHUPrI0EW9Dqtll_3zMn1nEjAkYugH3CoG-e2tjlxaPDhBboH"
                    />
                  </div>
                  <div>
                    <h2 className="font-sans font-bold text-base text-neutral-800">{loginId ?? "사용자"}</h2>
                    <p className="text-[10px] text-neutral-500 font-medium">안식처 연동 중</p>
                    <p className="font-mono text-[8px] text-[#ae2f34] uppercase font-bold tracking-wider mt-1.5 bg-[#ae2f34]/10 px-2 py-0.5 rounded w-max">보안 등급: 7 (E2EE)</p>
                  </div>
                </div>

                <nav className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setIsDrawerOpen(false); onScreenChange(Screen.ChatRoom); }}
                    className="flex items-center gap-3 p-3 rounded-xl text-neutral-700 hover:bg-neutral-100 text-left transition-all"
                  >
                    <span className="material-symbols-outlined text-neutral-500 text-lg">chat_bubble</span>
                    <span className="text-xs font-bold">안전 채팅방</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsDrawerOpen(false); onScreenChange(Screen.MediaSelect); }}
                    className="flex items-center gap-3 p-3 rounded-xl text-neutral-700 hover:bg-neutral-100 text-left transition-all"
                  >
                    <span className="material-symbols-outlined text-neutral-500 text-lg">grid_view</span>
                    <span className="text-xs font-bold">미디어 보관함</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsDrawerOpen(false); onScreenChange(Screen.Settings); }}
                    className="flex items-center gap-3 p-3 rounded-xl text-neutral-700 hover:bg-neutral-100 text-left transition-all"
                  >
                    <span className="material-symbols-outlined text-neutral-500 text-lg">shield_person</span>
                    <span className="text-xs font-bold">보안 및 프라이버시</span>
                  </button>
                </nav>
              </div>

              <div className="border-t border-neutral-200 pt-3 mb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsDrawerOpen(false); onLogout(); }}
                  className="flex items-center gap-3 p-2.5 rounded-xl text-red-600 hover:bg-red-50 text-left w-full transition-all"
                >
                  <span className="material-symbols-outlined text-red-500 text-lg">logout</span>
                  <span className="text-xs font-bold">세션 강제 종료</span>
                </button>
              </div>
            </aside>
          </>
        )}

        {(currentScreen === Screen.Splash || currentScreen === Screen.Login || currentScreen === Screen.Signup) && (
          <AuthScreens
            currentScreen={currentScreen}
            onScreenChange={onScreenChange}
            addLog={addLog}
            deviceId={deviceId}
            onAuthSuccess={onAuthSuccess}
          />
        )}

        {(currentScreen === Screen.OnboardingGenerate || currentScreen === Screen.OnboardingInput) && (
          <OnboardingScreens
            currentScreen={currentScreen}
            onScreenChange={onScreenChange}
            addLog={addLog}
            accessToken={accessToken}
            chatId={chatId}
            inviteCode={inviteCode}
            onChatCreated={onChatCreated}
            onChatJoined={onChatJoined}
          />
        )}

        {(currentScreen === Screen.ChatRoom || currentScreen === Screen.MediaViewer || currentScreen === Screen.ChatMenuSheet) && (
          <ChatRoomScreen
            currentScreen={currentScreen}
            onScreenChange={onScreenChange}
            messages={messages}
            setMessages={setMessages}
            isDrawerOpen={isDrawerOpen}
            setIsDrawerOpen={setIsDrawerOpen}
            addLog={addLog}
            serverConnected={serverConnected}
            accessToken={accessToken}
            loginId={loginId}
            chatId={chatId}
            onChatEnded={onChatEnded}
          />
        )}

        {(currentScreen === Screen.MediaSelect || currentScreen === Screen.PermissionSheet) && (
          <GalleryScreen
            currentScreen={currentScreen}
            onScreenChange={onScreenChange}
            selectedPhotos={selectedPhotos}
            onTogglePhoto={handleTogglePhoto}
            selectedPermission={selectedPermission}
            onPermissionChange={setSelectedPermission}
            onConfirmSend={handleConfirmSendPhotos}
          />
        )}

        {(currentScreen === Screen.Settings || currentScreen === Screen.ForcedLogout) && (
          <SettingsScreen
            currentScreen={currentScreen}
            onScreenChange={onScreenChange}
            onConfirmLogout={handleConfirmLogout}
            addLog={addLog}
          />
        )}

      </div>

      <style>{`
        @keyframes slideRightDrawer {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
