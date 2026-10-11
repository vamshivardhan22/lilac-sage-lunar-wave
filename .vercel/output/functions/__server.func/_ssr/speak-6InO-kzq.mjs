import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/speak-6InO-kzq.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var speakLine_createServerFn_handler = createServerRpc({
	id: "239c26a35b7a0f76427f75d98329967d9d9a76dbd9889a44e1d19abb436154b7",
	name: "speakLine",
	filename: "src/lib/lap/speak.ts"
}, (opts) => speakLine.__executeServer(opts));
var speakLine = createServerFn({ method: "POST" }).validator((input) => {
	const text = String(input?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
	if (!text) throw new Error("Nothing to speak");
	return {
		text,
		gender: input?.gender === "male" ? "male" : "female",
		language: input?.language === "Hindi" ? "Hindi" : "English"
	};
}).handler(speakLine_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "Voice playback isn't available right now."
	};
	try {
		const res = await fetch("https://api.x.ai/v1/tts", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				text: data.text,
				voice_id: data.gender === "male" ? "rex" : "ara",
				language: data.language === "Hindi" ? "hi" : "en"
			})
		});
		if (!res.ok) return {
			ok: false,
			error: "Couldn't speak that line. Try again in a moment."
		};
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.length < 100) return {
			ok: false,
			error: "Couldn't speak that line. Try again in a moment."
		};
		return {
			ok: true,
			audioBase64: buf.toString("base64"),
			mime: res.headers.get("content-type") || "audio/mpeg"
		};
	} catch {
		return {
			ok: false,
			error: "Couldn't speak that line. Try again in a moment."
		};
	}
});
//#endregion
export { speakLine_createServerFn_handler };
