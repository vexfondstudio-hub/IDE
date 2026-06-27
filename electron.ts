export interface ToolInfo {
  name: string;
  path: string;
  sha: string;
}

export interface UpdateStatus {
  phase: "checking" | "downloading" | "done" | "error";
  message: string;
  progress: number;
  currentFile: string | null;
  total: number;
  completed: number;
  changedCount?: number;
}

export interface SyncStatus {
  commitSha: string | null;
  syncedAt: string | null;
  fileCount: number;
}

export interface GithubLoginProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: "github";
}

export interface JokerIDEApi {
  checkToolsNow: () => Promise<ToolInfo[]>;
  getSyncStatus: () => Promise<SyncStatus | null>;
  githubLogin: () => Promise<GithubLoginProfile | null>;
  githubLogout: () => Promise<void>;
  onToolsUpdated: (callback: (tools: ToolInfo[]) => void) => () => void;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    jokerIDE?: JokerIDEApi;
  }
}

export function getElectronApi(): JokerIDEApi | null {
  return window.jokerIDE ?? null;
}
