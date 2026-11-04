import { z } from "zod";

const documentIdSchema = z.string().trim().min(1).max(512).regex(/^[^/]+$/);

/** Fields a family may submit; Firestore supplies the review timestamp. */
export const reviewSubmissionSchema = z.object({
  relId: documentIdSchema,
  bookingId: z.string().trim().min(1).max(128).regex(/^[^/]+$/),
  familyUid: z.string().trim().min(1).max(128),
  carerUid: z.string().trim().min(1).max(128),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(600),
}).strict().refine((value) => value.familyUid !== value.carerUid, {
  message: "Family and carer must be different users",
  path: ["carerUid"],
});

/** A carer reply is plain text and can be added only once by Firestore rules. */
export const reviewReplySubmissionSchema = z.object({
  text: z.string().trim().min(1).max(600),
}).strict();

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
export type ReviewReplySubmission = z.infer<typeof reviewReplySubmissionSchema>;
