import React from "react";
import { Screen, PhotoAsset } from "../../types";
import { photoGallery } from "../../mockData";

interface GalleryScreenProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  selectedPhotos: string[];
  onTogglePhoto: (id: string) => void;
  selectedPermission: "once" | "replay" | "keep";
  onPermissionChange: (perm: "once" | "replay" | "keep") => void;
  onConfirmSend: () => void;
}

export default function GalleryScreen({
  currentScreen,
  onScreenChange,
  selectedPhotos,
  onTogglePhoto,
  selectedPermission,
  onPermissionChange,
  onConfirmSend,
}: GalleryScreenProps) {
  const handleOpenPermissions = () => {
    if (selectedPhotos.length === 0) {
      alert("전송할 사진을 최소 1개 이상 선택해주세요.");
      return;
    }
    onScreenChange(Screen.PermissionSheet);
  };

  if (currentScreen === Screen.MediaSelect) {
    return (
      <div id="screen-media-select" className="absolute inset-0 bg-[#ffffff] z-10 flex flex-col justify-between overflow-hidden animate-fade-in">
        <header className="flex justify-between items-center px-4 py-3 bg-[#ffffff] border-b border-neutral-100 flex-shrink-0">
          <button 
            type="button" 
            onClick={() => onScreenChange(Screen.ChatRoom)}
            className="text-neutral-500 hover:bg-neutral-100 p-2 rounded-full transition-all -ml-2"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <h1 className="font-sans font-bold text-center text-neutral-800 text-sm">미디어 선택</h1>
          <div className="w-8" />
        </header>

        {/* Tab Header inside selection grid */}
        <div className="flex border-b border-neutral-100 bg-[#ffffff]">
          <button type="button" className="flex-1 pb-2.5 text-xs font-bold text-[#ae2f34] border-b-2 border-[#ae2f34] pt-2">
            갤러리
          </button>
          <button 
            type="button" 
            onClick={() => alert("기기 권한 허가 필요: 카메라")}
            className="flex-1 pb-2.5 text-xs text-neutral-400 font-semibold pt-2"
          >
            카메라
          </button>
        </div>

        {/* Security grade toggle */}
        <div className="px-5 py-3 bg-[#ffffff] border-b border-neutral-100 flex-shrink-0">
          <p className="font-sans font-bold text-[10px] text-neutral-400 uppercase tracking-wider mb-2 ml-0.5">보안 등급</p>
          <div className="flex bg-neutral-100 rounded-xl p-1 text-xs gap-1 shadow-inner">
            <button 
              type="button"
              onClick={() => onPermissionChange("once")}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
                selectedPermission === "once" ? "bg-neutral-900 text-white font-bold" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">visibility</span>
              <span className="text-[11px]">1회 열람</span>
            </button>
            <button 
              type="button"
              onClick={() => onPermissionChange("replay")}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
                selectedPermission === "replay" ? "bg-neutral-900 text-white font-bold" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">replay</span>
              <span className="text-[11px]">다시 보기</span>
            </button>
            <button 
              type="button"
              onClick={() => onPermissionChange("keep")}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
                selectedPermission === "keep" ? "bg-neutral-900 text-white font-bold" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">all_inclusive</span>
              <span className="text-[11px]">보관하기</span>
            </button>
          </div>
        </div>

        {/* Grid matching photo details */}
        <div className="flex-1 overflow-y-auto bg-neutral-50 pb-[80px]">
          <div className="grid grid-cols-3 gap-[2px]">
            {photoGallery.map((photo) => {
              const selectIdx = selectedPhotos.indexOf(photo.id);
              const isSelected = selectIdx !== -1;
              return (
                <div 
                  key={photo.id}
                  onClick={() => onTogglePhoto(photo.id)}
                  className="relative aspect-square cursor-pointer overflow-hidden border border-neutral-100 group"
                >
                  <img 
                    alt={photo.alt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                    src={photo.url}
                  />
                  {/* Overlay on select */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-[#ae2f34]/20 border-2 border-[#ae2f34]" />
                  )}
                  {/* Badge count */}
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-all ${
                    isSelected ? "bg-[#ae2f34] text-white" : "border border-white bg-black/35 text-white"
                  }`}>
                    {isSelected ? selectIdx + 1 : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating action sender (Extended for numbers indicator) */}
        {selectedPhotos.length > 0 && (
          <div className="absolute bottom-5 left-0 right-0 px-5 z-[50] pointer-events-none flex justify-end">
            <button 
              type="button"
              onClick={handleOpenPermissions}
              className="pointer-events-auto flex items-center justify-center gap-1.5 bg-[#ff6b6b] text-white px-5 py-3 rounded-full shadow-lg hover:bg-[#ae2f34] transition-all"
            >
              <span className="text-xs font-bold">{selectedPhotos.length}개 전송하기</span>
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (currentScreen === Screen.PermissionSheet) {
    return (
      <div id="screen-permission-sheet" className="absolute inset-0 bg-neutral-900/60 z-50 flex flex-col justify-end">
        {/* Backdrop clicking cancels drawer */}
        <div 
          onClick={() => onScreenChange(Screen.MediaSelect)}
          className="absolute inset-0 z-0 bg-transparent"
        />

        {/* Slide up card container */}
        <div className="bg-[#fcf9f8] rounded-t-[24px] shadow-2xl z-10 p-5 flex flex-col animate-[slideUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-4" />
          
          <div className="text-center mb-6">
            <h2 className="font-sans font-extrabold text-[#111] text-lg">열람 권한 설정</h2>
            <p className="font-sans text-[11px] text-neutral-400 mt-1">선택한 사진을 어떻게 보낼까요?</p>
          </div>

          {/* Select Permission radio blocks */}
          <div className="space-y-3 mb-6">
            {/* 1. ONCE */}
            <label className={`relative flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${
              selectedPermission === "once" ? "border-[#ae2f34] bg-[#ae2f34]/5 shadow-sm" : "border-neutral-200 bg-white"
            }`}>
              <input 
                type="radio" 
                name="perm" 
                checked={selectedPermission === "once"}
                onChange={() => onPermissionChange("once")}
                className="sr-only"
              />
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-[#ff6b6b] mr-3">
                <span className="material-symbols-outlined text-xl">timer</span>
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-xs text-neutral-800 leading-snug">⏱️ 퐁! (일회용)</div>
                <p className="text-[10px] text-neutral-400 mt-0.5">상대방이 확인하면 바로 사라져요.</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedPermission === "once" ? "border-[#ae2f34] bg-[#ae2f34]" : "border-neutral-300"
              }`}>
                {selectedPermission === "once" && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
            </label>

            {/* 2. REPLAY */}
            <label className={`relative flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${
              selectedPermission === "replay" ? "border-[#ae2f34] bg-[#ae2f34]/5 shadow-sm" : "border-neutral-200 bg-white"
            }`}>
              <input 
                type="radio" 
                name="perm" 
                checked={selectedPermission === "replay"}
                onChange={() => onPermissionChange("replay")}
                className="sr-only"
              />
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-[#ff6b6b] mr-3">
                <span className="material-symbols-outlined text-xl">replay</span>
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-xs text-neutral-800 leading-snug">🔄 한 번 더! (다시보기)</div>
                <p className="text-[10px] text-neutral-400 mt-0.5">딱 2번만 볼 수 있어요.</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedPermission === "replay" ? "border-[#ae2f34] bg-[#ae2f34]" : "border-neutral-300"
              }`}>
                {selectedPermission === "replay" && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
            </label>

            {/* 3. KEEP */}
            <label className={`relative flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${
              selectedPermission === "keep" ? "border-[#ae2f34] bg-[#ff6b6b]/5 shadow-sm" : "border-neutral-200 bg-white"
            }`}>
              <input 
                type="radio" 
                name="perm" 
                checked={selectedPermission === "keep"}
                onChange={() => onPermissionChange("keep")}
                className="sr-only"
              />
              <div className="w-10 h-10 rounded-full bg-[#ae2f34] text-white flex items-center justify-center mr-3 shadow-sm">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-xs text-neutral-800 leading-snug flex items-center gap-1.5">
                  <span>📦 우리 보관함 (보관)</span>
                  <span className="bg-[#ff6b6b]/10 text-[#ae2f34] font-bold text-[9px] px-1 rounded">추천</span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-0.5">제한 없이 언제든 편안히 볼 수 있어요.</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedPermission === "keep" ? "border-[#ae2f34] bg-[#ae2f34]" : "border-neutral-300"
              }`}>
                {selectedPermission === "keep" && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
            </label>
          </div>

          {/* Core active send button */}
          <button 
            type="button"
            onClick={onConfirmSend}
            className="w-full bg-[#ae2f34] hover:bg-[#ae2f34]/95 text-white active:scale-98 font-bold text-sm h-14 rounded-full flex items-center justify-center shadow-lg transition-transform"
          >
            전송하기
          </button>
        </div>
        <div className="h-6 bg-[#fcf9f8]" /> {/* Safe area offset */}

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
