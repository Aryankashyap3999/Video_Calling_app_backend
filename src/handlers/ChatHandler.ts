import axios from "axios";
import { Socket } from "socket.io";

interface IChatMessage {
    workspaceId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    message: string;
    timestamp: number;
}

interface IProjectChatMessage {
    projectId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    message: string;
    timestamp: number;
    workspaceId: string;
}

export default function chatHandler(socket: Socket) {
    // Join a workspace chat room
    socket.on("JoinWorkspace", ({ workspaceId }, callback) => {
        console.log(`Socket ${socket.id} joining workspace: ${workspaceId}`);
        socket.join(`workspace_${workspaceId}`);

        if (callback) {
            callback({
                success: true,
                message: "Successfully joined workspace chat",
                data: workspaceId
            });
        }
    });

    // Leave a workspace chat room
    socket.on("LeaveWorkspace", ({ workspaceId }, callback) => {
        console.log(`Socket ${socket.id} leaving workspace: ${workspaceId}`);
        socket.leave(`workspace_${workspaceId}`);

        if (callback) {
            callback({
                success: true,
                message: "Successfully left workspace chat"
            });
        }
    });

    // Send message to workspace
    socket.on("SendWorkspaceMessage", (data: IChatMessage, callback) => {
        console.log("New workspace message:", data);

        const messageData = {
            ...data,
            timestamp: Date.now(),
            socketId: socket.id
        };

        // Broadcast to all users in the workspace room (including sender)
        socket.to(`workspace_${data.workspaceId}`).emit("ReceiveWorkspaceMessage", messageData);

        // Also emit to sender so they see their own message
        socket.emit("ReceiveWorkspaceMessage", messageData);

        if (callback) {
            callback({
                success: true,
                message: "Message sent successfully",
                data: messageData
            });
        }
    });

    // User is typing indicator
    socket.on("UserTyping", ({ workspaceId, userId, userName }) => {
        socket.to(`workspace_${workspaceId}`).emit("UserTypingIndicator", {
            userId,
            userName,
            isTyping: true
        });
    });

    // User stopped typing indicator
    socket.on("UserStoppedTyping", ({ workspaceId, userId }) => {
        socket.to(`workspace_${workspaceId}`).emit("UserTypingIndicator", {
            userId,
            isTyping: false
        });
    });

    // ============ PROJECT CHAT HANDLERS ============

    // Join a project chat room
    socket.on("JoinProject", ({ projectId }, callback) => {
        console.log(`Socket ${socket.id} joining project: ${projectId}`);
        socket.join(`project_${projectId}`);

        if (callback) {
            callback({
                success: true,
                message: "Successfully joined project chat",
                data: projectId
            });
        }
    });

    // Leave a project chat room
    socket.on("LeaveProject", ({ projectId }, callback) => {
        console.log(`Socket ${socket.id} leaving project: ${projectId}`);
        socket.leave(`project_${projectId}`);

        if (callback) {
            callback({
                success: true,
                message: "Successfully left project chat"
            });
        }
    });

    // Send message to project
    socket.on("SendProjectMessage", async (data: IProjectChatMessage, callback) => {
        console.log("New project message:", data);

        const messageData = {
            ...data,
            timestamp: Date.now(),
            socketId: socket.id
        };

        try {
            // Save message to database
            const userServiceUrl = process.env.USER_SERVICE_URL || "http://localhost:3001";
            await axios.post(`${userServiceUrl}/api/v1/project-messages`, {
                projectId: data.projectId,
                message: data.message,
                senderId: data.senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                workspaceId: data.workspaceId
            });

            console.log("Project message saved to database");
        } catch (error) {
            console.error("Failed to save project message:", error);
            // Continue with broadcasting even if DB save fails
        }

        // Broadcast to all users in the project room (including sender)
        socket.to(`project_${data.projectId}`).emit("ReceiveProjectMessage", messageData);

        // Also emit to sender so they see their own message
        socket.emit("ReceiveProjectMessage", messageData);

        if (callback) {
            callback({
                success: true,
                message: "Message sent successfully",
                data: messageData
            });
        }
    });

    // Project typing indicators
    socket.on("ProjectUserTyping", ({ projectId, userId, userName }) => {
        socket.to(`project_${projectId}`).emit("ProjectUserTypingIndicator", {
            userId,
            userName,
            isTyping: true
        });
    });

    socket.on("ProjectUserStoppedTyping", ({ projectId, userId }) => {
        socket.to(`project_${projectId}`).emit("ProjectUserTypingIndicator", {
            userId,
            isTyping: false
        });
    });
}
