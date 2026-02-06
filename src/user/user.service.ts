import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from 'src/user/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async registerUser(registerData: { name: string; password: string }) {
    try {
      // Existing user check
      const existingUser = await this.userModel.findOne({
        name: registerData.name,
      });

      if (existingUser) {
        return {
          message: 'User already exists, please enter a different user name',
          success: false,
        };
      }

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        registerData.password,
        saltRounds,
      );

      // Register the new user
      await this.userModel.create({
        name: registerData.name,
        password: hashedPassword,
      });

      return { message: 'User registration successful', success: true };
    } catch (error) {
      console.error('Error in register user', error);
      return {
        message: 'Register failed due to server error',
        success: false,
      };
    }
  }

  async loginUser(loginData: { name: string; password: string }) {
    try {
      const response = {
        message: '',
        validUserName: true,
        validUserPassword: true,
      };

      // Existing user check
      const existingUser = await this.userModel.findOne({
        name: loginData.name,
      });

      if (!existingUser) {
        response.message = 'User does not exist, please check the user name';
        response.validUserName = false;
        response.validUserPassword = false;
      } else {
        const isPasswordValid = await bcrypt.compare(
          loginData.password,
          existingUser.password,
        );

        if (!isPasswordValid) {
          response.message = 'Invalid credentials';
          response.validUserName = true;
          response.validUserPassword = false;
        } else {
          response.message = 'Login successful';
        }
      }

      return response;
    } catch (error) {
      console.error('Error in login user', error);
      return {
        message: 'Login failed due to server error',
        validUserName: false,
        validUserPassword: false,
      };
    }
  }
}
