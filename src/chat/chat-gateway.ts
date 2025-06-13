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

import {
  MessageType,
  MessageListType,
  RoomUsersType,
} from 'src/types/commonTypes';

import { roomIds } from 'src/constants/commonConstants';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  public messages: MessageListType = {};
  public roomUsers: { [roomId: string]: RoomUsersType } = {};

  @WebSocketServer() server: Server;

  // USER JOIN ROOM
  @SubscribeMessage('joinroom')
  handleJoinRoom(
    @MessageBody() data: { roomId: string; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.roomId);

    // Store user info on the socket for later use
    client.data.userName = data.userName;
    client.data.roomId = data.roomId;
    client.data.clientId = client.id;

    // If messages is empty
    if (!this.messages[data.roomId]) {
      this.messages[data.roomId] = [];
    }

    // If roomIds is empty
    if (!this.roomUsers[data.roomId]) {
      roomIds.push(data.roomId);
      this.roomUsers[data.roomId] = [];
    }

    // Add user to room-specific user list
    if (
      !this.roomUsers[data.roomId].find(
        (user) => user.name === data.userName && user.clientId === client.id,
      )
    ) {
      this.roomUsers[data.roomId].push({
        // id: this.roomUsers[data.roomId].length + 1,
        name: data.userName,
        clientId: client.id,
      });
    }

    console.log(`Client ${client.id} joined room ${data.roomId}`);
    console.log('roomUsers', this.roomUsers);

    this.server.to(data.roomId).emit('clientId', client.id);
    this.server.to(data.roomId).emit('prefetch', this.messages[data.roomId]);
    this.server.to(data.roomId).emit('users', this.roomUsers[data.roomId]);
  }

  // USER ADD MESSAGE
  @SubscribeMessage('message:add')
  handleNewMessage(
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
    console.log('added messages', this.messages);
  }

  // USER EDIT MESSAGE
  @SubscribeMessage('message:edit')
  handleEditMessage(
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
    console.log('edited messages', this.messages);
  }

  // USER REPLY TO A MESSAGE
  @SubscribeMessage('message:replyToMessage')
  handleReplyToMessage(
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

    const newMessage = {
      ...data.message,
      messageId: uuidv4(),
      isEdited: false,
      isDeleted: false,
      editedAt: '',
    };
    this.server.to(data.roomId).emit('reply', newMessage);
    this.messages[data.roomId].push(newMessage);
    console.log('reply to messages', this.messages);
  }

  // USER DELETE MESSAGE
  @SubscribeMessage('message:delete')
  handleDeleteMessage(
    @MessageBody()
    data: {
      roomId: string;
      messageId: string;
    },
    // @ConnectedSocket() client: Socket,
  ) {
    this.messages[data.roomId] = this.messages[data.roomId].map((message) => {
      if (message.messageId === data.messageId) {
        return { ...message, isDeleted: true };
      } else {
        return message;
      }
    });

    this.server.to(data.roomId).emit('prefetch', this.messages[data.roomId]);
    console.log('deleted messages', this.messages);
  }

  // SOCKET CONNECTION
  handleConnection(client: Socket) {
    console.log('client connected', client.id);
  }

  // SOCKET DISCONNECTION
  handleDisconnect(client: Socket) {
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
