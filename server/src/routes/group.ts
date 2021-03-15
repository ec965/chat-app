import express from 'express';
import { GroupEntity } from '../entity/group';
import { UserEntity } from '../entity/user';

import { pipe } from 'fp-ts/lib/function';
import { fold } from 'fp-ts/Either';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';

export class GroupRouter {
  public router = express.Router();

  constructor(){
    this.postNewGroup();
    this.getGroupsForUser();
  }

  private postNewGroup(){
    const NewGroupReq = t.type({
      userIds: t.array(t.number),
      groupName: t.string,
    });
    type NewGroupReq = t.TypeOf<typeof NewGroupReq>;

    this.router.post("/", (req, res, next) => {
      const onLeft = async (errors: t.Errors) => res.sendStatus(400);
      const onRight = async (body: NewGroupReq) => {
        const userIds = body.userIds;        
        // check if the group already exists
        try {
          const existingGroupId = await GroupEntity.doesGroupExist(userIds);
          if(existingGroupId !== -1) return res.json({groupId: existingGroupId});
        } catch (err) { 
          next(err); 
        }
        // else create the group
        try {
          const users: Array<UserEntity> = await UserEntity.findByIds(userIds);
          if(users.length !== userIds.length) return res.json({message: "Some users where not found."});
          
          // if all users are found
          let group = await GroupEntity.createGroupWithUsers(users, body.groupName);
          res.json(group);
        } catch(err) {
          next(err);
        }
      }

      pipe(NewGroupReq.decode(req.body), fold(onLeft, onRight));
    });
  }
  
  private getGroupsForUser(){
    // query parameters
    const GetGroupsReq = t.type({
      count: tt.NumberFromString,
      date: tt.DateFromISOString,
    });
    type GetGroupsReq = t.TypeOf<typeof GetGroupsReq>;
    const COUNTMAX = 200;
    const countMaxLimiter = (count: number) => count > COUNTMAX ? COUNTMAX : count;

    this.router.get('/', async (req, res, next) => {
      const onLeft = async (errors: t.Errors) => res.sendStatus(400);

      const onRight = async (query: GetGroupsReq) => {
        if(!req.user) return res.sendStatus(400); // theoretically this should never happen b/c it's caught by passport

        query.count = countMaxLimiter(query.count);

        try{
          const groups = await GroupEntity.findGroupsOfUserId(req.user.id, query.count, query.date);
          if(!groups) return res.sendStatus(400);

          res.json(groups);
        } catch(err) {
          next(err);
        }
      }
      pipe(GetGroupsReq.decode(req.query), fold(onLeft, onRight));
    });
  }
}