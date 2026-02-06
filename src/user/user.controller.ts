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
    // console.log('JWT_SECRET at runtime:', process.env.JWT_SECRET);

    const authStatus = await this.userService.loginUser(data);
    const { validUserName, validUserPassword } = authStatus;

    if (validUserName && validUserPassword) {
      // Sign the JWT token
      const token = this.jwtService.sign({
        name: data.name,
        roomId: data.roomId,
      });

      // Detect environment (dev/prod)
      const isProd = process.env.NODE_ENV === 'production';

      // Set accessToken as HTTP-only cookie
      res.cookie('accessToken', token, {
        httpOnly: true,
        sameSite: isProd ? 'none' : 'lax', // cross-site in prod, relaxed in dev
        secure: isProd, // only send over HTTPS in prod
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      });
    }
    return authStatus;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    // Detect environment (dev/prod)
    const isProd = process.env.NODE_ENV === 'production';

    // Remove accessToken from HTTP-only cookie
    res.cookie('accessToken', '', {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax', // cross-site in prod, relaxed in dev
      secure: isProd, // only send over HTTPS in prod
      expires: new Date(0), // set cookie expiration to the past
    });
    return { message: 'Logged out successfully' };
  }

  @Get('authentication')
  async isAuthenticated(@Req() req: Request) {
    try {
      const token = req.cookies['accessToken'];

      if (!token) {
        return { authenticated: false };
      }

      // Verify the JWT token
      await this.jwtService.verifyAsync(token);

      return {
        authenticated: true,
      };
    } catch (error) {
      console.error('Authentication error', error);
      return { authenticated: false };
    }
  }
}
