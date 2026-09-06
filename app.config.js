// Splits which EAS account/project a build belongs to by build profile, so
// day-to-day test builds (development/preview) spend the sandcmail
// account's quota, and only the production profile (Play Store/App Store
// submissions) touches the real sandcmails-team project. Same app code and
// package name either way — a test build is never uploaded to a store, so
// a separate (fresh) test keystore under sandcmail is harmless.
//
// Driven by EAS_ACCOUNT_TARGET, set per build profile in eas.json's "env"
// block rather than relying on eas-cli's own implicit env vars — explicit
// and easy to verify with `eas config --profile <name>`. Defaults to the
// real sandcmails-team project whenever that var isn't exactly "sandcmail"
// (local dev, `eas submit`, `eas update`, or anything else outside an
// actual `eas build` run) so nothing ambiguous ever silently lands on the
// test project by accident.
const ACCOUNTS = {
  sandcmail: {
    owner: "sandcmail",
    projectId: "2faecb2b-5acf-493c-97a5-4060ccc606b2",
  },
  "sandcmails-team": {
    owner: "sandcmails-team",
    projectId: "e91de324-82a4-437a-9344-1b8a89102f72",
  },
};

module.exports = ({ config }) => {
  const target = process.env.EAS_ACCOUNT_TARGET === "sandcmail" ? ACCOUNTS.sandcmail : ACCOUNTS["sandcmails-team"];

  return {
    ...config,
    owner: target.owner,
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId: target.projectId,
      },
    },
  };
};
