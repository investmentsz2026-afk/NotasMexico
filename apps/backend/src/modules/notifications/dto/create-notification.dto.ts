import { NotificationType } from '@prisma/client';

export interface DispatchNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  recipientEmail?: string;
  forceEmail?: boolean;
  idempotencyKey?: string;
}

