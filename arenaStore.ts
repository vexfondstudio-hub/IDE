export interface ArenaScript {
  id: string;
  title: string;
  language: string;
  version: string;
  code: string;
  author: string;
  likes: number;
}

export async function fetchArenaScripts(): Promise<ArenaScript[]> {
  try {
    const res = await fetch("/api/arena");
    if (!res.ok) throw new Error("Failed to fetch arena scripts");
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function saveArenaScript(script: Omit<ArenaScript, "id" | "likes">) {
  try {
    const res = await fetch("/api/arena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(script)
    });
    if (!res.ok) throw new Error("Failed to save arena script");
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function likeScript(id: string) {
  try {
    await fetch(`/api/arena/${id}/like`, { method: "POST" });
  } catch (err) {
    console.error(err);
  }
}
