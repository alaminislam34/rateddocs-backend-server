import { z } from 'zod';
import {
  registerDentistSchema,
  submitProfessionalDataSchema,
  checkLicenseSchema,
  submitLicenseSchema,
  submitOperationsSchema,
  submitClinicDepthSchema,
} from './dentist.validation.js';
import { VerificationStatus } from '../../generated/prisma/index.js';

export interface IVerificationProgress {
  is_step_one_completed: boolean;
  is_step_two_completed: boolean;
  is_step_three_completed: boolean;
  step_one_status: VerificationStatus;
  step_two_status: VerificationStatus;
  step_three_status: VerificationStatus;
  is_verified: boolean;
  verification_phase: string;
  progress_percentage: number;
  score: number;
  steps: Array<{
    phase: string;
    completed: boolean;
    status: VerificationStatus;
  }>;
  dentistLicense: {
    country: string;
    city: string;
    registrationAuthority: string;
    registrationNumber: string;
    licenseDocument: string | null;
    image: string | null;
  } | null;
  dentistOperations: {
    jciCertificate: string | null;
    walkthroughVideo: string | null;
    signerName: string | null;
    signature: string | null;
    agreedToGuarantee: boolean;
  } | null;
  procedures: Array<{
    id: string;
    procedureName: string;
    price: number;
    notes: string | null;
  }>;
}

export type IRegisterDentist = z.infer<typeof registerDentistSchema>['body'];
export type ISubmitProfessionalData = z.infer<typeof submitProfessionalDataSchema>['body'];
export type ICheckLicense = z.infer<typeof checkLicenseSchema>['body'];
export type ISubmitLicense = z.infer<typeof submitLicenseSchema>['body'];
export type ISubmitOperations = z.infer<typeof submitOperationsSchema>['body'];
export type ISubmitClinicDepth = z.infer<typeof submitClinicDepthSchema>['body'];
