-- Keep agency bootstrap server-only. The function performs privileged writes and
-- is not called by the browser; authenticated clients must use the server action.
REVOKE EXECUTE ON FUNCTION public.create_agency_with_owner(
  text, text, uuid, uuid, text, text, text, text, text, text, text, text,
  public.agency_status, text, boolean, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_agency_with_owner(
  text, text, uuid, uuid, text, text, text, text, text, text, text, text,
  public.agency_status, text, boolean, timestamptz, timestamptz
) TO service_role;
