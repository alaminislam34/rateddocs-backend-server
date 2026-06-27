
import status from "http-status";
import { AppError } from "../errors/AppError.js";

export const mapBetterAuthError = (error: unknown): AppError => {
    if (error instanceof AppError) {
        return error;
    }

    const authError = error as {
        statusCode?: number;
        status?: number;
        body?: {
            code?: string;
            message?: string;
        };
        message?: string;
    };

    const statusCode =
        authError.statusCode || authError.status || status.INTERNAL_SERVER_ERROR;
    const code = authError.body?.code ?? "AUTH_ERROR";

    const friendlyMessages: Record<string, string> = {
        INVALID_EMAIL: "Please provide a valid email address.",
        INVALID_PASSWORD: "Please provide a valid password.",
        INVALID_EMAIL_OR_PASSWORD: "Invalid email or password.",
        USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
            "An account with this email already exists.",
        PASSWORD_TOO_SHORT: "Password is too short.",
        PASSWORD_TOO_LONG: "Password is too long.",
        EMAIL_NOT_VERIFIED: "Please verify your email address before signing in.",
        EMAIL_PASSWORD_SIGN_UP_DISABLED: "Email and password sign up is disabled.",
        EMAIL_PASSWORD_DISABLED: "Email and password sign in is disabled.",
    };

    const message =
        friendlyMessages[code] ??
        authError.body?.message ??
        authError.message ??
        "Authentication failed.";

    return new AppError(statusCode, message, undefined, true, code);
};