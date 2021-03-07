import WebSocket from "ws"
import { ServerMessage } from './servermesssage';
import {
  GenericWSMessage,
  GenericWSPayload,
} from './chatroom'
import { WsGroupAuthenticator } from './auth';
import { jwtToJwtUser } from '../auth/jwt';
import { IdWebsocket } from './chatroom';

// TX User message
interface TXMessage extends GenericWSMessage<TXPayload>{
  payload: TXPayload
}
interface TXPayload extends GenericWSPayload{
  groupId: number;
}
// RX User message
interface RXMessage extends GenericWSMessage<RXPayload> {
  payload: RXPayload
}
interface RXPayload extends TXPayload{
  token: string;
}
export class WsHandler {
  private groupId: number = -1;
  private userId: number = -1;
  private friendId: number = -1;
  private ws: WebSocket;

  constructor(ws: WebSocket, groupMap: Map<number, Array<IdWebsocket>>, friendMap: Map<number, number>){
    this.ws = ws;
    this.ws.on('message', this.toEvent); 
    this.ws.on('message error', ()=> {
      console.log('message error');
      ws.send(JSON.stringify(ServerMessage.badRequest()));
    });

    this.ws.on('join group', async (payload: RXPayload) => {
      const jwtUserInfo = jwtToJwtUser(payload.token);
      const userId = jwtUserInfo.id;
      const groupId = payload.groupId;
      
      try {
        const inDatabase = await WsGroupAuthenticator.verifyInDatabase(userId, groupId);
        if(inDatabase){
          WsGroupAuthenticator.addUserToGroupMap(groupMap, userId, groupId, this.ws);
          this.groupId = groupId;
          this.userId = userId;
          // send group chat history
        } else {
          ws.send(JSON.stringify(ServerMessage.badRequest()));
        }
      } catch(error) {
        console.error("Error verifying webosocket user: ", error);
        ws.send(JSON.stringify(ServerMessage.serverError()));
      }
    });

    ws.on('chat group', (payload: RXPayload) => {
      // verify the user is authenticated before allowing to chat
      if(this.groupId === -1 || this.userId === -1) {
        ws.send(JSON.stringify(ServerMessage.notAuthenticated()));
      }

      const group = groupMap.get(this.groupId);
      if (!group) return;
      group.forEach( idws => {
        if(idws.ws.readyState === WebSocket.OPEN){
          idws.ws.send(JSON.stringify(payload))
        }
      })
    });

    ws.on('close', () => {
      // remove the user from the room
      const group = groupMap.get(this.groupId);
      if (group){
        this.removeUserFromGroup(this.userId, group);

        if (group.length === 0)
          this.deleteEmptyGroup(groupMap, this.groupId);
      }
      console.log("closing websocket");
    });
  }
  
  private toEvent(message: string) {
    try{
      console.log("parsing incoming message");
      const event: RXMessage = JSON.parse(message);
      this.ws.emit(event.topic, event.payload);
    } catch(err) {
      console.error("RX messsge on websocket was not a valid json.");
      this.ws.emit("message error");
    }
  }

  private deleteEmptyGroup(groupMap: Map<number, Array<IdWebsocket>>, groupId: number){
    groupMap.delete(groupId);
  }

  private removeUserFromGroup(userId: number, group: Array<IdWebsocket>){
    const userIndex = group.findIndex(idws => idws.id === this.userId);
    if (userIndex !== -1){
      group.splice(1, userIndex);
    } 
  }

}