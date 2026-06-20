export enum Screen {
  Splash = "Splash",
  Login = "Login",
  Signup = "Signup",
  OnboardingGenerate = "OnboardingGenerate",
  OnboardingInput = "OnboardingInput",
  ChatRoom = "ChatRoom",
  MediaSelect = "MediaSelect",
  PermissionSheet = "PermissionSheet",
  MediaViewer = "MediaViewer",
  ChatMenuSheet = "ChatMenuSheet",
  Settings = "Settings",
  ForcedLogout = "ForcedLogout",
}

export interface Message {
  id: string;
  sender: "me" | "partner";
  text?: string;
  time: string;
  isMedia?: boolean;
  mediaUrl?: string;
  permissionType?: "once" | "replay" | "keep";
  revealed?: boolean;
  clicksCount?: number;
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: "INFO" | "SECURITY" | "WARN";
  message: string;
}

export interface PhotoAsset {
  id: string;
  url: string;
  alt: string;
}
