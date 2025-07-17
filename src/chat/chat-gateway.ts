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
import { User, UserDocument } from 'src/user/user.schema';

import { roomIds } from 'src/constants/commonConstants';

import {
  MessageType,
  MessageListType,
  RoomUsersType,
} from 'src/types/commonTypes';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  public messages: MessageListType = {};
  public roomUsers: { [roomId: string]: RoomUsersType } = {};

  @WebSocketServer() server: Server;

  // USER JOIN ROOM
  @SubscribeMessage('joinroom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.roomId);

    // Store user info on the socket for later use
    // client.data.userName = data.userName;
    client.data.roomId = data.roomId;
    client.data.clientId = client.id;

    // Fetch messages from MongoDB
    const dbMessages = await this.messageModel
      .find({ roomId: data.roomId })
      .sort({ createdAt: 1 }) // Oldest to newest
      .select('-_id -createdAt -updatedAt') // To remove the fields from the query result
      .lean(); // Makes the result as plain JS objects

    // Update the in-memory cache
    this.messages[data.roomId] = dbMessages || [];

    // If a new room is created
    if (!this.roomUsers[data.roomId]) {
      this.roomUsers[data.roomId] = [];
      roomIds.push(data.roomId);
    }

    // Add user to room-specific user list
    if (
      !this.roomUsers[data.roomId].find(
        (user) => user.name === data.userName && user.clientId === client.id,
      )
    ) {
      this.roomUsers[data.roomId].push({
        name: data.userName,
        clientId: client.id,
      });
    }

    // Get the userId from MongoDB
    const userId = await this.userModel
      .findOne({ name: data.userName })
      .select('_id')
      .lean();

    console.log(`Client ${client.id} joined room ${data.roomId}`);
    console.log('roomUsers', this.roomUsers);

    this.server.to(data.roomId).emit('clientId', client.id);
    this.server.to(data.roomId).emit('prefetch', this.messages[data.roomId]);
    this.server.to(data.roomId).emit('users', this.roomUsers[data.roomId]);
  }

  // USER ADD MESSAGE
  @SubscribeMessage('message:add')
  async handleNewMessage(
    @MessageBody()
    data: {
      roomId: string;
      message: {
        name: string;
        value: string;
        clientId: string;
      };
    },
    @ConnectedSocket() client: Socket,
  ) {
    // To stop typing event after the user sends message
    this.server.to(data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });

    const newMessage = {
      ...data.message,
      messageId: uuidv4(),
      isEdited: false,
      isDeleted: false,
      editedAt: '',
      replyTo: '',
    };
    this.server.to(data.roomId).emit('reply', newMessage);
    this.messages[data.roomId].push(newMessage);

    // Add new message to MongoDB
    await this.messageModel.create({ ...newMessage, roomId: data.roomId });

    console.log('added messages', this.messages);
  }

  // USER EDIT MESSAGE
  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @MessageBody()
    data: {
      roomId: string;
      message: MessageType;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // To stop typing event after the user edits message
    this.server.to(data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });

    this.messages[data.roomId] = this.messages[data.roomId].map((message) => {
      if (message.messageId === data.message.messageId) {
        return {
          ...data.message,
        };
      } else {
        return message;
      }
    });

    this.server.to(data.roomId).emit('prefetch', this.messages[data.roomId]);

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
      roomId: string;
      message: {
        name: string;
        value: string;
        clientId: string;
        replyTo: string;
      };
    },
    @ConnectedSocket() client: Socket,
  ) {
    // To stop typing event after the user reply to a message
    this.server.to(data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });

    const newReplyMessage = {
      ...data.message,
      messageId: uuidv4(),
      isEdited: false,
      isDeleted: false,
      editedAt: '',
    };
    this.server.to(data.roomId).emit('reply', newReplyMessage);
    this.messages[data.roomId].push(newReplyMessage);

    // Add the reply message to MongoDB
    await this.messageModel.create({ ...newReplyMessage, roomId: data.roomId });

    console.log('reply to messages', this.messages);
  }

  // USER DELETE MESSAGE
  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @MessageBody()
    data: {
      roomId: string;
      messageId: string;
    },
  ) {
    this.messages[data.roomId] = this.messages[data.roomId].map((message) => {
      if (message.messageId === data.messageId) {
        return { ...message, isDeleted: true };
      } else {
        return message;
      }
    });

    this.server.to(data.roomId).emit('prefetch', this.messages[data.roomId]);

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
      client.data.userName = payload.name;
      // client.data.accessToken = token;
    } catch (err) {
      client.disconnect();
      return;
    }
    console.log('client connected', client.id);
  }

  // SOCKET DISCONNECTION
  async handleDisconnect(client: Socket) {
    const { roomId, userName, clientId } = client.data;

    if (roomId && userName && clientId) {
      const room = this.roomUsers[roomId];
      if (room) {
        this.roomUsers[roomId] = room.filter((user) => {
          if (user.name === 'guest') {
            return user.clientId !== clientId;
          } else {
            return user.name !== userName;
          }
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
  handleTyping(
    @MessageBody() data: { roomId: string; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.roomId).emit('userTyping', {
      userName: data.userName,
      clientId: client.id,
    });
  }

  // USER STOPPED TYPING
  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @MessageBody()
    data: {
      roomId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.roomId).emit('userStoppedTyping', {
      clientId: client.id,
    });
  }
}
