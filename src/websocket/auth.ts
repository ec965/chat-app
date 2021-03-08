import { UserEntity } from '../entity/user';
import { GroupEntity } from '../entity/group';
import { IdWebsocket } from './chat_tracker/idwebsocket';

export class WsGroupAuthenticator{
  static async verifyInDatabase(userId: number, groupId: number): Promise<boolean>{
    const user = await UserEntity.findOne({
      where: {id: userId},
    });
    const group = await GroupEntity.findOne({
      where: {id: groupId},
      relations: ["users"]
    })
    if(!user || !group){
      return false;
    }
    return WsGroupAuthenticator.findUserInGroup(user.id, group);
  }

  private static findUserInGroup(userId: number, group:GroupEntity): boolean{
    for(let user of group.users){
      if (user.id === userId) return true;
    }
    return false;
  }

  static addUserToGroupMap(groupMap: Map<number, Array<IdWebsocket>>, userId: number, groupId: number, websocket: WebSocket){
    const userIdWs: IdWebsocket = {id: userId, ws: websocket};
    
    // verify the group is currently active
    if (groupMap.has(groupId)){
      const group = groupMap.get(groupId);
      // check if the user is already in the group
      if(group){
        if(!group.find(idws => idws.id === userId)){
          group.push(userIdWs);
        }
      } else { // group is not active so we have to create it
        groupMap.set(groupId, [userIdWs])
      }
    }
  }
}