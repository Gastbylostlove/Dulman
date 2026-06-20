import React, { useState } from "react";
import { Screen } from "../../types";

interface SettingsScreenProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  onConfirmLogout: () => void;
  addLog: (level: "INFO" | "SECURITY" | "WARN", msg: string) => void;
}

export default function SettingsScreen({
  currentScreen,
  onScreenChange,
  onConfirmLogout,
  addLog,
}: SettingsScreenProps) {
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [hideMessageEnabled, setHideMessageEnabled] = useState(true);

  const handleToggleBiometrics = () => {
    const nextVal = !biometricEnabled;
    setBiometricEnabled(nextVal);
    addLog("SECURITY", `생체인식 잠금 보안 권한 변경됨 (FaceID: ${nextVal ? "ON" : "OFF"})`);
  };

  const handleToggleHideMessage = () => {
    const nextVal = !hideMessageEnabled;
    setHideMessageEnabled(nextVal);
    addLog("INFO", `알림 미리보기 노출 보안 설정 변경됨 (${nextVal ? "숨김" : "노출"})`);
  };

  const handleDeleteSpace = () => {
    const confirmation = window.confirm(
      "경고: 공간 삭제하기를 실행하면 민우님과의 모든 메시지, 사진, 암호화 키 등 공유 데이터가 보안 원칙에 의해 영구 파기되고 연결이 파쇄됩니다. 정말 계속할까요?"
    );
    if (confirmation) {
      addLog("WARN", "사용자 요청에 의한 보안 안식처 분해 및 모든 로컬 세션 데이터 영구 파기 완료");
      onScreenChange(Screen.Login);
    }
  };

  if (currentScreen === Screen.Settings) {
    return (
      <div id="screen-settings" className="absolute inset-0 bg-[#fbf9f8] flex flex-col justify-between overflow-hidden animate-fade-in">
        {/* Device header */}
        <header className="flex justify-between items-center w-full px-5 h-16 bg-[#ffffff] shadow-sm border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-200">
              <img 
                alt="Partner Avatar" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdNAhu97_w8u_N9q27Scn4PWyExGWR85FY2gYio3VLJOUUW1ixR-mC-oCoWRrxENM7aMsM2Ub72v32Ptp3fCpuEYAllWAtf7UOh71lmSNJDbsUlR1mhxyZNHtVX8YTVnVoFzJaMqzNvyxGJYNq6DKSy7k8QAPULH4mkaB1pv4sGQ_sP3TIuq14Th3jfauvjlFINtkxEdFrQoj5VZiMTsTzQbCahPKLHUPrI0EW9Dqtll_3zMn1nEjAkYugH3CoG-e2tjlxaPDhBboH" 
              />
            </div>
            <span className="font-sans font-bold text-sm text-neutral-800">SecureCouple</span>
          </div>
          <button 
            type="button"
            onClick={() => onScreenChange(Screen.ChatRoom)}
            className="text-neutral-500 hover:bg-neutral-100 p-2 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </header>

        {/* Scrollable setting list */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 pb-24">
          <header className="mb-2">
            <h2 className="font-sans font-extrabold text-[22px] text-neutral-900 leading-snug tracking-tight">개인정보 및 보안 설정</h2>
            <p className="font-sans text-xs text-neutral-500 mt-1">나만의 안전한 공간과 보안 설정을 관리하세요.</p>
          </header>

          <div className="space-y-6">
            {/* Security section */}
            <section className="space-y-2">
              <h3 className="font-sans text-[11px] font-bold text-neutral-500 uppercase tracking-wider pl-1">보안 접근</h3>
              <div className="bg-[#f0eded]/30 rounded-xl overflow-hidden border border-[#eae7e7]">
                {/* FaceID toggle item */}
                <div className="flex items-center justify-between p-4 border-b border-[#eae7e7] bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-[#ae2f34] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>fingerprint</span>
                    </div>
                    <div>
                      <h4 className="font-sans text-xs font-bold text-neutral-800">생체 인식 잠금</h4>
                      <p className="font-sans text-[10px] text-neutral-500 mt-0.5">앱을 열 때 Face ID 또는 지문 입력을 요구합니다.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={biometricEnabled}
                      onChange={handleToggleBiometrics}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ae2f34]" />
                  </label>
                </div>

                {/* Stealth icon config */}
                <div className="flex items-center justify-between p-4 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-[#ae2f34] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                    </div>
                    <div>
                      <h4 className="font-sans text-xs font-bold text-neutral-800">스텔스 아이콘</h4>
                      <p className="font-sans text-[10px] text-neutral-500 mt-0.5">홈 화면에서 앱 아이콘을 다른 모양으로 숨깁니다.</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      addLog("INFO", "스텔스 런처 아이콘 마스크 설정: 계산기");
                      alert("계산기 모양 스텔스 마스크가 활성화되었습니다.");
                    }}
                    className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-700"
                  >
                    <span className="text-[11px] font-bold">계산기</span>
                    <span className="material-symbols-outlined text-[16px] font-bold">chevron_right</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Notification section */}
            <section className="space-y-2">
              <h3 className="font-sans text-[11px] font-bold text-neutral-500 uppercase tracking-wider pl-1 font-semibold">알림</h3>
              <div className="bg-[#f0eded]/30 rounded-xl overflow-hidden border border-[#eae7e7]">
                <div className="flex items-center justify-between p-4 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-[#ae2f34] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">notifications_paused</span>
                    </div>
                    <div>
                      <h4 className="font-sans text-xs font-bold text-neutral-800">메시지 내용 숨기기</h4>
                      <p className="font-sans text-[10px] text-neutral-500 mt-0.5">잠금 화면에 '새로운 메시지'라고만 표시합니다.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={hideMessageEnabled}
                      onChange={handleToggleHideMessage}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ae2f34]" />
                  </label>
                </div>
              </div>
            </section>

            {/* Hazard alert section */}
            <section className="space-y-2">
              <h3 className="font-sans text-[11px] font-bold text-red-600 uppercase tracking-wider pl-1">위험 구역</h3>
              <div className="bg-red-50 rounded-xl overflow-hidden border border-[#ffdad6]">
                <button 
                  type="button"
                  onClick={handleDeleteSpace}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-red-100/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-red-600 shadow-sm border border-red-100">
                      <span className="material-symbols-outlined text-[20px] font-bold">delete_forever</span>
                    </div>
                    <div>
                      <h4 className="font-sans text-xs font-bold text-red-600">공간 삭제하기</h4>
                      <p className="font-sans text-[10px] text-[#93000a] opacity-80 mt-0.5">공유된 모든 데이터를 영구적으로 삭제하고 연결을 끊습니다.</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-red-500">chevron_right</span>
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Mobile bottom persistent navigation menu matching screens */}
        <nav className="absolute bottom-0 left-0 w-full h-[64px] bg-[#f0eded]/90 backdrop-blur-md flex justify-around items-center px-4 rounded-t-2xl shadow-[0_-4px_12px_rgba(0,0,0,0.03)] border-t border-neutral-200">
          <button 
            type="button"
            onClick={() => onScreenChange(Screen.ChatRoom)}
            className="flex flex-col items-center justify-center text-neutral-500 hover:text-[#ae2f34] transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">chat</span>
          </button>
          <button 
            type="button"
            onClick={() => onScreenChange(Screen.Settings)}
            className="flex flex-col items-center justify-center text-[#ae2f34] font-bold transition-all"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield_person</span>
          </button>
        </nav>
      </div>
    );
  }

  if (currentScreen === Screen.ForcedLogout) {
    return (
      <div id="screen-forced-logout" className="absolute inset-0 bg-neutral-900/60 z-50 flex items-center justify-center px-6">
        <div className="bg-[#fcf9f8] p-6 rounded-3xl w-full max-w-[310px] text-center shadow-2xl relative overflow-hidden animate-fade-in border border-[#e0bfbd]/35 flex flex-col items-center space-y-5">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-[#ba1a1a] shadow-sm pulse-alert">
            <span className="material-symbols-outlined text-2xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>gpp_maybe</span>
          </div>

          <div>
            <h3 className="font-sans font-bold text-lg text-neutral-900 leading-snug">로그아웃 되었습니다.</h3>
            <p className="font-sans text-xs text-neutral-500 mt-2 leading-relaxed">
              다른 기기에서 계정에 접속하여 현재 기기에서 로그아웃되었습니다.
            </p>
          </div>

          <button 
            type="button"
            onClick={onConfirmLogout}
            className="w-full bg-[#ae2f34] hover:bg-[#ae2f34]/95 text-white py-3.5 rounded-full font-bold text-xs tracking-widest uppercase transition-all shadow-[0_4px_14px_rgba(174,47,52,0.3)] hover:shadow-lg active:scale-95"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  return null;
}
