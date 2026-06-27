import { Gender } from '../../generated/prisma/index.js';

export interface IPersonalizeDataPayload {
  firstName: string;
  lastName: string;
  gender: Gender;
  phoneNumber: string;
  dateOfBirth: Date;
  country: string;
  preferedProcedureId: string;
  preferedBudget: number;
  travelTime: {
    fromDate: Date;
    toDate: Date;
    maxDistance: number;
  };
}
