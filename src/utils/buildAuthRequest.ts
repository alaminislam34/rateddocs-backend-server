import { Request } from "express";
import { envVars } from "../config/env.js";

export const buildAuthRequest = (req: Request, body: unknown): globalThis.Request => {
    const headers = new Headers(req.headers as HeadersInit);

    if (!headers.get("origin")) {
        headers.set("origin", envVars.BETTER_AUTH_URL);
    }

    return new globalThis.Request(
        new URL(req.originalUrl, envVars.BETTER_AUTH_URL),
        {
            method: req.method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        },
    );
};