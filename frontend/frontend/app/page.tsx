"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Home(): JSX.Element {
	const wsUrl: string = "wss://animated-space-yodel-4jqw94q5479g2j46j-3001.app.github.dev/";
	const wsRef = useRef<WebSocket | null>(null);
	const [stream,setStream]=useState(null)
	const [status, setStatus] = useState<"idle" | "connecting" | "open" | "closed" | "error">("idle");
	const [messages, setMessages] = useState<string[]>([]);
	const [input, setInput] = useState<string>("");

	// Recording related
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);

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
			console.log('we can send this chunk ',ev.data);
			
			if (ev.data && ev.data.size > 0) {
				const ab = await ev.data.arrayBuffer();
				// const audioBlob = new Blob([ev.data], { type: "audio/wav" });

				if(wsRef.current){

					console.log('5 seconds binary is sent!');
					wsRef.current.send(ab); // sends binary
					const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
					if(mediaRecorderRef.current){
						mediaRecorderRef.current.ondataavailable=null
						mediaRecorderRef.current.onstop=null
						console.log('callbacks removed');
					}
					
					const newMr = new MediaRecorder(userStream!,{})
					newMr.ondataavailable=onDataAvailaible
					newMr.onstop=onStop
					newMr.start(5000)
					mediaRecorderRef.current=newMr
					// alert('mediaRecorderRef updated')
					// wsRef.current.send(audioBlob); // sends binary

				}
				audioChunksRef.current.push(ev.data);
			}
		};

		async function onStop(){
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

	const startRecording = async (): Promise<void> => {
		if (isRecording) return;
		try {
			const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if(!stream){
				// alert('stream set first time')
				setStream(newStream)
			}
			audioChunksRef.current = [];
			const options: MediaRecorderOptions = {}; // leave default
			const mr = new MediaRecorder(newStream, options);
			mediaRecorderRef.current = mr;

			mr.ondataavailable = onDataAvailaible

			mr.onstop = onStop

			mr.start(5000);
			setIsRecording(true);
			setMessages((prev) => [...prev, "recording: started"]);
		} catch (err) {
			setMessages((prev) => [...prev, `recording: failed (${String(err)})`]);
		}
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
					{messages.length === 0 ? <div style={{ color: "#666" }}>No messages</div> : null}
					{messages.map((m, i) => (
						<div key={i} style={{ marginBottom: 6, fontFamily: "monospace" }}>
							{m}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
