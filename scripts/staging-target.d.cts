declare const stagingTarget: {
  STAGING_SUPABASE_HOSTNAME: string;
  assertStagingTarget: (value: string, label?: string) => URL;
};

export = stagingTarget;
