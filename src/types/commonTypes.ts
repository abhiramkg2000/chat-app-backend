export type MessageType = {
  name: string;
  value: string;
  clientId: string;
  messageId: string;
  createdAt?: Date | string;
  isEdited: boolean;
  updatedAt?: Date | string;
  isDeleted: boolean;
  replyTo: string;
};

export type MessageListType = {
  [roomId: string]: MessageType[];
};

export type RoomUserType = {
  name: string;
  clientId: string;
};

export type RoomUsersType = RoomUserType[];
