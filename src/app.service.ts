import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return 'Hello World!';
  }

  getHellofromroutText() {
    return "hello from route texte"
  }
}
