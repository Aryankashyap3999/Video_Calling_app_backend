import express from "express";
import http from "http";
import { PeerServer } from "peer";
import { Server } from "socket.io";
import PORT from "./config/serverConfig";
import chatHandler from "./handlers/ChatHandler";
import roomHAndler from "./handlers/RoomHandler";

const app = express();

const server = http.createServer(app);

// Setup PeerJS server on port 9000
const peerServer = PeerServer({ port: 9000, path: "/myapp" });

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get("/ping", (req, res) => {
    console.log(req);
    res.json({
        msg: "pong"
    });
});

io.on("connection", (socket) => {
    console.log("New user connected:", socket.id);
    roomHAndler(socket);
    chatHandler(socket);
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log("Server is connected at the port: ", PORT);
});

peerServer.on("connection", () => {
    console.log("PeerJS client connected");
});

peerServer.on("disconnect", () => {
    console.log("PeerJS client disconnected");
});
