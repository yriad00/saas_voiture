-- Keep the auth trigger callable by the trigger owner while removing API access.
revoke execute on function public.handle_new_user() from anon, authenticated;
