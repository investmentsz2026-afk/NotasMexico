-- ==============================================================================
-- MIGRACIÓN ADITIVA FASE 7 — NOTIFICACIONES INSTITUCIONALES Y SMTP (MOD-06)
-- Base de datos: Neon PostgreSQL Serverless
-- Módulo: Notifications, Preferences & Deliveries (Transactional Outbox)
-- ==============================================================================

-- 1. Crear tipos enumerados institucionales
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
        CREATE TYPE "NotificationType" AS ENUM (
            'REUNION_CONVOCATORIA',
            'REUNION_MODIFICADA',
            'REUNION_CANCELADA',
            'ACTA_PUBLICADA',
            'ACUERDO_ASIGNADO',
            'ACUERDO_ACTUALIZADO',
            'ACUERDO_ESTADO_CAMBIO',
            'NOTA_COMPARTIDA',
            'DOCUMENTO_ADJUNTO',
            'INSTITUCIONAL_GENERAL'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN
        CREATE TYPE "NotificationChannel" AS ENUM (
            'IN_APP',
            'EMAIL',
            'AMBOS'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
        CREATE TYPE "DeliveryStatus" AS ENUM (
            'PENDIENTE',
            'EN_PROCESO',
            'ENVIADO',
            'FALLIDO',
            'DESCARTADO'
        );
    END IF;
END $$;

-- 2. Crear tabla de Notificaciones Internas
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" VARCHAR(100),
    "action_url" VARCHAR(255),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- 3. Crear tabla de Preferencias de Notificación
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "meeting_alerts" BOOLEAN NOT NULL DEFAULT true,
    "agreement_alerts" BOOLEAN NOT NULL DEFAULT true,
    "minutes_alerts" BOOLEAN NOT NULL DEFAULT true,
    "general_alerts" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- 4. Crear tabla de Entregas y Cola Transaccional (Transactional Outbox)
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient_email" VARCHAR(255),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDIENTE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "idempotency_key" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- 5. Claves foráneas y restricciones únicas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_user_id_key') THEN
        ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_deliveries_idempotency_key_key') THEN
        ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_idempotency_key_key" UNIQUE ("idempotency_key");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_user_id_fkey') THEN
        ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_deliveries_notification_id_fkey') THEN
        ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey"
            FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. Índices de consulta de alto rendimiento
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");
CREATE INDEX IF NOT EXISTS "notification_deliveries_idempotency_key_idx" ON "notification_deliveries"("idempotency_key");

