import express from "express";
import http from "http";
import { Server } from "socket.io";
import PORT from "./config/serverConfig";
import roomHAndler from "./handlers/RoomHandler";

const app = express();

const server = http.createServer(app);

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
    console.log("New user connected");
    roomHAndler(socket);
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

server.listen(PORT, () => {
    console.log("Server is connected at the port: ", PORT);
});
