import { Router } from 'express';
import { userRoutes } from '../modules/user/user.route.js';
import { fileRoutes } from '../modules/file/file.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { dentistRoutes } from '../modules/dentist/dentist.route.js';

const router = Router();

const moduleRoutes = [
    {
        path: '/users',
        route: userRoutes,
    },
    {
        path: '/files',
        route: fileRoutes,
    },
    {
        path: '/auth',
        route: authRoutes,
    },
    {
        path: '/dentists',
        route: dentistRoutes,
    },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export const indexRoutes = router;
export default router;
