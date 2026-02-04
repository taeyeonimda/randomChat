import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";

// IP 주소는 본인 환경에 맞게 유지하세요
const serverUrl = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";
const socket = io.connect(serverUrl);
function App() {
  // [변경] 초기값을 빈 문자열로 설정 (사용자가 입력해야 함)
  const [userId, setUserId] = useState(""); 
  const [roomList, setRoomList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);

  const [roomInput, setRoomInput] = useState("");
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]);

  useEffect(() => {
    // [변경] 기존의 자동 ID 생성 로직(sessionStorage 관련)은 삭제했습니다.

    // 초기 방 리스트 요청
    socket.emit("get_rooms");

    socket.on("room_list", (rooms) => setRoomList(rooms));

    socket.on("joined_success", (room) => {
      setCurrentRoom(room);
      setChatLog([]);
    });

    socket.on("error_msg", (msg) => alert(msg));

    socket.on("receive_message", (data) => {
      setChatLog((prev) => [...prev, data]);
    });

    socket.on("receive_file", (data) => {
        setChatLog((prev) => [...prev, { ...data, type: 'file' }]);
    });

    return () => {
      socket.off("room_list");
      socket.off("joined_success");
      socket.off("receive_message");
      socket.off("receive_file");
      socket.off("error_msg");
    };
  }, []);

  const joinRoom = (roomName) => {
    // [추가] 유효성 검사: 닉네임과 방 이름이 없으면 입장 불가
    if (!userId) {
      alert("닉네임(ID)을 입력해주세요!");
      return;
    }
    if (!roomName) {
      alert("방 이름을 입력해주세요!");
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
        time: new Date().getHours() + ":" + new Date().getMinutes(),
        type: 'text'
      };
      await socket.emit("send_message", messageData);
      setChatLog((prev) => [...prev, messageData]);
      setMessage("");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const fileData = {
            room: currentRoom,
            author: userId,
            fileName: file.name,
            fileData: reader.result,
            time: new Date().getHours() + ":" + new Date().getMinutes(),
            type: 'file'
        };
        socket.emit("upload_file", fileData);
        setChatLog((prev) => [...prev, fileData]);
    };
  };

  return (
    <div style={{ padding: "20px" }}>
      {!currentRoom ? (
        // --- 로비 화면 ---
        <div>
          <h2>익명 채팅 로비</h2> {/* 제목 변경 */}
          
          {/* [추가] 닉네임 입력 필드 */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ marginRight: "10px" }}>닉네임:</label>
            <input
              type="text"
              placeholder="사용할 닉네임 입력"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{ padding: "5px" }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ marginRight: "10px" }}>방 이름:</label>
            <input
              placeholder="방 이름 입력..."
              onChange={(e) => setRoomInput(e.target.value)}
              style={{ padding: "5px" }}
            />
            <button onClick={() => joinRoom(roomInput)} style={{ marginLeft: "10px" }}>
              방 만들기/참가
            </button>
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
          <h2>방: {currentRoom} (내 ID: {userId}) <button onClick={()=>window.location.reload()}>나가기</button></h2>
          
          <div style={{ border: "1px solid #ccc", height: "400px", overflowY: "scroll", padding: "10px" }}>
            {chatLog.map((content, idx) => (
              <div key={idx} style={{ textAlign: content.author === userId ? "right" : "left" }}>
                <div style={{ fontWeight: "bold" }}>{content.author}</div>
                {content.type === 'text' ? (
                     <span>{content.message}</span>
                ) : (
                    <div>
                        📄 {content.fileName} <br/>
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