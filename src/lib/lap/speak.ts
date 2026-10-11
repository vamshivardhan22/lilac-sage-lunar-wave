import { createServerFn } from "@tanstack/react-start";

export const speakLine = createServerFn({ method: "POST" })
  .validator((input: { text: string; gender: "female" | "male"; language: "English" | "Hindi" }) => {
    const text = String(input?.text ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    if (!text) throw new Error("Nothing to speak");
    const gender = input?.gender === "male" ? "male" : "female";
    const language = input?.language === "Hindi" ? "Hindi" : "English";
    return { text, gender: gender as "female" | "male", language: language as "English" | "Hindi" };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Voice playback isn't available right now." };
    try {
      const res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text: data.text,
          voice_id: data.gender === "male" ? "rex" : "ara",
          language: data.language === "Hindi" ? "hi" : "en",
        }),
      });
      if (!res.ok) return { ok: false as const, error: "Couldn't speak that line. Try again in a moment." };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) return { ok: false as const, error: "Couldn't speak that line. Try again in a moment." };
      return { ok: true as const, audioBase64: buf.toString("base64"), mime: res.headers.get("content-type") || "audio/mpeg" };
    } catch {
      return { ok: false as const, error: "Couldn't speak that line. Try again in a moment." };
    }
  });
