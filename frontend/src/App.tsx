import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "https://whatsapp-clone-zoyj.onrender.com";
const WS_URL = "wss://whatsapp-clone-zoyj.onrender.com";

interface User {
  id: number;
  username: string;
}

interface Message {
  id: number;
  sender: string;
  receiver: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

function App() {
  const [isLogin, setIsLogin] = useState(true);

  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("access")
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  // =========================
  // GET USERS
  // =========================

  useEffect(() => {
    if (loggedIn) {
      getUsers();
    }
  }, [loggedIn]);

  // =========================
  // GET MESSAGES
  // =========================

  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser.id);
    }
  }, [selectedUser]);

  // =========================
  // WEBSOCKET
  // =========================

  useEffect(() => {
    if (!loggedIn || !selectedUser) {
      return;
    }

    const userId = localStorage.getItem("user_id");

    if (!userId) {
      console.error("User ID not found");
      return;
    }

    console.log(
      "Connecting WebSocket for user:",
      selectedUser.id
    );

    const ws = new WebSocket(
      `${WS_URL}/ws/chat/${selectedUser.id}/?sender_id=${userId}`
    );

    ws.onopen = () => {
      console.log("WebSocket connected ✅");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // =========================
      // NEW MESSAGE
      // =========================

      if (data.type === "chat_message") {
        const currentUserId = Number(userId);

        const newMessage: Message = {
          id: data.id,

          sender:
            data.sender_id === currentUserId
              ? localStorage.getItem("username") || ""
              : selectedUser.username,

          receiver:
            data.sender_id === currentUserId
              ? selectedUser.username
              : localStorage.getItem("username") || "",

          content: data.message,

          created_at: new Date().toISOString(),

          // Incoming messages are considered read
          // when they are received in the open chat.
          is_read: data.sender_id !== currentUserId,
        };

        setMessages((previousMessages) => {
          // Prevent duplicate messages
          if (
            previousMessages.some(
              (msg) => msg.id === newMessage.id
            )
          ) {
            return previousMessages;
          }

          return [
            ...previousMessages,
            newMessage,
          ];
        });
      }

      // =========================
      // MESSAGES READ
      // =========================

      if (data.type === "messages_read") {
        setMessages((previousMessages) =>
          previousMessages.map((msg) =>
            data.message_ids.includes(msg.id)
              ? {
                  ...msg,
                  is_read: true,
                }
              : msg
          )
        );
      }
    };

    ws.onerror = (error) => {
      console.error(
        "WebSocket error:",
        error
      );
    };

    ws.onclose = () => {
      console.log(
        "WebSocket disconnected"
      );
    };

    // Store WebSocket globally for sending
    (
      window as Window & {
        chatSocket?: WebSocket;
      }
    ).chatSocket = ws;

    return () => {
      ws.close();

      (
        window as Window & {
          chatSocket?: WebSocket;
        }
      ).chatSocket = undefined;
    };
  }, [loggedIn, selectedUser]);

  // =========================
  // GET USERS
  // =========================

  const getUsers = async () => {
    try {
      const token =
        localStorage.getItem("access");

      const response = await axios.get(
        `${API_URL}/api/users/list/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUsers(response.data);
    } catch (error) {
      console.error(
        "Get users error:",
        error
      );
    }
  };

  // =========================
  // GET MESSAGES
  // =========================

  const getMessages = async (
    userId: number
  ) => {
    try {
      const token =
        localStorage.getItem("access");

      const response = await axios.get(
       `${API_URL}/api/chat/${userId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessages(response.data);
    } catch (error) {
      console.error(
        "Get messages error:",
        error
      );
    }
  };

  // =========================
  // SEND MESSAGE
  // =========================

  const sendMessage = () => {
    if (!message.trim()) {
      return;
    }

    if (!selectedUser) {
      alert("Please select a user.");
      return;
    }

    const socket = (
      window as Window & {
        chatSocket?: WebSocket;
      }
    ).chatSocket;

    if (!socket) {
      alert("WebSocket is not connected.");
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      alert("WebSocket is not connected.");
      return;
    }

    socket.send(
      JSON.stringify({
        message: message.trim(),
      })
    );

    setMessage("");
  };

  // =========================
  // LOGIN / REGISTER
  // =========================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      const url = isLogin
        ? `${API_URL}/api/users/login/`
        : `${API_URL}/api/users/register/`;

      const response = await axios.post(url, {
        username,
        password,
      });

      if (isLogin) {
        // Access token
        localStorage.setItem(
          "access",
          response.data.access
        );

        // Refresh token
        localStorage.setItem(
          "refresh",
          response.data.refresh
        );

        // User ID
        localStorage.setItem(
          "user_id",
          String(response.data.user_id)
        );

        // Username
        localStorage.setItem(
          "username",
          response.data.username
        );

        setLoggedIn(true);

        console.log(
          "Login successful:",
          response.data.username
        );
      } else {
        alert(
          "Registration successful! Now login."
        );

        setIsLogin(true);
        setPassword("");
      }
    } catch (error: any) {
      console.error(error);

      alert(
        error.response?.data?.error ||
          "Something went wrong"
      );
    }
  };

  // =========================
  // LOGOUT
  // =========================

  const logout = () => {
    const socket = (
      window as Window & {
        chatSocket?: WebSocket;
      }
    ).chatSocket;

    if (socket) {
      socket.close();
    }

    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");

    setLoggedIn(false);
    setSelectedUser(null);
    setMessages([]);
    setUsername("");
    setPassword("");
  };

  // =========================
  // HOME SCREEN
  // =========================

  if (loggedIn) {
    return (
      <div style={styles.home}>

        {/* ================= LEFT SIDEBAR ================= */}

        <div style={styles.sidebar}>

          <div style={styles.header}>

            <h2>WhatsApp</h2>

            <button
              onClick={logout}
              style={styles.logout}
            >
              Logout
            </button>

          </div>

          <input
            placeholder="🔍 Search"
            style={styles.search}
          />

          {/* USER LIST */}

          <div>

            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  setSelectedUser(user);
                  setMessages([]);
                }}
                style={{
                  ...styles.user,
                  background:
                    selectedUser?.id === user.id
                      ? "#f0f2f5"
                      : "white",
                }}
              >

                <div style={styles.avatar}>
                  {user.username
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>

                  <strong>
                    {user.username}
                  </strong>

                  <p
                    style={
                      styles.lastMessage
                    }
                  >
                    Click to chat
                  </p>

                </div>

              </div>
            ))}

          </div>

        </div>

        {/* ================= CHAT AREA ================= */}

        <div style={styles.chat}>

          {selectedUser ? (
            <>

              {/* CHAT HEADER */}

              <div style={styles.chatHeader}>

                <div style={styles.avatar}>
                  {selectedUser.username
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <h3>
                  {selectedUser.username}
                </h3>

              </div>

              {/* ================= MESSAGES ================= */}

              <div style={styles.chatBody}>

                {messages.length === 0 ? (
                  <div style={styles.emptyChat}>
                    <p>
                      Start a conversation with{" "}
                      <strong>
                        {selectedUser.username}
                      </strong>
                    </p>
                  </div>
                ) : (
                  <div
                    style={
                      styles.messagesContainer
                    }
                  >

                    {messages.map((msg) => {

                      const isOutgoing =
                        msg.sender !==
                        selectedUser.username;

                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: "flex",

                            justifyContent:
                              isOutgoing
                                ? "flex-end"
                                : "flex-start",

                            marginBottom: "10px",
                          }}
                        >

                          <div
                            style={{
                              maxWidth: "60%",

                              padding:
                                "10px 12px",

                              borderRadius:
                                "10px",

                              background:
                                isOutgoing
                                  ? "#dcf8c6"
                                  : "#ffffff",

                              boxShadow:
                                "0 1px 1px rgba(0,0,0,0.08)",
                            }}
                          >

                            <div
                              style={{
                                display: "flex",
                                alignItems:
                                  "flex-end",
                                gap: "6px",
                              }}
                            >

                              <span
                                style={{
                                  wordBreak:
                                    "break-word",
                                }}
                              >
                                {msg.content}
                              </span>

                              {/* ================= TICKS ================= */}

                              {isOutgoing && (
                                <span
                                  style={{
                                    fontSize:
                                      "13px",

                                    fontWeight:
                                      "bold",

                                    color:
                                      msg.is_read
                                        ? "#34B7F1"
                                        : "#667781",

                                    whiteSpace:
                                      "nowrap",
                                  }}
                                >
                                  ✓✓
                                </span>
                              )}

                            </div>

                          </div>

                        </div>
                      );
                    })}

                  </div>
                )}

              </div>

              {/* ================= MESSAGE INPUT ================= */}

              <div
                style={
                  styles.messageBox
                }
              >

                <input
                  placeholder="Type a message"
                  value={message}
                  onChange={(e) =>
                    setMessage(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  style={
                    styles.messageInput
                  }
                />

                <button
                  onClick={sendMessage}
                  style={styles.send}
                >
                  ➤
                </button>

              </div>

            </>
          ) : (

            <div style={styles.empty}>

              <h1>
                WhatsApp Clone
              </h1>

              <p>
                Select a user to start chatting
              </p>

            </div>

          )}

        </div>

      </div>
    );
  }

  // =========================
  // LOGIN / REGISTER SCREEN
  // =========================

  return (
    <div style={styles.container}>

      <div style={styles.card}>

        <h1>
          WhatsApp Clone
        </h1>

        <h2>
          {isLogin
            ? "Login"
            : "Register"}
        </h2>

        <form
          onSubmit={handleSubmit}
        >

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value
              )
            }
            style={styles.input}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            style={styles.input}
          />

          <button
            type="submit"
            style={styles.button}
          >
            {isLogin
              ? "Login"
              : "Register"}
          </button>

        </form>

        <p>
          {isLogin
            ? "Don't have an account?"
            : "Already have an account?"}
        </p>

        <button
          onClick={() =>
            setIsLogin(!isLogin)
          }
          style={
            styles.switchButton
          }
        >
          {isLogin
            ? "Create Account"
            : "Go to Login"}
        </button>

      </div>

    </div>
  );
}

// =========================
// STYLES
// =========================

const styles = {

  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f0f2f5",
  },

  card: {
    width: "350px",
    padding: "30px",
    background: "white",
    borderRadius: "10px",
    boxShadow:
      "0 4px 15px rgba(0,0,0,0.15)",
    textAlign: "center" as const,
  },

  input: {
    width: "100%",
    padding: "12px",
    margin: "8px 0",
    boxSizing:
      "border-box" as const,
    border: "1px solid #ccc",
    borderRadius: "5px",
  },

  button: {
    width: "100%",
    padding: "12px",
    marginTop: "10px",
    border: "none",
    borderRadius: "5px",
    background: "#25D366",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
  },

  switchButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#128C7E",
  },

  home: {
    height: "100vh",
    display: "flex",
    background: "#f0f2f5",
  },

  sidebar: {
    width: "350px",
    background: "white",
    borderRight: "1px solid #ddd",
  },

  header: {
    padding: "15px",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    background: "#075E54",
    color: "white",
  },

  logout: {
    padding: "7px 12px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },

  search: {
    width: "90%",
    margin: "10px",
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxSizing:
      "border-box" as const,
  },

  user: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderBottom:
      "1px solid #eee",
    cursor: "pointer",
  },

  avatar: {
    width: "45px",
    height: "45px",
    borderRadius: "50%",
    background: "#ddd",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "20px",
    fontWeight: "bold",
    flexShrink: 0,
  },

  lastMessage: {
    margin: "5px 0 0",
    color: "#777",
    fontSize: "13px",
  },

  chat: {
    flex: 1,
    display: "flex",
    flexDirection:
      "column" as const,
  },

  chatHeader: {
    height: "70px",
    background: "#075E54",
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 20px",
  },

  chatBody: {
    flex: 1,
    display: "flex",
    flexDirection:
      "column" as const,
    padding: "20px",
    overflowY:
      "auto" as const,
  },

  messagesContainer: {
    width: "100%",
  },

  emptyChat: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    color: "#777",
  },

  empty: {
    flex: 1,
    display: "flex",
    flexDirection:
      "column" as const,
    justifyContent: "center",
    alignItems: "center",
    color: "#777",
  },

  messageBox: {
    display: "flex",
    padding: "10px",
    background: "#eee",
    gap: "10px",
  },

  messageInput: {
    flex: 1,
    padding: "12px",
    border: "1px solid #ccc",
    borderRadius: "20px",
    outline: "none",
  },

  send: {
    width: "45px",
    height: "45px",
    border: "none",
    borderRadius: "50%",
    background: "#25D366",
    color: "white",
    cursor: "pointer",
    fontSize: "18px",
  },
};

export default App;