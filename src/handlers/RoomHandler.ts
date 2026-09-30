import { Socket } from "socket.io";
import { v4 as UUIDv4 } from "uuid";
import IRoomsParams from "../Interfaces/IRoomParams";

interface IRoomMetadata {
  participants: string[];
  workspaceId?: string;
  createdAt: number;
  createdBy?: string;
}

const rooms: Record<string, IRoomMetadata> = {};
const peerRoomMap: Record<string, string> = {}; // maps peerId → roomId

const roomHandler = (socket: Socket) => {
  // Create a new room
  const createRoom = (data?: { workspaceId?: string; createdBy?: string }) => {
    const roomId = UUIDv4();
    socket.join(roomId);
    rooms[roomId] = {
      participants: [],
      workspaceId: data?.workspaceId,
      createdAt: Date.now(),
      createdBy: data?.createdBy
    };
    socket.emit("room-created", { roomId, workspaceId: data?.workspaceId });
    console.log("Room created with ID:", roomId, "Workspace:", data?.workspaceId);
  };

  // Join existing room
  const joinedRoom = ({ roomId, peerId }: IRoomsParams) => {
    if (!rooms[roomId]) {
      console.log("Room does not exist:", roomId);
      return;
    }

    if (!peerId) {
      console.log("peerId is missing for room:", roomId);
      return;
    }

    console.log(`Peer ${peerId} joined room ${roomId}`);
    rooms[roomId].participants.push(peerId);
    peerRoomMap[peerId] = roomId;
    socket.join(roomId);

    // Notify others that this peer is ready
    socket.on("ready", () => {
      socket.to(roomId).emit("user-joined", { peerId });
    });

    // Send list of participants and room metadata back to new user
    socket.emit("get-user", {
      roomId,
      participants: rooms[roomId].participants,
      workspaceId: rooms[roomId].workspaceId,
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
    if (!peerId) {
      console.log("peerId is missing for deletion from room:", roomId);
      return;
    }
    if (rooms[roomId]) {
      rooms[roomId].participants = rooms[roomId].participants.filter((ele: string) => ele !== peerId);
      delete peerRoomMap[peerId];

      socket.to(roomId).emit("user-left", { peerId });
      socket.to(roomId).emit("chat-message", {
        peerId: "system",
        message: `${peerId.slice(0, 6)}... left the room`,
        timestamp: Date.now(),
      });

      console.log("Remaining users:", rooms[roomId].participants);

      // Clean up empty rooms
      if (rooms[roomId].participants.length === 0) {
        delete rooms[roomId];
        console.log("Room", roomId, "deleted (no participants)");
      }
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
    if (!rooms[roomId]) { return; }

    // Broadcast to everyone in the room (including sender)
    socket.to(roomId).emit("chat-message", { peerId, message, timestamp });
    socket.emit("chat-message", { peerId, message, timestamp });
  };

  // Auto cleanup on disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");

    const peerId = Object.keys(peerRoomMap).find((id) => peerRoomMap[id] === socket.id);
    if (!peerId) { return; }

    const roomId = peerRoomMap[peerId];
    if (rooms[roomId]) {
      rooms[roomId].participants = rooms[roomId].participants.filter((id: string) => id !== peerId);
      delete peerRoomMap[peerId];

      socket.to(roomId).emit("user-left", { peerId });
      socket.to(roomId).emit("chat-message", {
        peerId: "system",
        message: `${peerId.slice(0, 6)}... left the room`,
        timestamp: Date.now(),
      });

      console.log(`Cleaned up peer ${peerId} from room ${roomId}`);

      // Clean up empty rooms
      if (rooms[roomId].participants.length === 0) {
        delete rooms[roomId];
        console.log("Room", roomId, "deleted (no participants)");
      }
    }
  });

  // Start project mode (screen sharing)
  const startProjectMode = (data: {
    roomId: string;
    presenterId: string;
    presenterName: string;
    projectId?: string;
    projectName?: string;
  }) => {
    const { roomId, presenterId, presenterName, projectId, projectName } = data;
    if (!rooms[roomId]) { return; }

    // Broadcast to everyone in the room except sender
    socket.to(roomId).emit("project-mode-started", {
      presenterId,
      presenterName,
      projectId,
      projectName
    });

    console.log(`Project mode started in room ${roomId} by ${presenterName}${projectName ? ` - Project: ${projectName}` : ""}`);
  };

  // End project mode
  const endProjectMode = (data: {
    roomId: string;
    presenterId: string;
  }) => {
    const { roomId } = data;
    if (!rooms[roomId]) { return; }

    // Broadcast to everyone in the room
    socket.to(roomId).emit("project-mode-ended");

    console.log(`Project mode ended in room ${roomId}`);
  };

  // Register events
  socket.on("create-room", createRoom);
  socket.on("joined-room", joinedRoom);
  socket.on("delete-user", deleteUserFromRoom);
  socket.on("send-message", sendMessage);
  socket.on("start-project-mode", startProjectMode);
  socket.on("end-project-mode", endProjectMode);
};

export default roomHandler;
