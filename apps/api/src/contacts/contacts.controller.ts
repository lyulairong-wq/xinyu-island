import { Controller, Get } from "@nestjs/common";
import { OFFICIAL_CONTACTS } from "./official-contacts";

@Controller("contacts")
export class ContactsController {
  @Get("official")
  listOfficial() {
    return OFFICIAL_CONTACTS;
  }
}
