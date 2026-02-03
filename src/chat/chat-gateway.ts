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
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';

import { Message, MessageDocument } from 'src/message/message.schema';
import { Room, RoomDocument } from 'src/room/room.schema';

import { getAllowedOrigins } from 'src/constants/commonConstants';
import { REDIS_CLIENT } from 'src/redis/redis.provider';

import { MessageListType } from 'src/types/commonTypes';

@WebSocketGateway({ cors: { origin: getAllowedOrigins(), credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwtService: JwtService,
  ) {}

  public messages: MessageListType = {};

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

    if (!dbMessages) {
      throw new Error('No messages found');
    }
    console.log({ dbMessages });

    // Update the in-memory cache
    this.messages[client.data.roomId] = dbMessages || [];

    // Fetch room from MongoDB
    const dbRoom = await this.roomModel
      .findOne({ roomId: client.data.roomId })
      .select('-_id') // To remove the fields from the query result
      .lean(); // Makes the result as plain JS objects

    console.log({ dbRoom });

    const roomExists = !!dbRoom;
    console.log({ roomExists });

    // If a room does not exist
    if (!roomExists) {
      // Add new room to MongoDB
      const dbNewRoomDoc = await this.roomModel.findOneAndUpdate(
        { roomId: client.data.roomId },
        {
          $setOnInsert: {
            roomId: client.data.roomId,
            createdBy: client.data.userName,
          },
        },
        { upsert: true, new: true },
      );

      console.log('dbNewRoomDoc', dbNewRoomDoc);

      if (!dbNewRoomDoc) {
        throw new Error('Failed to create room in DB');
      }
    }

    // Add/Update room users to hash
    await this.redis.hset(
      `room:${client.data.roomId}:users`,
      client.data.userName,
      client.id,
    );

    const roomUsers = await this.redis.hgetall(
      `room:${client.data.roomId}:users`,
    );

    const formattedRoomUsers = Object.entries(roomUsers).map(
      ([name, clientId]) => ({
        name,
        clientId,
      }),
    );

    console.log('Redis room users after connection', formattedRoomUsers);
    console.log(`Client ${client.id} joined room ${client.data.roomId}`);

    this.server.to(client.data.roomId).emit('user:info', {
      name: client.data.userName,
      roomId: client.data.roomId,
      clientId: client.id,
    });
    this.server
      .to(client.data.roomId)
      .emit('prefetch', this.messages[client.data.roomId]);
    this.server.to(client.data.roomId).emit('users', formattedRoomUsers);
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

    if (!dbNewMessageDoc) {
      throw new Error('Failed to create message in DB');
    }

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
      message: {
        value: string;
        messageId: string;
      };
    },
    @ConnectedSocket() client: Socket,
  ) {
    // To stop typing event after the user edits message
    this.server.to(client.data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });

    // Update the message in MongoDB
    const dbUpdatedMessageDoc = await this.messageModel.findOneAndUpdate(
      { messageId: data.message.messageId },
      {
        $set: {
          value: data.message.value,
          isEdited: true,
        },
      },
      { new: true }, // Return the updated document
    );

    if (!dbUpdatedMessageDoc) {
      throw new Error('Message not found or update failed');
    }

    const dbUpdatedMessage = dbUpdatedMessageDoc.toObject();
    const { _id, ...cleanMessage } = dbUpdatedMessage; // To remove _id from the dbMessage

    this.messages[client.data.roomId] = this.messages[client.data.roomId].map(
      (message) => {
        if (message.messageId === data.message.messageId) {
          return {
            ...cleanMessage,
          };
        } else {
          return message;
        }
      },
    );

    this.server
      .to(client.data.roomId)
      .emit('prefetch', this.messages[client.data.roomId]);

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

    if (!dbNewReplyMessageDoc) {
      throw new Error('Failed to create reply message in DB');
    }

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
    // Update the isDeleted flag of message in MongoDB
    const dbDeletedMessageDoc = await this.messageModel.findOneAndUpdate(
      { messageId: data.messageId },
      {
        $set: {
          isDeleted: true,
        },
      },
      { new: true }, // Return the updated document
    );

    if (!dbDeletedMessageDoc) {
      throw new Error('Message not found or delete failed');
    }

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
      // Remove room users from hash
      await this.redis.hdel(`room:${roomId}:users`, userName);

      const roomUsers = await this.redis.hgetall(
        `room:${client.data.roomId}:users`,
      );

      const formattedRoomUsers = Object.entries(roomUsers).map(
        ([name, clientId]) => ({
          name,
          clientId,
        }),
      );

      console.log('Redis room users after disconnection', formattedRoomUsers);

      this.server.to(roomId).emit('users', formattedRoomUsers);

      // To stop typing event when the user disconnects
      this.server.to(roomId).emit('userStoppedTyping', {
        clientId: client.id,
      });
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
