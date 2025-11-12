import { WebSocketServer } from 'ws';
import express from "express"
import fs from "fs"
import dotenv from "dotenv"
import { spawn } from 'child_process';

dotenv.config()
const app = express()
const wss = new WebSocketServer({ port: 3001 }, () => {
  console.log('WebSocket server listening on ws://localhost:3001');
});
let chunkIndex=0

wss.on('connection', (ws, req) => {
  console.log('client connected:', req.socket.remoteAddress);

  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner','-loglevel','error',
    '-f','webm',      // input format from MediaRecorder
    '-i','pipe:0',
    '-ar','16000','-ac','1',
    '-f','wav','pipe:1'
  ]);

  ffmpeg.stdout.on('data', (pcmChunk) => {
    // pcmChunk is decoded audio: send to STT or append to file
    console.log('data from stduot.on : ',pcmChunk);
  });

  ws.send(JSON.stringify({ type: 'welcome', msg: 'Hello from server' }));

  ws.on('message', (message,isBinary) => {
    console.log('received:', message);
    if(isBinary){
      // ffmpeg.stdin.write(message);
      chunkIndex++
      fs.writeFileSync(`audio_chunk_${chunkIndex}.webm`, message);
    } else {
      console.log('NOT A BINARY');
      
    }
    ws.send(JSON.stringify({ type: 'echo', msg: message.toString() }));
  });

  ws.on('close', () => console.log('client disconnected'));
  ws.on('error', (err) => console.error('ws error', err));
});

app.use(express.json())

app.post("/speech",(req,res)=>{
  const body = req.body
  console.log('body : ',body);
  res.status(200).json({})
})