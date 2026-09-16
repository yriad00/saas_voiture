-- This function is called by the auth.users trigger, never by the public API.
revoke execute on function public.handle_new_user() from public;
