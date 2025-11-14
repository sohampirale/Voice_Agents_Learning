"use client";

import React, { useEffect, useRef, useState } from "react";
import { Scribe, AudioFormat, RealtimeEvents, CommitStrategy } from "@elevenlabs/client";
import axios from "axios"

export default function Home(): JSX.Element {
	const wsUrl: string = "wss://animated-space-yodel-4jqw94q5479g2j46j-3001.app.github.dev/";
	const wsRef = useRef<WebSocket | null>(null);
	const [stream, setStream] = useState(null)
	const [status, setStatus] = useState<"idle" | "connecting" | "open" | "closed" | "error">("idle");
	const [messages, setMessages] = useState<string[]>([]);
	const [input, setInput] = useState<string>("");

	// Recording related
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
	const [connection, setConnection] = useState(null)
	const [token, setToken] = useState(null)

	useEffect(() => {
		setupELabs()
	}, [])

	async function setupELabs() {
		try {
			const { data: response } = await axios.get('https://animated-space-yodel-4jqw94q5479g2j46j-3002.app.github.dev/temp-token-elevenlabs')
			const token = response.token
			console.log('Token received from BE : ', token)
			setToken(token)
			const connection = Scribe.connect({
				token,
				modelId: "scribe_v2_realtime",
				commitStrategy:  CommitStrategy.VAD	,

				vadSilenceThresholdSecs: 0.7, //bolun samplay!

				vadThreshold: 0.6,
				minSpeechDurationMs: 300,  //
				minSilenceDurationMs: 500, //ha silence khrach silenece ahe ka jr silence <300ms sapadla voice madhe tr to gap ahe bolun zala nhi ahe
				languageCode: 'en',

			});

			console.log('WS connection successfully with Eleven Labs')

			connection.on(RealtimeEvents.SESSION_STARTED, () => {
				console.log("Session started");
			});

			connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
				console.log("Committed:", data.text);
			});

			connection.on(RealtimeEvents.ERROR, (error) => {
				console.error("Error:", error);
			});

			connection.on(RealtimeEvents.AUTH_ERROR, (data) => {
				console.error("Auth error:", data.error);
			});
			// Connection opened
			connection.on(RealtimeEvents.OPEN, () => {
				console.log("Connection opened");
			});

			// Connection closed
			connection.on(RealtimeEvents.CLOSE, () => {
				console.log("Connection closed");
			});

			// Partial transcripts (interim results), use this in your UI to show the live transcript
			connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
				console.log("Partial:", data.text);
			});

			setConnection(connection)
		} catch (e) {
			console.log('ERROR :: setupELabs : ', e)
		}
	}

	// Authentication errors

	const connect = (): void => {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
		try {
			setStatus("connecting");
			const ws: WebSocket = new WebSocket(wsUrl);
			wsRef.current = ws;
			ws.onopen = () => setStatus("open");
			ws.onmessage = (ev: MessageEvent) => setMessages((prev) => [...prev, `recv: ${ev.data}`]);
			ws.onclose = () => setStatus("closed");
			ws.onerror = () => setStatus("error");
		} catch (err) {
			setStatus("error");
		}
	};

	const disconnect = (): void => {
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
			setStatus("closed");
		}
	};

	async function onDataAvailaible(ev: BlobEvent) {
		// alert('Inside ')
		console.log('we can send this chunk ', ev.data);


		// if (ev.data && ev.data.size > 0) {
		// 	const arrayBuffer = await ev.data.arrayBuffer();
		// 	const base64Audio = Buffer.from(arrayBuffer).toString('base64');
		// 	if (connection) {
		// 		console.log('Audio sent to the eleven labs')
		// 		connection.send({
		// 			audio_base_64: base64Audio,
		// 			sample_rate: 16000,   // ← REQUIRED!
		// 		});
		// 	}

		// 	// const ab = await ev.data.arrayBuffer();
		// 	// connection.send(ab)
		// 	// const audioBlob = new Blob([ev.data], { type: "audio/wav" });

		// 	if (wsRef.current) {

		// 		console.log('5 seconds binary is sent!');
		// 		// wsRef.current.send(ab); // sends binary
		// 		const userStream = await navigator.mediaDevices.getUserMedia({
		// 			audio: {
		// 				sampleRate: 16000,
		// 				channelCount: 1,
		// 				echoCancellation: true,
		// 				noiseSuppression: true,
		// 			}
		// 		});

		// 		if (mediaRecorderRef.current) {
		// 			mediaRecorderRef.current.ondataavailable = null
		// 			mediaRecorderRef.current.onstop = null
		// 			console.log('callbacks removed');
		// 		}

		// 		const newMr = new MediaRecorder(userStream!, {})
		// 		newMr.ondataavailable = onDataAvailaible
		// 		newMr.onstop = onStop
		// 		newMr.start(500)
		// 		mediaRecorderRef.current = newMr
		// 		// alert('mediaRecorderRef updated')
		// 		// wsRef.current.send(audioBlob); // sends binary

		// 	}
		// 	audioChunksRef.current.push(ev.data);
		// }
	};

	async function onStop() {
		return
		// stream.getTracks().forEach((t) => t.stop());

		const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
		const url = URL.createObjectURL(audioBlob);
		if (lastAudioUrl) {
			URL.revokeObjectURL(lastAudioUrl);
		}
		setLastAudioUrl(url);

		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			try {
				wsRef.current.send(audioBlob);
				setMessages((prev) => [...prev, `sent: audio (${audioBlob.size} bytes)`]);
			} catch (err) {
				setMessages((prev) => [...prev, `sent: audio failed (${String(err)})`]);
			}
		} else {
			setMessages((prev) => [...prev, "sent: (failed, socket not open)"]);
		}
		setIsRecording(false);
	};

	const send = (): void => {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(input);
			setMessages((prev) => [...prev, `sent: ${input}`]);
			setInput("");
		} else {
			setMessages((prev) => [...prev, "sent: (failed, socket not open)"]);
		}
	};

	let audioContext: AudioContext | null = null;
	let processor: ScriptProcessorNode | null = null;
	let sourceNode: MediaStreamAudioSourceNode | null = null;

	const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    },
  });

  audioContext = new AudioContext({
    sampleRate: 16000,
    latencyHint: 'interactive',
  });

  sourceNode = audioContext.createMediaStreamSource(stream);

  processor = audioContext.createScriptProcessor(1024, 1, 1); // ← 1024 = ~64ms chunks

  
	processor.onaudioprocess = (e) => {
		if (!connection) return;

		const float32Data = e.inputBuffer.getChannelData(0);
		const int16Data = new Int16Array(float32Data.length);

		for (let i = 0; i < float32Data.length; i++) {
			const s = Math.max(-1, Math.min(1, float32Data[i]));
			int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}

		const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)));

		// THIS IS THE ONLY LINE THAT WORKS WITH @elevenlabs/client
		connection.send({ audioBase64: base64 });
	};

  sourceNode.connect(processor);
  processor.connect(audioContext.destination);

  console.log("REAL PCM streaming started with small chunks");
};

	

	const stopRecording = (): void => {
		if (!isRecording || !mediaRecorderRef.current) return;
		try {
			// mediaRecorderRef.current.stop();
			// mediaRecorder's onstop will handle blobs and sending
			setMessages((prev) => [...prev, "recording: stopped"]);
		} catch (err) {
			setMessages((prev) => [...prev, `recording: stop failed (${String(err)})`]);
			setIsRecording(false);
		}
	};

	useEffect(() => {
		connect();
		return () => {
			// cleanup ws and audio url
			wsRef.current?.close();
			wsRef.current = null;
			if (lastAudioUrl) {
				URL.revokeObjectURL(lastAudioUrl);
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		};
	}, []);

	return (
		<div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
			<h1>WebSocket + Audio Recording</h1>

			<div>
				Status: <strong>{status}</strong>
			</div>

			<div style={{ marginTop: 12 }}>
				<button onClick={connect} disabled={status === "connecting" || status === "open"}>
					Connect
				</button>
				<button onClick={disconnect} disabled={status !== "open"} style={{ marginLeft: 8 }}>
					Disconnect
				</button>
			</div>

			<div style={{ marginTop: 12 }}>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Type message..."
					style={{ width: 320 }}
				/>
				<button onClick={send} disabled={status !== "open"} style={{ marginLeft: 8 }}>
					Send
				</button>
			</div>

			<div style={{ marginTop: 16 }}>
				<h3>Audio Recording</h3>
				<div>
					<button onClick={startRecording} disabled={isRecording}>
						Start Recording
					</button>
					<button onClick={stopRecording} disabled={!isRecording} style={{ marginLeft: 8 }}>
						Stop Recording (sends automatically)
					</button>
					{lastAudioUrl ? (
						<button
							onClick={() => {
								const audio = new Audio(lastAudioUrl);
								audio.play();
							}}
							style={{ marginLeft: 8 }}
						>
							Play Last Recording
						</button>
					) : null}
				</div>
			</div>

			<div style={{ marginTop: 16 }}>
				<h3>Messages</h3>
				<div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #ddd", padding: 8 }}>
					{messages.map((msg, idx) => (
						<div key={idx}>{msg}</div>
					))}
				</div>
			</div>
		</div>
	);
}