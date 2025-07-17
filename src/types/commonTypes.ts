export type MessageType = {
  name: string;
  value: string;
  clientId: string;
  messageId: string;
  isEdited: boolean;
  editedAt: string;
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
