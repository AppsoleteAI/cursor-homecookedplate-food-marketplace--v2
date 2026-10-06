-- Record of the member's Legal & Safety section agreements and dated acknowledgment.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS legal_safety_agreement jsonb;

COMMENT ON COLUMN public.profiles.legal_safety_agreement IS
  'Member record of agreement: each Legal & Safety section checked, plus the date entered as the signed acknowledgment.';
