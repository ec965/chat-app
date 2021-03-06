import jwt_decode from 'jwt-decode';

export interface JwtUserInterface {
  id: number;
  name: string;
  email: string;
}

export interface JwtContentInterface{
  user: JwtUserInterface;
  iat: number;
}

export function jwtToJwtUser(jwt: string): JwtUserInterface | undefined{
  try{
    const decode = jwt_decode<JwtContentInterface>(jwt);
    return decode.user as JwtUserInterface;
  } catch(error) {
    return undefined;
  }
}