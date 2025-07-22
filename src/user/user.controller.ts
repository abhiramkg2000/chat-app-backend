import { Controller, Post, Body, Res, Req, Get } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';

import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

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
  async loginUser(
    @Body()
    data: {
      name: string;
      password: string;
      roomId: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log('User login data:', data);
    console.log('JWT_SECRET at runtime:', process.env.JWT_SECRET);

    const authStatus = await this.userService.loginUser(data);
    const { validUserName, validUserPassword } = authStatus;

    if (validUserName && validUserPassword) {
      const token = this.jwtService.sign({
        name: data.name,
        roomId: data.roomId,
      });

      // Set accessToken as HTTP-only cookie
      res.cookie('accessToken', token, {
        httpOnly: true,
        // sameSite: 'lax',
        // secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        secure: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      });
    }
    return authStatus;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.cookie('accessToken', '', {
      httpOnly: true,
      // sameSite: 'lax',
      // secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      secure: true,
      expires: new Date(0), // set cookie expiration to the past
    });
    return { message: 'Logged out successfully' };
  }

  @Get('authentication')
  async me(@Req() req: Request) {
    const token = req.cookies['accessToken'];

    if (!token) return { authenticated: false };

    try {
      await this.jwtService.verifyAsync(token);
      return {
        authenticated: true,
      };
    } catch (err) {
      return { authenticated: false };
    }
  }
}
