import React, { useState } from "react";
import { Screen } from "../../types";
import { api } from "../../api";

interface AuthScreensProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  addLog: (level: "INFO" | "SECURITY" | "WARN", msg: string) => void;
  deviceId: string;
  onAuthSuccess: (accessToken: string, loginId: string, activeChatId: number | null) => void;
}

export default function AuthScreens({
  currentScreen,
  onScreenChange,
  addLog,
  deviceId,
  onAuthSuccess,
}: AuthScreensProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(loginId.trim(), password, deviceId);
      addLog("SECURITY", `사용자 인증 접속 성공 (ID: ${result.login_id})`);
      onAuthSuccess(result.access_token, result.login_id, result.active_chat_id);
    } catch (err: any) {
      const code = err?.error?.code ?? "UNKNOWN";
      setError(code === "AUTH_INVALID_CREDENTIALS" ? "아이디 또는 비밀번호가 올바르지 않습니다." : `오류: ${code}`);
      addLog("WARN", `로그인 실패: ${code}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !signupPassword) return;
    if (signupPassword !== signupConfirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.signup(loginId.trim(), signupPassword);
      const result = await api.login(loginId.trim(), signupPassword, deviceId);
      addLog("SECURITY", `신규 암호화 보안 계정 생성 (ID: ${result.login_id})`);
      onAuthSuccess(result.access_token, result.login_id, result.active_chat_id);
    } catch (err: any) {
      const code = err?.error?.code ?? "UNKNOWN";
      setError(code === "AUTH_LOGIN_ID_DUPLICATED" ? "이미 사용 중인 아이디입니다." : `오류: ${code}`);
      addLog("WARN", `회원가입 실패: ${code}`);
    } finally {
      setLoading(false);
    }
  };

  if (currentScreen === Screen.Splash) {
    return (
      <div id="screen-splash" className="absolute inset-0 bg-[#fcf9f8] flex flex-col justify-between items-center px-6 py-12 z-10 animate-fade-in">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#eae7e7] rounded-full blur-[100px] opacity-40"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#ffdad8] rounded-full blur-[120px] opacity-20"></div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center z-10">
          <div className="w-32 h-32 mb-8 flex items-center justify-center bg-[#f6f3f2] rounded-[2.5rem] shadow-soft border border-[#e0bfbd]/35 pulse-logo">
            <span className="material-symbols-outlined text-[64px] text-[#ae2f34]" style={{ fontVariationSettings: "'FILL' 1" }}>
              enhanced_encryption
            </span>
          </div>
          <h1 className="font-sans font-bold text-[32px] md:text-3.5xl text-neutral-900 tracking-tight text-center">SecureCouple</h1>
          <p className="font-sans text-[17px] font-medium text-neutral-500 mt-2 text-center max-w-[280px]">우리만의 디지털 안식처</p>
        </div>

        <div
          onClick={() => onScreenChange(Screen.Login)}
          className="z-10 pb-16 pt-8 w-full flex flex-col items-center justify-end cursor-pointer group"
        >
          <div className="w-48 h-1 bg-neutral-200 rounded-full overflow-hidden relative mb-4">
            <div className="absolute top-0 left-0 h-full bg-[#ae2f34] rounded-full w-1/3 animate-[slideRight_1.5s_infinite_ease-in-out]" />
          </div>
          <div className="font-mono text-xs text-neutral-500 tracking-widest uppercase transition-colors group-hover:text-[#ae2f34]">
            보안 연결 중...
          </div>
        </div>

        <style>{`
          @keyframes slideRight {
            0% { left: -30%; width: 30%; }
            50% { left: 40%; width: 50%; }
            100% { left: 100%; width: 30%; }
          }
        `}</style>
      </div>
    );
  }

  if (currentScreen === Screen.Login) {
    return (
      <div id="screen-login" className="absolute inset-0 bg-[#fcf9f8] px-6 py-8 z-10 flex flex-col justify-between overflow-y-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#ff6b6b]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-col items-center text-center mt-12 z-10">
          <div className="w-24 h-24 mb-6 rounded-2xl overflow-hidden shadow-soft bg-[#eae7e7]">
            <img
              alt="SecureCouple Brand Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida/AP1WRLt-slyvSPjKwuY9vGDVCJ-qpfNKPIfKBK-qyNWUCpcoVxRQKPO0IUwDsCt7FzZyiyy_P_D8NZI0cx3-aub-h04gYQX-TTgwY_ZJR2miHKLGmcsY4Xn4aQESZglyp4wFloFMsjc0UqoqWv6N9q_pbrzm86Ygw5rnOeTNqtyyDU6ObF04vef3F2YtII7oKT6sJVOy9d-F98OvApis56fSJlMif1wABfTcGVaUGt9xJC50MsD6OSFPm2Nno6E"
            />
          </div>
          <h2 className="font-sans font-bold text-2xl text-neutral-900 tracking-tight leading-snug px-2">
            당신만의 공간으로 돌아오신 것을 환영합니다.
          </h2>
          <p className="text-xs font-semibold text-neutral-400 mt-2">접속을 위해 정보를 입력하세요.</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4 my-6 z-10">
          {error && (
            <p className="text-xs text-red-500 font-semibold text-center bg-red-50 py-2 rounded-lg">{error}</p>
          )}
          <div className="relative">
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="보안 아이디 (ID)"
              className="w-full bg-[#ffffff] border border-[#e0bfbd] rounded-xl px-4 py-4 text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#ae2f34] focus:ring-1 focus:ring-[#ae2f34] transition-all shadow-sm"
              required
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full bg-[#ffffff] border border-[#e0bfbd] rounded-xl px-4 py-4 text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#ae2f34] focus:ring-1 focus:ring-[#ae2f34] transition-all shadow-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility" : "visibility_off"}
              </span>
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff6b6b] hover:bg-[#ae2f34] text-white py-4 mt-2 rounded-full font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-60"
          >
            <span>{loading ? "로그인 중..." : "로그인"}</span>
          </button>
        </form>

        <div className="flex flex-col items-center gap-4 pb-4 z-10">
          <button type="button" className="text-xs font-medium text-neutral-500 hover:text-[#ae2f34] transition-colors">비밀번호 찾기</button>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>처음이신가요?</span>
            <button
              type="button"
              onClick={() => { setError(null); onScreenChange(Screen.Signup); }}
              className="text-[#ae2f34] hover:text-[#ff6b6b] font-bold text-xs"
            >
              회원가입
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 bg-[#f6f3f2] px-4 py-2 rounded-full border border-[#e5e2e1] shadow-sm">
            <span className="material-symbols-outlined text-[#ae2f34] text-[16px] font-bold">lock</span>
            <span className="font-mono text-[9px] font-semibold text-neutral-600 uppercase tracking-widest">보안 로그인 활성화됨</span>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === Screen.Signup) {
    return (
      <div id="screen-signup" className="absolute inset-0 bg-[#fcf9f8] px-6 py-6 z-10 flex flex-col justify-between overflow-y-auto">
        <header className="flex justify-between items-center py-4 w-full">
          <button
            type="button"
            onClick={() => { setError(null); onScreenChange(Screen.Login); }}
            className="w-10 h-10 flex items-center justify-start rounded-full hover:bg-neutral-100 -ml-3 transition-colors"
          >
            <span className="material-symbols-outlined text-neutral-600">arrow_back</span>
          </button>
          <h1 className="font-sans font-bold text-lg text-[#ae2f34]">회원가입</h1>
          <div className="w-10" />
        </header>

        <div className="flex flex-col items-center my-4">
          <div className="mb-8 w-24 h-24 rounded-2xl overflow-hidden shadow-soft">
            <img
              alt="SecureCouple Brand Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida/AP1WRLt-slyvSPjKwuY9vGDVCJ-qpfNKPIfKBK-qyNWUCpcoVxRQKPO0IUwDsCt7FzZyiyy_P_D8NZI0cx3-aub-h04gYQX-TTgwY_ZJR2miHKLGmcsY4Xn4aQESZglyp4wFloFMsjc0UqoqWv6N9q_pbrzm86Ygw5rnOeTNqtyyDU6ObF04vef3F2YtII7oKT6sJVOy9d-F98OvApis56fSJlMif1wABfTcGVaUGt9xJC50MsD6OSFPm2Nno6E"
            />
          </div>
        </div>

        <form onSubmit={handleSignupSubmit} className="bg-neutral-50/70 backdrop-blur-md rounded-[24px] p-5 border border-[#e0bfbd]/30 shadow-sm space-y-4">
          {error && (
            <p className="text-xs text-red-500 font-semibold text-center bg-red-50 py-2 rounded-lg">{error}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-neutral-500 font-bold uppercase ml-1">보안 아이디</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">person</span>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="사용할 아이디를 입력하세요"
                className="w-full h-14 bg-white border border-[#e0bfbd] rounded-2xl pl-12 pr-4 text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#ae2f34] transition-all"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-neutral-500 font-bold uppercase ml-1">비밀번호</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">lock</span>
              <input
                type={showPassword ? "text" : "password"}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="강력한 비밀번호를 만드세요"
                className="w-full h-14 bg-white border border-[#e0bfbd] rounded-2xl pl-12 pr-12 text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#ae2f34] transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-500"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-neutral-500 font-bold uppercase ml-1">비밀번호 확인</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">lock_clock</span>
              <input
                type="password"
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                className="w-full h-14 bg-white border border-[#e0bfbd] rounded-2xl pl-12 pr-12 text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#ae2f34] transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-[#ff6b6b] text-white rounded-full text-sm font-bold shadow-md hover:bg-red-500 transition-all flex items-center justify-center gap-1 disabled:opacity-60"
          >
            <span>{loading ? "가입 중..." : "가입하기"}</span>
            {!loading && <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>}
          </button>
        </form>

        <div className="text-center mt-6 mb-4">
          <p className="font-sans text-xs text-neutral-500 leading-relaxed mb-4">
            가입 시 <span className="text-[#ae2f34] hover:underline font-medium cursor-pointer">이용약관</span> 및 <span className="text-[#ae2f34] hover:underline font-medium cursor-pointer">개인정보 처리방침</span>에 동의하게 됩니다.
          </p>
          <div className="font-sans text-xs text-neutral-500">
            이미 계정이 있으신가요?
            <button
              type="button"
              onClick={() => { setError(null); onScreenChange(Screen.Login); }}
              className="text-[#ae2f34] font-bold hover:underline ml-1"
            >
              로그인
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
