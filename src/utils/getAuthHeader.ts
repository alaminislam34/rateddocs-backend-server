import { Request } from "express";
import { envVars } from "../config/env.js";

export const getAuthHeaders = (req: Request) => {
    const headers = new Headers(req.headers as HeadersInit);

    if (!headers.get("origin")) {
        headers.set("origin", envVars.BETTER_AUTH_URL);
    }

    return headers;
};