import { Injectable } from "@nestjs/common";
import { getAuth, UserRecord } from 'firebase-admin/auth'
import { getApp } from 'firebase-admin/app'
import { appFirebase } from "../firebase.gonfig";







@Injectable()
// RECEBE UID  E BUSCA O USUARIO AUTENTICADO NO FIREBASE
//RETORNA USUARIO OU FALSE
export class UserFirebase {

    async getUser(uid: string): Promise<any | UserRecord> {
        try {
            const user: UserRecord = await getAuth(appFirebase).getUser(uid)
            return user

        } catch (error) {

            return false

        }
    }
}