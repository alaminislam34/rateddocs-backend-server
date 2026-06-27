import { Router } from 'express';
import { userRoutes } from '../modules/user/user.route.js';
import { fileRoutes } from '../modules/file/file.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { dentistRoutes } from '../modules/dentist/dentist.route.js';
import { patientRoutes } from '../modules/patient/patient.route.js';
import { adminRoutes } from '../modules/admin/admin.route.js';
import { procedureRoutes } from '../modules/procedure/procedure.route.js';
import { specialtyRoutes } from '../modules/specialty/specialty.route.js';

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
  {
    path: '/patients',
    route: patientRoutes,
  },
  {
    path: '/admin',
    route: adminRoutes,
  },
  {
    path: '/procedures',
    route: procedureRoutes,
  },
  {
    path: '/specialties',
    route: specialtyRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export const indexRoutes = router;
export default router;
