const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // origin: "http://localhost:3000", // 리액트 주소
    origin: "http://172.20.4.191:3000", // 리액트 주소
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e8 // 파일 전송 용량 제한 (100MB)
});

// 메모리에 방 정보 저장 (DB 사용 X)
// 구조: { "방이름": { users: ["세션ID1", "세션ID2"] } }
let rooms = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. 방 리스트 요청
  socket.on("get_rooms", () => {
    socket.emit("room_list", Object.keys(rooms));
  });

  // 2. 방 생성 및 입장 (중복 체크 포함)
  socket.on("join_room", ({ room, userId }) => {
    // 방이 없으면 생성
    if (!rooms[room]) {
      rooms[room] = { users: [] };
    }

    // ★ 핵심: 같은 방에 같은 유저(세션ID)가 있는지 체크
    if (rooms[room].users.includes(userId)) {
      socket.emit("error_msg", "이미 입장한 방입니다 (중복 입장 불가).");
      return;
    }

    // 입장 처리
    socket.join(room);
    rooms[room].users.push(userId);
    
    // 나중에 연결 끊기면 유저 목록에서 제거하기 위해 소켓에 정보 저장
    socket.data.room = room;
    socket.data.userId = userId;

    // 모두에게 갱신된 방 리스트 전송
    io.emit("room_list", Object.keys(rooms));
    
    // 본인에게 입장 성공 알림
    socket.emit("joined_success", room);
    console.log(`User ${userId} joined room: ${room}`);
  });

  // 3. 메시지 전송 (DB 저장 안 함, 즉시 브로드캐스트)
  socket.on("send_message", (data) => {
    // data: { room, author, message, time }
    socket.to(data.room).emit("receive_message", data);
  });

  // 4. 파일 전송 (Base64 문자열로 받아서 전송)
  socket.on("upload_file", (data) => {
     // data: { room, author, fileName, fileData(base64) }
     socket.to(data.room).emit("receive_file", data);
  });

  // 5. 연결 종료 시 처리
  socket.on("disconnect", () => {
    const { room, userId } = socket.data;
    if (room && rooms[room]) {
      // 해당 방에서 유저 제거
      rooms[room].users = rooms[room].users.filter((id) => id !== userId);
      
      // 방에 사람이 없으면 방 삭제 (선택 사항)
      if (rooms[room].users.length === 0) {
        delete rooms[room];
      }
      io.emit("room_list", Object.keys(rooms));
    }
    console.log("User Disconnected", socket.id);
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING ON PORT 3001");
});