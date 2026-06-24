import { z } from 'zod';
import { Gender } from '../../generated/prisma/index.js';

export const registerDentistSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    gender: z.nativeEnum(Gender),
    country: z.string().min(1, 'Country is required'),
    referralCode: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

export const submitProfessionalDataSchema = z.object({
  body: z.object({
    legalName: z.string().min(1, 'Legal name is required'),
    yearsOfExperience: z.number().int().min(0, 'Years of experience must be a non-negative number'),
    primarySpecialty: z.string().min(1, 'Primary specialty is required'),
    country: z.string().min(1, 'Country is required'),
    city: z.string().min(1, 'City is required'),
  }),
});

export const checkLicenseSchema = z.object({
  body: z.object({
    country: z.string().min(1, 'Country is required'),
    city: z.string().min(1, 'City is required'),
    registrationAuthority: z.string().min(1, 'Registration authority is required'),
    registrationNumber: z.string().min(1, 'Registration number is required'),
  }),
});

export const submitLicenseSchema = z.object({
  body: z.object({
    country: z.string().min(1, 'Country is required'),
    city: z.string().min(1, 'City is required'),
    registrationAuthority: z.string().min(1, 'Registration authority is required'),
    registrationNumber: z.string().min(1, 'Registration number is required'),
  }),
});

export const submitOperationsSchema = z.object({
  body: z.object({
    signerName: z.string().min(1, 'Signer name is required'),
    signature: z.string().min(1, 'Signature is required'),
    agreedToGuarantee: z.preprocess(
      (val) => val === 'true' || val === true,
      z.boolean().refine(val => val === true, 'You must agree to the guarantee')
    ),
    procedures: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
        return val;
      },
      z.array(z.object({
        // Free-text procedure name — backend will slug-match or create in GlobalProcedure
        procedureName: z.string().min(1, 'Procedure name is required'),
        price: z.preprocess((val) => Number(val), z.number().positive('Price must be greater than 0')),
        notes: z.string().optional(),
      })).optional()
    ),
  }),
});

export const submitClinicDepthSchema = z.object({
  body: z.object({
    clinicAddress: z.string().min(1, 'Clinic address is required'),
    procedureDocs: z.array(z.object({
      dentistProcedureId: z.string().min(1, 'Dentist procedure ID is required'),
      ceCertificate: z.string().url('CE Certificate must be a valid URL').optional().or(z.literal('')),
      materialBrands: z.string().optional().or(z.literal('')),
      invoice: z.string().url('Invoice must be a valid URL').optional().or(z.literal('')),
      protocolPdf: z.string().url('Protocol PDF must be a valid URL').optional().or(z.literal('')),
    })).min(1, 'At least one procedure document must be provided'),
  }),
});
