import { Socket } from "socket.io";
import { v4 as UUIDv4 } from "uuid";
import IRoomsParams from "../Interfaces/IRoomParams";

const rooms: Record<string, string[]> = {};
const peerRoomMap: Record<string, string> = {}; // maps peerId → roomId

const roomHandler = (socket: Socket) => {
  // Create a new room
  const createRoom = () => {
    const roomId = UUIDv4();
    socket.join(roomId);
    rooms[roomId] = [];
    socket.emit("room-created", { roomId });
    console.log("Room created with ID:", roomId);
  };

  // Join existing room
  const joinedRoom = ({ roomId, peerId }: IRoomsParams) => {
    if (!rooms[roomId]) {
      console.log("Room does not exist:", roomId);
      return;
    }

    console.log(`Peer ${peerId} joined room ${roomId}`);
    rooms[roomId].push(peerId);
    peerRoomMap[peerId] = roomId;
    socket.join(roomId);

    // Notify others that this peer is ready
    socket.on("ready", () => {
      socket.to(roomId).emit("user-joined", { peerId });
    });

    // Send list of participants back to new user
    socket.emit("get-user", {
      roomId,
      participants: rooms[roomId],
    });

    // System message: user joined
    socket.to(roomId).emit("chat-message", {
      peerId: "system",
      message: `${peerId.slice(0, 6)}... joined the room`,
      timestamp: Date.now(),
    });

    console.log("Current rooms:", rooms);
  };

  // Manual user deletion
  const deleteUserFromRoom = ({ roomId, peerId }: IRoomsParams) => {
    console.log("Deleting peer:", peerId, "from room:", roomId);
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter((ele) => ele !== peerId);
      delete peerRoomMap[peerId];

      socket.to(roomId).emit("user-left", { peerId });
      socket.to(roomId).emit("chat-message", {
        peerId: "system",
        message: `${peerId.slice(0, 6)}... left the room`,
        timestamp: Date.now(),
      });

      console.log("Remaining users:", rooms[roomId]);
    }
  };

  // Send chat message
  const sendMessage = (data: {
    roomId: string;
    peerId: string;
    message: string;
    timestamp: number;
  }) => {
    const { roomId, peerId, message, timestamp } = data;
    if (!rooms[roomId]) return;

    // Broadcast to everyone in the room (including sender)
    socket.to(roomId).emit("chat-message", { peerId, message, timestamp });
    socket.emit("chat-message", { peerId, message, timestamp });
  };

  // Auto cleanup on disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");

    const peerId = Object.keys(peerRoomMap).find((id) => peerRoomMap[id] === socket.id);
    if (!peerId) return;

    const roomId = peerRoomMap[peerId];
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter((id) => id !== peerId);
      delete peerRoomMap[peerId];

      socket.to(roomId).emit("user-left", { peerId });
      socket.to(roomId).emit("chat-message", {
        peerId: "system",
        message: `${peerId.slice(0, 6)}... left the room`,
        timestamp: Date.now(),
      });

      console.log(`Cleaned up peer ${peerId} from room ${roomId}`);
    }
  });

  // Register events
  socket.on("create-room", createRoom);
  socket.on("joined-room", joinedRoom);
  socket.on("delete-user", deleteUserFromRoom);
  socket.on("send-message", sendMessage);
};

export default roomHandler;