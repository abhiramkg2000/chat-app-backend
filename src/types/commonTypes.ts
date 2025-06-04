export type MessageType = {
  name: string;
  value: string;
  clientId:string;
};

export type MessageListType = {
  [roomId: string]: MessageType[];
};

export type RoomUserType = {
  // id: number;
  name: string;
  clientId: string;
};

export type RoomUsersType = RoomUserType[];
