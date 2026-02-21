import { z } from 'zod';

// Phone number validation (accepts various formats)
const phoneRegex = /^(\+1)?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

export const marketedLeadSchema = z.object({
  customerName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  phone: z
    .string()
    .min(10, 'Phone number is required')
    .regex(phoneRegex, 'Please enter a valid phone number'),
  source: z.enum([
    'Google Ads',
    'Facebook',
    'Referral',
    'Website',
    'Direct Mail',
    'Other',
  ]),
  unitAge: z
    .number()
    .min(0, 'Unit age cannot be negative')
    .max(50, 'Unit age seems too high')
    .optional()
    .nullable(),
  systemType: z.enum(['Gas', 'Heat Pump', 'Unknown']).optional(),
  address: z
    .string()
    .max(200, 'Address must be less than 200 characters')
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
});

export type MarketedLeadFormData = z.infer<typeof marketedLeadSchema>;

export const advisorSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z
    .string()
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .min(10, 'Phone number is required')
    .regex(phoneRegex, 'Please enter a valid phone number'),
});

export type AdvisorFormData = z.infer<typeof advisorSchema>;

// Helper to get error message for a field
export function getFieldError(
  errors: z.ZodError | null,
  field: string
): string | undefined {
  if (!errors) return undefined;
  const fieldError = errors.errors.find((e) => e.path[0] === field);
  return fieldError?.message;
}

// Validate form data and return errors or null
export function validateMarketedLead(data: unknown): z.ZodError | null {
  const result = marketedLeadSchema.safeParse(data);
  return result.success ? null : result.error;
}

export function validateAdvisor(data: unknown): z.ZodError | null {
  const result = advisorSchema.safeParse(data);
  return result.success ? null : result.error;
}
