-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'PENDIENTE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'PRESENTE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'AUSENTE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'JUSTIFICADO';
ALTER TYPE "AttendanceStatus" ADD VALUE 'TARDANZA';
ALTER TYPE "AttendanceStatus" ADD VALUE 'PARTICIPACION_REMOTA';

-- AlterEnum
ALTER TYPE "MeetingStatus" ADD VALUE 'BORRADOR';
ALTER TYPE "MeetingStatus" ADD VALUE 'CONVOCADA';

-- DropForeignKey
ALTER TABLE "meeting_participants" DROP CONSTRAINT "meeting_participants_user_id_fkey";

-- AlterTable
ALTER TABLE "meeting_participants" ADD COLUMN     "arrival_time" TIMESTAMP(3),
ADD COLUMN     "external_email" VARCHAR(255),
ADD COLUMN     "external_name" VARCHAR(150),
ADD COLUMN     "external_organization" VARCHAR(200),
ADD COLUMN     "is_external" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "participation_condition" VARCHAR(50) NOT NULL DEFAULT 'TITULAR',
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "folio" VARCHAR(50) NOT NULL,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "presided_by_id" UUID,
ADD COLUMN     "real_end_time" TIMESTAMP(3),
ADD COLUMN     "real_start_time" TIMESTAMP(3),
ADD COLUMN     "secretary_by_id" UUID,
ADD COLUMN     "timezone" VARCHAR(60) NOT NULL DEFAULT 'America/Mexico_City',
ADD COLUMN     "updated_by_id" UUID,
ADD COLUMN     "virtual_url" VARCHAR(500);

-- CreateTable
CREATE TABLE "meeting_convocatorias" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "convocatoria_number" VARCHAR(60) NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notice_text" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "published_by_id" UUID,
    "recipients" JSONB,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_convocatorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_agenda_items" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "responsible_name" VARCHAR(150),
    "responsible_user_id" UUID,
    "estimated_minutes" INTEGER,
    "item_type" VARCHAR(50) NOT NULL DEFAULT 'ASUNTOS_ORDINARIOS',
    "observations" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    "is_treated" BOOLEAN NOT NULL DEFAULT false,
    "treated_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendance_history" (
    "id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "previous_status" "AttendanceStatus" NOT NULL,
    "new_status" "AttendanceStatus" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "justification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_attendance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_session_logs" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "entry_type" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "agenda_item_id" UUID,
    "registered_by_id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "minutes_number" VARCHAR(60) NOT NULL,
    "elaboration_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "real_start_time" TIMESTAMP(3),
    "real_end_time" TIMESTAMP(3),
    "location_or_modality" VARCHAR(255),
    "presided_by_name" VARCHAR(200),
    "secretary_by_name" VARCHAR(200),
    "summary" TEXT NOT NULL,
    "points_treated_summary" TEXT,
    "observations" TEXT,
    "incidents" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
    "approved_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "approval_notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minutes_versions" (
    "id" UUID NOT NULL,
    "minutes_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "points_treated_summary" TEXT,
    "observations" TEXT,
    "incidents" TEXT,
    "status" VARCHAR(30) NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_minutes_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_convocatorias_meeting_id_key" ON "meeting_convocatorias"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_convocatorias_convocatoria_number_key" ON "meeting_convocatorias"("convocatoria_number");

-- CreateIndex
CREATE INDEX "meeting_agenda_items_meeting_id_order_index_idx" ON "meeting_agenda_items"("meeting_id", "order_index");

-- CreateIndex
CREATE INDEX "meeting_attendance_history_participant_id_idx" ON "meeting_attendance_history"("participant_id");

-- CreateIndex
CREATE INDEX "meeting_session_logs_meeting_id_timestamp_idx" ON "meeting_session_logs"("meeting_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_meeting_id_key" ON "meeting_minutes"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_minutes_number_key" ON "meeting_minutes"("minutes_number");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_versions_minutes_id_version_number_key" ON "meeting_minutes_versions"("minutes_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_folio_key" ON "meetings"("folio");

-- CreateIndex
CREATE INDEX "meetings_status_idx" ON "meetings"("status");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_presided_by_id_fkey" FOREIGN KEY ("presided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_secretary_by_id_fkey" FOREIGN KEY ("secretary_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_convocatorias" ADD CONSTRAINT "meeting_convocatorias_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_convocatorias" ADD CONSTRAINT "meeting_convocatorias_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance_history" ADD CONSTRAINT "meeting_attendance_history_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "meeting_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance_history" ADD CONSTRAINT "meeting_attendance_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_session_logs" ADD CONSTRAINT "meeting_session_logs_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_session_logs" ADD CONSTRAINT "meeting_session_logs_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_session_logs" ADD CONSTRAINT "meeting_session_logs_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "meeting_agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes_versions" ADD CONSTRAINT "meeting_minutes_versions_minutes_id_fkey" FOREIGN KEY ("minutes_id") REFERENCES "meeting_minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes_versions" ADD CONSTRAINT "meeting_minutes_versions_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

