import { prisma } from '../../config/db.js';
import { IPersonalizeDataPayload } from './patient.interface.js';

const PersonalizeData = async (userId: string, payload: IPersonalizeDataPayload) => {
  const {
    firstName,
    lastName,
    gender,
    phoneNumber,
    dateOfBirth,
    country,
    preferedProcedureId,
    preferedBudget,
    travelTime,
  } = payload;

  return await prisma.$transaction(async (tx) => {
    // 1. Update User details
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        gender,
        name: `${firstName} ${lastName}`.trim(),
      },
    });

    // 2. Find or create Patient profile, and update details
    const patient = await tx.patient.upsert({
      where: { userId },
      update: {
        phoneNumber,
        country,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
      create: {
        userId,
        phoneNumber,
        country,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });

    // 3. Update or create PersonalizationData
    await tx.personalizationData.upsert({
      where: { patientId: patient.id },
      update: {
        globalProcedureId: preferedProcedureId,
        budget: preferedBudget,
        travelStartDate: travelTime?.fromDate ? new Date(travelTime.fromDate) : null,
        travelEndDate: travelTime?.toDate ? new Date(travelTime.toDate) : null,
      },
      create: {
        patientId: patient.id,
        globalProcedureId: preferedProcedureId,
        budget: preferedBudget,
        travelStartDate: travelTime?.fromDate ? new Date(travelTime.fromDate) : null,
        travelEndDate: travelTime?.toDate ? new Date(travelTime.toDate) : null,
      },
    });

    return { message: 'Personalization data saved successfully' };
  });
};

export const PatientService = {
  PersonalizeData,
};
