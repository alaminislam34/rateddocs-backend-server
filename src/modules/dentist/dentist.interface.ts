import { z } from 'zod';
import {
  registerDentistSchema,
  submitProfessionalDataSchema,
  checkLicenseSchema,
  submitLicenseSchema,
  submitOperationsSchema,
  submitClinicDepthSchema,
} from './dentist.validation.js';

export type IRegisterDentist = z.infer<typeof registerDentistSchema>['body'];
export type ISubmitProfessionalData = z.infer<typeof submitProfessionalDataSchema>['body'];
export type ICheckLicense = z.infer<typeof checkLicenseSchema>['body'];
export type ISubmitLicense = z.infer<typeof submitLicenseSchema>['body'];
export type ISubmitOperations = z.infer<typeof submitOperationsSchema>['body'];
export type ISubmitClinicDepth = z.infer<typeof submitClinicDepthSchema>['body'];
