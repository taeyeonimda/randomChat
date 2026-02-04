const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

const io = new Server(server, {
  cors: {
    origin: "*", // Vercel 주소가 확정되면 해당 주소로 제한하는 것이 보안상 좋습니다.
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e7 // 10MB
});

let rooms = {};

// 시간 포맷팅 함수 (서버 시간 기준)
const getCurrentTime = () => {
  const date = new Date();
  return date.getHours().toString().padStart(2, '0') + ":" + 
         date.getMinutes().toString().padStart(2, '0');
};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("get_rooms", () => {
    socket.emit("room_list", Object.keys(rooms));
  });

  socket.on("join_room", ({ room, userId }) => {
    if (!rooms[room]) {
      rooms[room] = { users: [] };
    }

    if (rooms[room].users.includes(userId)) {
      socket.emit("error_msg", "이미 입장한 방입니다.");
      return;
    }

    socket.join(room);
    rooms[room].users.push(userId);
    
    socket.data.room = room;
    socket.data.userId = userId;

    io.emit("room_list", Object.keys(rooms));
    socket.emit("joined_success", room);

    // [추가] 방에 있는 다른 사람들에게 입장 알림 전송
    socket.to(room).emit("user_joined", {
      message: `${userId}님이 입장하셨습니다.`,
      time: getCurrentTime()
    });

    console.log(`User ${userId} joined room: ${room}`);
  });

  socket.on("send_message", (data) => {
    socket.to(data.room).emit("receive_message", data);
  });

  socket.on("upload_file", (data) => {
     socket.to(data.room).emit("receive_file", data);
  });

  socket.on("disconnect", () => {
    const { room, userId } = socket.data;
    
    if (room && rooms[room]) {
      // [추가] 퇴장 전 방에 있는 사람들에게 퇴장 알림 전송
      socket.to(room).emit("user_left", {
        message: `${userId}님이 퇴장하셨습니다.`,
        time: getCurrentTime()
      });

      rooms[room].users = rooms[room].users.filter((id) => id !== userId);
      
      if (rooms[room].users.length === 0) {
        delete rooms[room];
      }
      io.emit("room_list", Object.keys(rooms));
    }
    console.log("User Disconnected", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});