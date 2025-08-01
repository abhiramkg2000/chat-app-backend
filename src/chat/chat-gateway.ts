import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

import { Message, MessageDocument } from 'src/message/message.schema';

import { roomIds, getAllowedOrigins } from 'src/constants/commonConstants';

import {
  MessageType,
  MessageListType,
  RoomUsersType,
} from 'src/types/commonTypes';

@WebSocketGateway({ cors: { origin: getAllowedOrigins(), credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly jwtService: JwtService,
  ) {}

  public messages: MessageListType = {};
  public roomUsers: { [roomId: string]: RoomUsersType } = {};

  @WebSocketServer() server: Server;

  // USER JOIN ROOM
  @SubscribeMessage('joinroom')
  async handleJoinRoom(@ConnectedSocket() client: Socket) {
    client.join(client.data.roomId);

    // Fetch messages from MongoDB
    const dbMessages = await this.messageModel
      .find({ roomId: client.data.roomId })
      .sort({ createdAt: 1 }) // Oldest to newest
      .select('-_id') // To remove the fields from the query result
      .lean(); // Makes the result as plain JS objects

    console.log({ dbMessages });

    // Update the in-memory cache
    this.messages[client.data.roomId] = dbMessages || [];

    // If a new room is created
    if (!this.roomUsers[client.data.roomId]) {
      this.roomUsers[client.data.roomId] = [];
      roomIds.push(client.data.roomId);
    }

    // Add user to room-specific user list
    const userExists = this.roomUsers[client.data.roomId].find(
      (user) => user.name === client.data.userName,
    );

    if (!userExists) {
      this.roomUsers[client.data.roomId].push({
        name: client.data.userName,
        clientId: client.id,
      });
    } else if (userExists) {
      this.roomUsers[client.data.roomId] = this.roomUsers[
        client.data.roomId
      ].map((user) => {
        if (user.name === client.data.userName) {
          return {
            ...user,
            clientId: client.id,
          };
        } else {
          return user;
        }
      });
    }

    console.log(`Client ${client.id} joined room ${client.data.roomId}`);
    console.log('roomUsers', this.roomUsers);

    this.server.to(client.data.roomId).emit('user:info', {
      name: client.data.userName,
      roomId: client.data.roomId,
      clientId: client.id,
    });
    this.server
      .to(client.data.roomId)
      .emit('prefetch', this.messages[client.data.roomId]);
    this.server
      .to(client.data.roomId)
      .emit('users', this.roomUsers[client.data.roomId]);
  }

  // USER ADD MESSAGE
  @SubscribeMessage('message:add')
  async handleNewMessage(
    @MessageBody()
    data: {
      message: {
        value: string;
        clientId: string;
      };
    },
    @ConnectedSocket() client: Socket,
  ) {
    // To stop typing event after the user sends message
    this.server.to(client.data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });

    const newMessage = {
      ...data.message,
      name: client.data.userName,
      messageId: uuidv4(),
      isEdited: false,
      isDeleted: false,
      replyTo: '',
    };

    // Add new message to MongoDB
    const dbNewMessageDoc = await this.messageModel.create({
      ...newMessage,
      roomId: client.data.roomId,
    });

    const dbNewMessage = dbNewMessageDoc.toObject();
    const { _id, ...cleanMessage } = dbNewMessage; // To remove _id from the dbMessage

    this.server.to(client.data.roomId).emit('reply', cleanMessage);
    this.messages[client.data.roomId].push(cleanMessage);

    console.log('added messages', this.messages);
  }

  // USER EDIT MESSAGE
  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @MessageBody()
    data: {
      message: MessageType;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // To stop typing event after the user edits message
    this.server.to(client.data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });

    this.messages[client.data.roomId] = this.messages[client.data.roomId].map(
      (message) => {
        if (message.messageId === data.message.messageId) {
          return {
            ...data.message,
          };
        } else {
          return message;
        }
      },
    );

    this.server
      .to(client.data.roomId)
      .emit('prefetch', this.messages[client.data.roomId]);

    // Update the message in MongoDB
    await this.messageModel.findOneAndUpdate(
      { messageId: data.message.messageId },
      {
        $set: {
          ...data.message,
        },
      },
    );

    console.log('edited messages', this.messages);
  }

  // USER REPLY TO A MESSAGE
  @SubscribeMessage('message:replyToMessage')
  async handleReplyToMessage(
    @MessageBody()
    data: {
      message: {
        value: string;
        clientId: string;
        replyTo: string;
      };
    },
    @ConnectedSocket() client: Socket,
  ) {
    // To stop typing event after the user reply to a message
    this.server.to(client.data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });

    const newReplyMessage = {
      ...data.message,
      name: client.data.userName,
      messageId: uuidv4(),
      isEdited: false,
      isDeleted: false,
    };

    // Add the reply message to MongoDB
    const dbNewReplyMessageDoc = await this.messageModel.create({
      ...newReplyMessage,
      roomId: client.data.roomId,
    });

    const dbNewReplyMessage = dbNewReplyMessageDoc.toObject();
    const { _id, ...cleanMessage } = dbNewReplyMessage; // To remove _id from the dbMessage

    this.server.to(client.data.roomId).emit('reply', cleanMessage);
    this.messages[client.data.roomId].push(cleanMessage);

    console.log('reply to messages', this.messages);
  }

  // USER DELETE MESSAGE
  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @MessageBody()
    data: {
      messageId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.messages[client.data.roomId] = this.messages[client.data.roomId].map(
      (message) => {
        if (message.messageId === data.messageId) {
          return { ...message, isDeleted: true };
        } else {
          return message;
        }
      },
    );

    this.server
      .to(client.data.roomId)
      .emit('prefetch', this.messages[client.data.roomId]);

    // Update the isDeleted flag of message in MongoDB
    await this.messageModel.findOneAndUpdate(
      { messageId: data.messageId },
      {
        $set: {
          isDeleted: true,
        },
      },
    );

    console.log('deleted messages', this.messages);
  }

  // SOCKET CONNECTION
  handleConnection(client: Socket) {
    const token = client.handshake.headers.cookie
      ?.split('; ')
      .find((c) => c.startsWith('accessToken='))
      ?.split('=')[1];

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);

      // Store user info on the socket for later use
      client.data.userName = payload.name;
      client.data.roomId = payload.roomId;
    } catch (err) {
      client.disconnect();
      return;
    }
    console.log('client connected', client.id);
  }

  // SOCKET DISCONNECTION
  async handleDisconnect(client: Socket) {
    const { roomId, userName } = client.data;

    if (roomId && userName) {
      const room = this.roomUsers[roomId];
      if (room) {
        this.roomUsers[roomId] = room.filter((user) => {
          return user.name !== userName;
        });

        this.server.to(roomId).emit('users', this.roomUsers[roomId]);

        // To stop typing event when the user disconnects
        this.server.to(roomId).emit('userStoppedTyping', {
          clientId: client.id,
        });
      }
    }

    console.log('client disconnected', client.id);
  }

  // USER STARTS TYPING
  @SubscribeMessage('startTyping')
  handleTyping(@ConnectedSocket() client: Socket) {
    this.server.to(client.data.roomId).emit('userTyping', {
      userName: client.data.userName,
      clientId: client.id,
    });
  }

  // USER STOPPED TYPING
  @SubscribeMessage('stopTyping')
  handleStopTyping(@ConnectedSocket() client: Socket) {
    this.server.to(client.data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });
  }
}
