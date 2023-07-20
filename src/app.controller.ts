import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  //O construtor é um método especial para criar e inicializar um objeto criado a partir de uma classe
  constructor(private readonly appService: AppService) { }


  @Get()
  getHello() {
    return this.appService;
  }

  @Get("/texte")
  getHellofromroutText() {
    return this.appService.getHellofromroutText();

  }

}
