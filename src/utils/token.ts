import { JwtPayload, SignOptions } from "jsonwebtoken";
import { jwtUtils } from "./jwt.js";
import { cookieUtils } from "./cookie.js";
import { Response } from "express";
import { envVars } from "../config/env.js";

const isProduction = envVars.NODE_ENV === "production";

const commonCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "strict") as "none" | "strict",
};

const getAccessToken = (payload: JwtPayload) => {
  const accessToken = jwtUtils.createToken(
    payload,
    envVars.ACCESS_TOKEN_SECRET as string,
    { expiresIn: envVars.ACCESS_TOKEN_EXPIRES_IN as string } as SignOptions,
  );
  return accessToken;
};

const getRefreshToken = (payload: JwtPayload) => {
  const refreshToken = jwtUtils.createToken(
    payload,
    envVars.REFRESH_TOKEN_SECRET as string,
    { expiresIn: envVars.REFRESH_TOKEN_EXPIRES_IN as string } as SignOptions,
  );
  return refreshToken;
};

const setAccessTokenCookie = (res: Response, token: string) => {
  cookieUtils.setCookie(res, "accessToken", token, {
    ...commonCookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });
};

const setRefreshTokenCookie = (res: Response, token: string) => {
  cookieUtils.setCookie(res, "refreshToken", token, {
    ...commonCookieOptions,
    // 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const setBetterAuthSessionTokenCookie = (res: Response, token: string) => {
  cookieUtils.setCookie(res, "better-auth.session_token", token, {
    ...commonCookieOptions,
    // 1 days
    maxAge: 24 * 60 * 60 * 1000,
  });
};

export const tokenUtils = {
  getAccessToken,
  getRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setBetterAuthSessionTokenCookie,
};