/*
  Warnings:

  - You are about to drop the column `procedure_id` on the `personalization_data` table. All the data in the column will be lost.
  - You are about to drop the column `treatmentProcedureId` on the `personalization_data` table. All the data in the column will be lost.
  - You are about to drop the `Patient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `procedure` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `treatment_procedure` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `global_procedure_id` to the `personalization_data` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PATIENT', 'DENTIST', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LicenseVerifiedBy" AS ENUM ('ADMIN', 'SUPER_ADMIN', 'AUTHORITY', 'PLATFORM');

-- CreateEnum
CREATE TYPE "DentistVerificationPhase" AS ENUM ('LICENSE', 'OPERATIONS', 'CLINIC');

-- DropForeignKey
ALTER TABLE "personalization_data" DROP CONSTRAINT "personalization_data_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "personalization_data" DROP CONSTRAINT "personalization_data_procedure_id_fkey";

-- DropForeignKey
ALTER TABLE "personalization_data" DROP CONSTRAINT "personalization_data_treatmentProcedureId_fkey";

-- DropForeignKey
ALTER TABLE "procedure" DROP CONSTRAINT "procedure_user_id_fkey";

-- AlterTable
ALTER TABLE "personalization_data" DROP COLUMN "procedure_id",
DROP COLUMN "treatmentProcedureId",
ADD COLUMN     "budget" DECIMAL(10,2),
ADD COLUMN     "global_procedure_id" TEXT NOT NULL,
ADD COLUMN     "travel_end_date" DATE,
ADD COLUMN     "travel_start_date" DATE,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(6),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(6);

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "first_name" VARCHAR(255),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_name" VARCHAR(255),
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "emailVerified" SET DEFAULT false;

-- DropTable
DROP TABLE "Patient";

-- DropTable
DROP TABLE "procedure";

-- DropTable
DROP TABLE "treatment_procedure";

-- CreateTable
CREATE TABLE "admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" VARCHAR(25) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "referral_code" VARCHAR(50),
    "specialty_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_professional_data" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "legal_name" VARCHAR(255) NOT NULL,
    "years_of_experience" INTEGER,
    "city" VARCHAR(100) NOT NULL,

    CONSTRAINT "dentist_professional_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialty" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_license" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "registration_authority" VARCHAR(255) NOT NULL,
    "registration_number" TEXT NOT NULL,
    "license_document" VARCHAR(255),
    "verification_status" "LicenseVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(6),
    "verified_by" "LicenseVerifiedBy" DEFAULT 'PLATFORM',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentist_license_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_license_verification" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "verification_status" "LicenseVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(6),
    "verified_by" "LicenseVerifiedBy" DEFAULT 'PLATFORM',
    "verification_note" VARCHAR(255),
    "verification_request_note" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentist_license_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_operations_verification" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "jci_certificate" VARCHAR(255),
    "walkthrough_video" VARCHAR(255),
    "signer_name" VARCHAR(255),
    "signature" VARCHAR(255),
    "agreed_to_guarantee" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(6),
    "verified_by" "LicenseVerifiedBy" DEFAULT 'PLATFORM',
    "verification_note" VARCHAR(255),
    "verification_request_note" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentist_operations_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_clinic_depth_verification" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "clinic_address" VARCHAR(500),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(6),
    "verified_by" "LicenseVerifiedBy" DEFAULT 'PLATFORM',
    "verification_note" VARCHAR(255),
    "verification_request_note" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentist_clinic_depth_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_clinical_procedure_doc" (
    "id" TEXT NOT NULL,
    "clinic_depth_verification_id" TEXT NOT NULL,
    "dentist_procedure_id" TEXT NOT NULL,
    "ce_certificate" VARCHAR(255),
    "material_brands" VARCHAR(255),
    "invoice" VARCHAR(255),
    "protocol_pdf" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentist_clinical_procedure_doc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_verification_progress" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "current_phase" "DentistVerificationPhase" NOT NULL DEFAULT 'LICENSE',
    "next_phase" "DentistVerificationPhase" NOT NULL DEFAULT 'OPERATIONS',
    "rvd_score" DOUBLE PRECISION DEFAULT 0,
    "is_license_verification" BOOLEAN NOT NULL DEFAULT false,
    "is_operations_verification" BOOLEAN NOT NULL DEFAULT false,
    "is_clinic_depth_verification" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentist_verification_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" VARCHAR(25),
    "country" VARCHAR(100),
    "date_of_birth" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_procedure" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" TEXT NOT NULL,
    "specialty_id" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "global_procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_procedure" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "global_procedure_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dentist_procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plan" (
    "id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "treatment_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_line_item" (
    "id" TEXT NOT NULL,
    "treatment_plan_id" TEXT NOT NULL,
    "global_procedure_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "treatment_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_userId_key" ON "admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dentists_user_id_key" ON "dentists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dentists_referral_code_key" ON "dentists"("referral_code");

-- CreateIndex
CREATE INDEX "dentists_user_id_idx" ON "dentists"("user_id");

-- CreateIndex
CREATE INDEX "dentists_phone_number_idx" ON "dentists"("phone_number");

-- CreateIndex
CREATE INDEX "dentists_country_idx" ON "dentists"("country");

-- CreateIndex
CREATE INDEX "dentists_specialty_id_idx" ON "dentists"("specialty_id");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_professional_data_dentist_id_key" ON "dentist_professional_data"("dentist_id");

-- CreateIndex
CREATE INDEX "dentist_professional_data_dentist_id_idx" ON "dentist_professional_data"("dentist_id");

-- CreateIndex
CREATE UNIQUE INDEX "specialty_name_key" ON "specialty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "specialty_slug_key" ON "specialty"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_license_dentist_id_key" ON "dentist_license"("dentist_id");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_license_registration_number_key" ON "dentist_license"("registration_number");

-- CreateIndex
CREATE INDEX "dentist_license_dentist_id_verification_status_idx" ON "dentist_license"("dentist_id", "verification_status");

-- CreateIndex
CREATE INDEX "dentist_license_verification_dentist_id_idx" ON "dentist_license_verification"("dentist_id");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_operations_verification_dentist_id_key" ON "dentist_operations_verification"("dentist_id");

-- CreateIndex
CREATE INDEX "dentist_operations_verification_dentist_id_idx" ON "dentist_operations_verification"("dentist_id");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_clinic_depth_verification_dentist_id_key" ON "dentist_clinic_depth_verification"("dentist_id");

-- CreateIndex
CREATE INDEX "dentist_clinic_depth_verification_dentist_id_idx" ON "dentist_clinic_depth_verification"("dentist_id");

-- CreateIndex
CREATE INDEX "dentist_clinical_procedure_doc_clinic_depth_verification_id_idx" ON "dentist_clinical_procedure_doc"("clinic_depth_verification_id");

-- CreateIndex
CREATE INDEX "dentist_clinical_procedure_doc_dentist_procedure_id_idx" ON "dentist_clinical_procedure_doc"("dentist_procedure_id");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_verification_progress_dentist_id_key" ON "dentist_verification_progress"("dentist_id");

-- CreateIndex
CREATE INDEX "dentist_verification_progress_dentist_id_idx" ON "dentist_verification_progress"("dentist_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_user_id_key" ON "patient"("user_id");

-- CreateIndex
CREATE INDEX "patient_user_id_idx" ON "patient"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_procedure_name_key" ON "global_procedure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "global_procedure_slug_key" ON "global_procedure"("slug");

-- CreateIndex
CREATE INDEX "global_procedure_specialty_id_idx" ON "global_procedure"("specialty_id");

-- CreateIndex
CREATE INDEX "dentist_procedure_dentist_id_idx" ON "dentist_procedure"("dentist_id");

-- CreateIndex
CREATE INDEX "dentist_procedure_global_procedure_id_idx" ON "dentist_procedure"("global_procedure_id");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_procedure_dentist_id_global_procedure_id_key" ON "dentist_procedure"("dentist_id", "global_procedure_id");

-- CreateIndex
CREATE INDEX "treatment_plan_dentist_id_idx" ON "treatment_plan"("dentist_id");

-- CreateIndex
CREATE INDEX "treatment_plan_patient_id_idx" ON "treatment_plan"("patient_id");

-- CreateIndex
CREATE INDEX "treatment_line_item_treatment_plan_id_idx" ON "treatment_line_item"("treatment_plan_id");

-- CreateIndex
CREATE INDEX "treatment_line_item_global_procedure_id_idx" ON "treatment_line_item"("global_procedure_id");

-- CreateIndex
CREATE INDEX "personalization_data_patient_id_idx" ON "personalization_data"("patient_id");

-- CreateIndex
CREATE INDEX "personalization_data_global_procedure_id_idx" ON "personalization_data"("global_procedure_id");

-- AddForeignKey
ALTER TABLE "admin" ADD CONSTRAINT "admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentists" ADD CONSTRAINT "dentists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentists" ADD CONSTRAINT "dentists_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_professional_data" ADD CONSTRAINT "dentist_professional_data_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_license" ADD CONSTRAINT "dentist_license_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_license_verification" ADD CONSTRAINT "dentist_license_verification_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_operations_verification" ADD CONSTRAINT "dentist_operations_verification_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_clinic_depth_verification" ADD CONSTRAINT "dentist_clinic_depth_verification_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_clinical_procedure_doc" ADD CONSTRAINT "dentist_clinical_procedure_doc_clinic_depth_verification_i_fkey" FOREIGN KEY ("clinic_depth_verification_id") REFERENCES "dentist_clinic_depth_verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_clinical_procedure_doc" ADD CONSTRAINT "dentist_clinical_procedure_doc_dentist_procedure_id_fkey" FOREIGN KEY ("dentist_procedure_id") REFERENCES "dentist_procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_verification_progress" ADD CONSTRAINT "dentist_verification_progress_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personalization_data" ADD CONSTRAINT "personalization_data_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personalization_data" ADD CONSTRAINT "personalization_data_global_procedure_id_fkey" FOREIGN KEY ("global_procedure_id") REFERENCES "global_procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_procedure" ADD CONSTRAINT "global_procedure_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_procedure" ADD CONSTRAINT "dentist_procedure_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_procedure" ADD CONSTRAINT "dentist_procedure_global_procedure_id_fkey" FOREIGN KEY ("global_procedure_id") REFERENCES "global_procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan" ADD CONSTRAINT "treatment_plan_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan" ADD CONSTRAINT "treatment_plan_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_line_item" ADD CONSTRAINT "treatment_line_item_treatment_plan_id_fkey" FOREIGN KEY ("treatment_plan_id") REFERENCES "treatment_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_line_item" ADD CONSTRAINT "treatment_line_item_global_procedure_id_fkey" FOREIGN KEY ("global_procedure_id") REFERENCES "global_procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
