import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css"; // 기본 CSS 사용

const socket = io.connect("http://localhost:3001");

function App() {
  const [userId, setUserId] = useState("");
  const [roomList, setRoomList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  
  // 입력값 상태
  const [roomInput, setRoomInput] = useState("");
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]); // 휘발성 채팅 로그

  useEffect(() => {
    // 1. 유저 식별을 위한 세션 ID 생성 (새로고침해도 유지)
    let storedId = sessionStorage.getItem("unique_chat_id");
    if (!storedId) {
      storedId = Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("unique_chat_id", storedId);
    }
    setUserId(storedId);

    // 2. 초기 방 리스트 요청
    socket.emit("get_rooms");

    // 소켓 이벤트 리스너 설정
    socket.on("room_list", (rooms) => setRoomList(rooms));
    
    socket.on("joined_success", (room) => {
      setCurrentRoom(room);
      setChatLog([]); // 방 바뀌면 로그 초기화
    });

    socket.on("error_msg", (msg) => alert(msg));

    socket.on("receive_message", (data) => {
      setChatLog((prev) => [...prev, data]);
    });

    socket.on("receive_file", (data) => {
        setChatLog((prev) => [...prev, { ...data, type: 'file' }]);
    });

    // 클린업
    return () => {
      socket.off("room_list");
      socket.off("joined_success");
      socket.off("receive_message");
      socket.off("receive_file");
      socket.off("error_msg");
    };
  }, []);

  const joinRoom = (roomName) => {
    if (!roomName) return;
    socket.emit("join_room", { room: roomName, userId });
  };

  const sendMessage = async () => {
    if (message !== "") {
      const messageData = {
        room: currentRoom,
        author: userId,
        message: message,
        time: new Date().getHours() + ":" + new Date().getMinutes(),
        type: 'text'
      };
      await socket.emit("send_message", messageData);
      setChatLog((prev) => [...prev, messageData]); // 내 화면에도 추가
      setMessage("");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    // 파일을 읽어서 전송
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const fileData = {
            room: currentRoom,
            author: userId,
            fileName: file.name,
            fileData: reader.result, // Base64 인코딩
            time: new Date().getHours() + ":" + new Date().getMinutes(),
            type: 'file'
        };
        socket.emit("upload_file", fileData);
        setChatLog((prev) => [...prev, fileData]); // 내 화면 표시
    };
  };

  return (
    <div style={{ padding: "20px" }}>
      {!currentRoom ? (
        // --- 로비 화면 ---
        <div>
          <h2>익명 채팅 로비 (내 ID: {userId})</h2>
          <div style={{ marginBottom: "20px" }}>
            <input
              placeholder="방 이름 입력..."
              onChange={(e) => setRoomInput(e.target.value)}
            />
            <button onClick={() => joinRoom(roomInput)}>방 만들기/참가</button>
          </div>
          <h3>개설된 방 목록</h3>
          <ul>
            {roomList.map((r, idx) => (
              <li key={idx}>
                {r} <button onClick={() => joinRoom(r)}>입장</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // --- 채팅방 화면 ---
        <div>
          <h2>방: {currentRoom} <button onClick={()=>window.location.reload()}>나가기</button></h2>
          
          <div style={{ border: "1px solid #ccc", height: "400px", overflowY: "scroll", padding: "10px" }}>
            {chatLog.map((content, idx) => (
              <div key={idx} style={{ textAlign: content.author === userId ? "right" : "left" }}>
                <div style={{ fontWeight: "bold" }}>{content.author}</div>
                {content.type === 'text' ? (
                     <span>{content.message}</span>
                ) : (
                    <div>
                        📄 {content.fileName} <br/>
                        {/* 이미지면 미리보기, 아니면 다운로드 링크 */}
                        {content.fileData.startsWith("data:image") ? 
                            <img src={content.fileData} width="150" alt="uploaded"/> : 
                            <a href={content.fileData} download={content.fileName}>다운로드</a>
                        }
                    </div>
                )}
                <div style={{ fontSize: "10px" }}>{content.time}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "10px" }}>
            <input
              type="text"
              value={message}
              placeholder="메시지..."
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage}>전송</button>
            <br/><br/>
            <input type="file" onChange={handleFileChange} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;