import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

const serverUrl = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";
const socket = io.connect(serverUrl);

function App() {
  const [userId, setUserId] = useState("");
  const [roomList, setRoomList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]);

  // 1. 자동 스크롤을 위한 Ref 생성
  const messageEndRef = useRef(null);

  // 스크롤 함수
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 채팅 로그가 바뀔 때마다 스크롤 아래로
  useEffect(() => {
    scrollToBottom();
  }, [chatLog]);

  useEffect(() => {
    socket.emit("get_rooms");

    socket.on("room_list", (rooms) => setRoomList(rooms));

    socket.on("joined_success", (room) => {
      setCurrentRoom(room);
      setChatLog([]);
    });

    socket.on("error_msg", (msg) => alert(msg));

    // 메시지 수신
    socket.on("receive_message", (data) => {
      setChatLog((prev) => [...prev, { ...data, type: 'text' }]);
    });

    // 파일 수신
    socket.on("receive_file", (data) => {
      setChatLog((prev) => [...prev, { ...data, type: 'file' }]);
    });

    // 2. 입/퇴장 알림 수신 (서버에서 발송 필요)
    socket.on("user_joined", (data) => {
      setChatLog((prev) => [...prev, { ...data, type: 'system' }]);
    });

    socket.on("user_left", (data) => {
      setChatLog((prev) => [...prev, { ...data, type: 'system' }]);
    });

    return () => {
      socket.off("room_list");
      socket.off("joined_success");
      socket.off("receive_message");
      socket.off("receive_file");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("error_msg");
    };
  }, []);

  const joinRoom = (roomName) => {
    if (!userId || !roomName) {
      alert("닉네임과 방 이름을 모두 입력해주세요!");
      return;
    }
    socket.emit("join_room", { room: roomName, userId });
  };

  const sendMessage = async () => {
    if (message !== "") {
      const messageData = {
        room: currentRoom,
        author: userId,
        message: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      await socket.emit("send_message", messageData);
      setChatLog((prev) => [...prev, { ...messageData, type: 'text' }]);
      setMessage("");
    }
  };

  // App.js 내부의 handleFileChange 함수 수정
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // [추가] 이미지 파일 타입인지 체크 (MIME type이 image/로 시작하는지 확인)
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      e.target.value = ""; // 선택된 파일 초기화
      return;
    }

    // [추가] 파일 용량 제한 (예: 5MB 이상은 업로드 불가)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert("이미지 용량은 5MB를 초과할 수 없습니다.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const fileData = {
        room: currentRoom,
        author: userId,
        fileName: file.name,
        fileData: reader.result,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      socket.emit("upload_file", fileData);
      setChatLog((prev) => [...prev, { ...fileData, type: 'file' }]);
    };
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      {!currentRoom ? (
        <div>
          <h2>익명 채팅 로비</h2>
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="사용할 닉네임 입력"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{ padding: "8px", width: "100%", marginBottom: "5px" }}
            />
            <input
              placeholder="방 이름 입력..."
              onChange={(e) => setRoomInput(e.target.value)}
              style={{ padding: "8px", width: "70%" }}
            />
            <button onClick={() => joinRoom(roomInput)} style={{ padding: "8px", width: "25%", marginLeft: "5%" }}>
              참가
            </button>
          </div>
          <h3>개설된 방 목록</h3>
          <ul>
            {roomList.map((r, idx) => (
              <li key={idx} style={{ marginBottom: "5px" }}>
                {r} <button onClick={() => joinRoom(r)}>입장</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>방: {currentRoom}</h2>
            <button onClick={()=>window.location.reload()}>나가기</button>
          </div>
          
          <div style={{ border: "1px solid #ccc", height: "450px", overflowY: "scroll", padding: "10px", backgroundColor: "#f9f9f9" }}>
            {chatLog.map((content, idx) => {
              // 3. 타입별 렌더링 (System / Text / File)
              if (content.type === 'system') {
                return (
                  <div key={idx} style={{ textAlign: "center", margin: "10px 0", color: "#888", fontSize: "12px" }}>
                    --- {content.message} ---
                  </div>
                );
              }

              const isMine = content.author === userId;
              return (
                <div key={idx} style={{ textAlign: isMine ? "right" : "left", marginBottom: "15px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "3px" }}>{content.author}</div>
                  <div style={{ 
                    display: "inline-block", 
                    padding: "8px 12px", 
                    borderRadius: "10px", 
                    backgroundColor: isMine ? "#DCF8C6" : "#fff",
                    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
                    maxWidth: "80%",
                    textAlign: "left"
                  }}>
                    {content.type === 'text' ? (
                         <span>{content.message}</span>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            {/* <span style={{ fontSize: "13px", marginBottom: "5px" }}>📁 {content.fileName}</span> */}
                            {content.fileData.startsWith("data:image") ? 
                                <img src={content.fileData} style={{ maxWidth: "100%", borderRadius: "5px" }} alt="uploaded"/> : 
                                <a href={content.fileData} download={content.fileName} style={{ color: "#007bff", textDecoration: "none" }}>⬇ 다운로드</a>
                            }
                        </div>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: "#aaa", marginTop: "3px" }}>{content.time}</div>
                </div>
              );
            })}
            {/* 자동 스크롤을 위한 더미 div */}
            <div ref={messageEndRef} />
          </div>

          <div style={{ marginTop: "10px", display: "flex", gap: "5px" }}>
            <input
              type="text"
              value={message}
              placeholder="메시지 입력..."
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              style={{ flex: 1, padding: "8px" }}
            />
            <button onClick={sendMessage} style={{ padding: "8px 15px" }}>전송</button>
          </div>
          <div style={{ marginTop: "10px" }}>
          <input 
            type="file" 
            accept="image/*" // [변경] 파일 선택창에서 이미지 파일만 보이도록 설정
            onChange={handleFileChange} 
            style={{ fontSize: "12px" }} 
          />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;