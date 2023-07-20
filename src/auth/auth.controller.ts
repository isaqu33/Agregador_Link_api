import { CreateUserDto } from './../user/dto/create-user.dto';
import { UserRecord } from 'firebase-admin/auth';
import { UserService } from 'src/user/user.service';
import { UserFirebase } from './userFirebase';
import { JwtAuthService } from './../jwt/jwt.service';
import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';


@Controller('auth')
export class AuthController {
  constructor(
    private jwtAuthService: JwtAuthService,
    private firebase: UserFirebase,
    private userService: UserService
  ) { }


  @Post("login")
  async authLogin(@Req() req: Request, @Res() res: Response) {

    const uidReq: string = req.body.uid;

    console.log(uidReq)

    if (uidReq) {

      // aqui, com o uid que veio na requisição do front, vamos verificar de fato a existencia no firebase
      const userOnfirebase: any | UserRecord = await this.firebase.getUser(uidReq)
      console.log("console onde tem o user vindo do firebase admin" + userOnfirebase)


      // caso exista de fato esse user no firebase
      if (userOnfirebase) {
        console.log("user existe em nossa base")


        const { email, displayName }: UserRecord = userOnfirebase

        // aqui com o email disponibilizado pelo firebaseAdimin, vamos ver se existe esse user em nosso banco de dados
        const userInOurBase = await this.userService.findOne(email)

        // caso não exista em nossa base de dados, vamos enjetar esse mesmo user em nosso bvanco com os dados disponíveis do firebaseAdmin
        if (!userInOurBase) {

          const newUser = await this.userService.createNewUser(
            {
              name: displayName,
              email: email,
            } as CreateUserDto
          )

          const user = await this.userService.findOne(email)
          const sub = user.id
          const username = user.email

          const { accessToken } = this.jwtAuthService.login({ sub, username });

          return res.json({ accessToken })
        }
        if (userInOurBase) {
          
          const sub = userInOurBase.id
          const username = userInOurBase.email

          const { accessToken } = this.jwtAuthService.login({ sub, username });

          return res.json({ accessToken })

        }
      }
    }
  }


}
