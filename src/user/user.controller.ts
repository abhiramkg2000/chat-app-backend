import { Controller, Post, Body } from '@nestjs/common';

import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  registerUser(
    @Body()
    data: {
      name: string;
      password: string;
    },
  ) {
    console.log('User registration data:', data);
    return this.userService.registerUser(data);
  }

  @Post('login')
  loginUser(
    @Body()
    data: {
      name: string;
      password: string;
    },
  ) {
    console.log('User login data:', data);
    return this.userService.loginUser(data);
  }
}
