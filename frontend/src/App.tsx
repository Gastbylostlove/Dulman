import React, { useState, useMemo } from "react";
import { Screen, Message, TelemetryLog } from "./types";
import DeviceSimulator from "./components/DeviceSimulator";
import ControlPanel from "./components/ControlPanel";
import FlutterHelper from "./components/FlutterHelper";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.Splash);
  const [serverConnected, setServerConnected] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<TelemetryLog[]>([
    { id: "log-1", timestamp: "10:24:00", level: "INFO", message: "시큐어커플 암호화 가상 샌드박스 가동 시작" },
    { id: "log-2", timestamp: "10:24:01", level: "SECURITY", message: "E2EE 터널 대칭키 생성 및 키교환 대기" },
    { id: "log-3", timestamp: "10:24:02", level: "INFO", message: "터치 햅틱 피드백 리스너 마운트 완료" },
  ]);

  // Auth state
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const deviceId = useMemo(() => {
    const key = "sc_device_id";
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, id);
    return id;
  }, []);

  const addLog = (level: "INFO" | "SECURITY" | "WARN", message: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("ko-KR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    setLogs((prev) => [
      ...prev,
      { id: `log-${Math.random()}`, timestamp, level, message }
    ]);
  };

  const handleScreenChange = (screen: Screen) => {
    setCurrentScreen(screen);
    addLog("INFO", `가상 디바이스 뷰포트 전환 됨: [${screen}]`);
  };

  const handleAuthSuccess = (token: string, id: string, activeChatId: number | null) => {
    setAccessToken(token);
    setLoginId(id);
    addLog("SECURITY", `인증 완료 (ID: ${id})`);
    if (activeChatId) {
      setChatId(activeChatId);
      handleScreenChange(Screen.ChatRoom);
    } else {
      handleScreenChange(Screen.OnboardingGenerate);
    }
  };

  const handleChatCreated = (id: number, code: string) => {
    setChatId(id);
    setInviteCode(code);
    addLog("INFO", `채팅방 생성됨 (ID: ${id})`);
  };

  const handleChatJoined = (id: number) => {
    setChatId(id);
    setInviteCode(null);
    handleScreenChange(Screen.ChatRoom);
    addLog("SECURITY", `채팅 연결 성공 (ID: ${id})`);
  };

  const handleChatEnded = () => {
    setChatId(null);
    setInviteCode(null);
    setMessages([]);
    handleScreenChange(Screen.OnboardingGenerate);
  };

  const handleLogout = () => {
    setAccessToken(null);
    setLoginId(null);
    setChatId(null);
    setInviteCode(null);
    setMessages([]);
    handleScreenChange(Screen.Login);
  };

  const handleTriggerServerDisconnect = () => {
    const nextVal = !serverConnected;
    setServerConnected(nextVal);
    addLog(
      nextVal ? "INFO" : "WARN",
      nextVal ? "보안 릴레이 노드 합의 복구 성공 (E2EE 재확립)" : "보안 릴레이 소켓 오류로 실시간 스트림 상실 제안"
    );
  };

  const handleTriggerForcedLogout = () => {
    setCurrentScreen(Screen.ForcedLogout);
    setAccessToken(null);
    setLoginId(null);
    setChatId(null);
    setInviteCode(null);
    setMessages([]);
    addLog("SECURITY", "외부 변조 접근 감지로 인한 현재 기기 세션 강제 탈동화(로그아웃) 지시 수령");
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-[#F5F0EA] flex flex-col justify-between font-sans selection:bg-[#ff6b6b]/30 selection:text-neutral-800">

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 py-8 lg:py-12 flex flex-col gap-8">

        <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#e0bfbd]/45 pb-5">
          <div className="text-left select-none">
            <div className="flex items-center gap-2">
              <span className="bg-[#ae2f34]/10 text-[#ae2f34] text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border border-[#ae2f34]/20">
                Flutter M3 Simulator
              </span>
              <span className="font-mono text-neutral-400 text-xs">Sandbox Mode</span>
            </div>
            <h1 className="font-sans font-black text-3xl md:text-4xl text-neutral-900 mt-2 tracking-tight leading-none">
              시큐어커플 - SecureCouple
            </h1>
            <p className="font-sans text-xs md:text-sm font-semibold text-neutral-500 mt-1.5 leading-relaxed">
              종단간(E2EE) 암호화 퐁-미디어와 프라이버시 쉴드를 결합한 플러터 시뮬레이션 제어 센터
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          <section className="lg:col-span-5 flex justify-center py-2 animate-[fadeIn_0.5s_ease-out_forwards]">
            <DeviceSimulator
              currentScreen={currentScreen}
              onScreenChange={handleScreenChange}
              logs={logs}
              addLog={addLog}
              serverConnected={serverConnected}
              onTriggerServerDisconnect={handleTriggerServerDisconnect}
              messages={messages}
              setMessages={setMessages}
              accessToken={accessToken}
              loginId={loginId}
              deviceId={deviceId}
              chatId={chatId}
              inviteCode={inviteCode}
              onAuthSuccess={handleAuthSuccess}
              onChatCreated={handleChatCreated}
              onChatJoined={handleChatJoined}
              onChatEnded={handleChatEnded}
              onLogout={handleLogout}
            />
          </section>

          <section className="lg:col-span-7 flex flex-col gap-6 w-full h-[812px] justify-between">

            <div className="flex-1 min-h-0">
              <ControlPanel
                currentScreen={currentScreen}
                onScreenChange={handleScreenChange}
                logs={logs}
                onResetChat={handleClearLogs}
                serverConnected={serverConnected}
                onTriggerServerDisconnect={handleTriggerServerDisconnect}
                onTriggerForcedLogout={handleTriggerForcedLogout}
              />
            </div>

            <div className="flex-shrink-0 h-[360px]">
              <FlutterHelper />
            </div>

          </section>

        </div>

      </main>

      <footer className="w-full bg-[#fcf9f8] border-t border-neutral-200/50 py-5 text-center mt-12 flex-shrink-0 select-none">
        <p className="font-sans text-[11px] text-neutral-400 font-medium tracking-wide">
          시큐어커플 &copy; 2026. Designed with Warm Sanctuary Aesthetic. Optimized for Node.js Applet Production.
        </p>
      </footer>
    </div>
  );
}
